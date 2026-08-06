import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification } from '../models/notification';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, where, arrayUnion, Unsubscribe, Query, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth as firebaseAuth } from '../firebase.config';
import { Auth } from './auth';

const STAFF_ROLES = ['admin', 'cook', 'waiter'];

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();
  private unsubscribeSnapshot: Unsubscribe | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private pendingDeletions = new Map<string, ReturnType<typeof setTimeout>>();
  private currentUid: string | null = null;
  private currentRole: string | null = null;

  constructor(private ngZone: NgZone, private auth: Auth) {
    // Re-escuchamos notificaciones segun la sesion: clientes solo ven las suyas
    // (filtro por userId), staff/admin ven todas. Esto tambien evita que el
    // listener de un cliente lea notificaciones de otros (denegado por reglas).
    onAuthStateChanged(firebaseAuth, (user) => {
      this.ngZone.run(() => {
        this.handleAuthChange(user);
      });
    });
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 30 * 60 * 1000);
  }

  ngOnDestroy() {
    this.teardownListener();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.pendingDeletions.forEach(timeout => clearTimeout(timeout));
    this.pendingDeletions.clear();
  }

  private async handleAuthChange(user: FirebaseUser | null) {
    this.teardownListener();
    this.pendingDeletions.forEach(timeout => clearTimeout(timeout));
    this.pendingDeletions.clear();

    if (!user) {
      this.currentUid = null;
      this.currentRole = null;
      this.notificationsSubject.next([]);
      return;
    }

    this.currentUid = user.uid;
    this.currentRole = await this.resolveRole(user.uid);
    this.listenToNotifications();
    this.cleanupExpired();
  }

  private async resolveRole(uid: string): Promise<string | null> {
    const cached = this.auth.getUserRole();
    if (cached) return cached;
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      return (userSnap.data()?.['role'] as string) || null;
    } catch (error) {
      console.error('[NOTIFICATION] Error al leer el rol del usuario:', error);
      return null;
    }
  }

  private isStaffRole(role: string | null): boolean {
    return role !== null && STAFF_ROLES.includes(role);
  }

  private teardownListener() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
  }

  private listenToNotifications() {
    try {
      let notificationsQuery: Query = collection(db, 'notifications');
      // Los clientes solo deben escuchar sus propias notificaciones; el filtro
      // coincide con las reglas (isOwner('userId')) para no leer datos ajenos.
      if (!this.isStaffRole(this.currentRole) && this.currentUid) {
        notificationsQuery = query(notificationsQuery, where('userId', '==', this.currentUid));
      }
      this.unsubscribeSnapshot = onSnapshot(notificationsQuery, (snapshot) => {
        this.ngZone.run(() => {
          const now = new Date();
          const notifications: Notification[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            const expiresAt = data['expiresAt']?.toDate ? data['expiresAt'].toDate() : undefined;
            if (expiresAt && expiresAt < now) return;
            notifications.push({
              id: doc.id,
              userId: data['userId'] || null,
              targetRole: data['targetRole'] || null,
              branchId: data['branchId'] || null,
              type: data['type'] || '',
              title: data['title'] || '',
              message: data['message'] || '',
              read: data['read'] || false,
              readBy: data['readBy'] || [],
              createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
              expiresAt
            } as Notification);
          });
          this.notificationsSubject.next(notifications);
        });
      }, (error) => {
        console.error('Error listening to notifications:', error);
      });
    } catch (error) {
      console.error('Error setting up notifications listener:', error);
    }
  }

  getNotifications(): Observable<Notification[]> {
    return this.notifications$;
  }

  async createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<void> {
    try {
      const notificationsCollection = collection(db, 'notifications');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dataToSave = {
        ...notification,
        createdAt: now,
        expiresAt
      };
      const docRef = await addDoc(notificationsCollection, dataToSave);
      console.log('Notification created with ID:', docRef.id, '- expires at:', expiresAt);
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  getNotificationById(id: string): Observable<Notification | undefined> {
    return new Observable(observer => {
      const notifications = this.notificationsSubject.value;
      const notification = notifications.find(n => n.id === id);
      observer.next(notification);
      observer.complete();
    });
  }

  async updateNotification(id: string, updates: Partial<Notification>): Promise<void> {
    try {
      const notificationDoc = doc(db, 'notifications', id);
      await updateDoc(notificationDoc, updates);
      // Update local state
      const currentNotifications = this.notificationsSubject.value;
      const updatedNotifications = currentNotifications.map(notification =>
        notification.id === id ? { ...notification, ...updates } : notification
      );
      this.notificationsSubject.next(updatedNotifications);
    } catch (error) {
      console.error('Error updating notification:', error);
      throw error;
    }
  }

  async deleteNotification(id: string): Promise<void> {
    try {
      const notificationDoc = doc(db, 'notifications', id);
      await deleteDoc(notificationDoc);
      // Update local state
      const currentNotifications = this.notificationsSubject.value;
      const filteredNotifications = currentNotifications.filter(notification => notification.id !== id);
      this.notificationsSubject.next(filteredNotifications);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  async markAsRead(id: string): Promise<void> {
    try {
      await this.updateNotification(id, { read: true });
      this.scheduleAutoDelete(id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAsUnread(id: string): Promise<void> {
    try {
      await this.updateNotification(id, { read: false });
      this.cancelAutoDelete(id);
    } catch (error) {
      console.error('Error marking notification as unread:', error);
      throw error;
    }
  }

  async markMultipleAsRead(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.update(doc(db, 'notifications', id), { read: true });
      });
      await batch.commit();

      const current = this.notificationsSubject.value;
      const updated = current.map(n =>
        ids.includes(n.id) ? { ...n, read: true } : n
      );
      this.notificationsSubject.next(updated);
      ids.forEach(id => this.scheduleAutoDelete(id));
    } catch (error) {
      console.error('Error marking multiple notifications as read:', error);
      throw error;
    }
  }

  // Per-recipient read tracking: a broadcast notification (targetRole/general) is shared
  // by many people, so "I read it" must only hide it for that one person, not for everyone
  // targeted by it. `read`/markAsRead stays as the admin's override to close it for all.
  async markReadByUser(id: string, userEmail: string): Promise<void> {
    if (!userEmail) return;
    try {
      const notificationDoc = doc(db, 'notifications', id);
      await updateDoc(notificationDoc, { readBy: arrayUnion(userEmail) });
      const current = this.notificationsSubject.value;
      const updated = current.map(n =>
        n.id === id
          ? { ...n, readBy: n.readBy?.includes(userEmail) ? n.readBy : [...(n.readBy || []), userEmail] }
          : n
      );
      this.notificationsSubject.next(updated);
    } catch (error) {
      console.error('Error marking notification as read by user:', error);
      throw error;
    }
  }

  async markMultipleReadByUser(ids: string[], userEmail: string): Promise<void> {
    if (ids.length === 0 || !userEmail) return;
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.update(doc(db, 'notifications', id), { readBy: arrayUnion(userEmail) });
      });
      await batch.commit();

      const current = this.notificationsSubject.value;
      const updated = current.map(n =>
        ids.includes(n.id) && !n.readBy?.includes(userEmail)
          ? { ...n, readBy: [...(n.readBy || []), userEmail] }
          : n
      );
      this.notificationsSubject.next(updated);
    } catch (error) {
      console.error('Error marking multiple notifications as read by user:', error);
      throw error;
    }
  }

  private scheduleAutoDelete(id: string): void {
    this.cancelAutoDelete(id);
    const timeout = setTimeout(async () => {
      try {
        await this.deleteNotification(id);
        console.log(`[NOTIFICATION] Auto-deleted notification ${id} after being read`);
      } catch (err) {
        console.error(`[NOTIFICATION] Error auto-deleting notification ${id}:`, err);
      }
      this.pendingDeletions.delete(id);
    }, 5 * 60 * 1000);
    this.pendingDeletions.set(id, timeout);
  }

  private cancelAutoDelete(id: string): void {
    const timeout = this.pendingDeletions.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingDeletions.delete(id);
    }
  }

  async cleanupExpired(): Promise<void> {
    try {
      if (!this.currentUid) return;

      const now = new Date();
      let q = query(
        collection(db, 'notifications'),
        where('expiresAt', '<', now)
      );
      // Un cliente solo puede limpiar sus propias notificaciones expiradas
      // (las reglas le impiden leer/eliminar las ajenas).
      if (!this.isStaffRole(this.currentRole)) {
        q = query(q, where('userId', '==', this.currentUid));
      }
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      const current = this.notificationsSubject.value;
      const expiredIds = new Set(snapshot.docs.map(d => d.id));
      const remaining = current.filter(n => !expiredIds.has(n.id));
      this.notificationsSubject.next(remaining);

      console.log(`[NOTIFICATION] Cleaned up ${snapshot.size} expired notifications`);
    } catch (error) {
      console.error('[NOTIFICATION] Error cleaning up expired notifications:', error);
    }
  }
}