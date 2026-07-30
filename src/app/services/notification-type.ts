import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NotificationType } from '../models/notification-type';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.config';

const DEFAULT_TYPES: Omit<NotificationType, 'id' | 'createdAt'>[] = [
  { value: 'info', label: 'Información', color: '#22d3ee', icon: 'fa-info-circle' },
  { value: 'warning', label: 'Advertencia', color: '#fbbf24', icon: 'fa-exclamation-triangle' },
  { value: 'error', label: 'Error', color: '#fb7185', icon: 'fa-times-circle' },
  { value: 'success', label: 'Éxito', color: '#34d399', icon: 'fa-check-circle' },
];

@Injectable({
  providedIn: 'root'
})
export class NotificationTypeService {
  private typesSubject = new BehaviorSubject<NotificationType[]>([]);
  public types$ = this.typesSubject.asObservable();

  constructor(private ngZone: NgZone) {
    this.loadTypesFromFirestore();
  }

  private async loadTypesFromFirestore() {
    try {
      const typesCollection = collection(db, 'notification_types');
      const snapshot = await getDocs(typesCollection);

      if (snapshot.empty) {
        await this.seedDefaultTypes();
        return;
      }

      const types: NotificationType[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        types.push({
          id: docSnap.id,
          value: data['value'] || '',
          label: data['label'] || '',
          color: data['color'] || '#94a3b8',
          icon: data['icon'] || 'fa-bell',
          createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date()
        } as NotificationType);
      });
      // Deferred so this emission lands in its own change-detection tick
      // instead of possibly interleaving with another Firestore read (e.g.
      // branches) resolving in the same microtask flush, which was throwing
      // NG0100 in the admin layout.
      setTimeout(() => this.ngZone.run(() => this.typesSubject.next(types)));
    } catch (error) {
      console.error('Error loading notification types from Firestore:', error);
    }
  }

  /** First run only: pre-populates the 4 types the system already used, as
   *  normal editable/deletable rows instead of hardcoded values in the UI. */
  private async seedDefaultTypes() {
    try {
      const typesCollection = collection(db, 'notification_types');
      for (const type of DEFAULT_TYPES) {
        await addDoc(typesCollection, { ...type, createdAt: new Date() });
      }
      await this.loadTypesFromFirestore();
    } catch (error) {
      console.error('Error seeding default notification types:', error);
    }
  }

  getTypes(): Observable<NotificationType[]> {
    return this.types$;
  }

  async createType(type: Omit<NotificationType, 'id' | 'createdAt'>): Promise<void> {
    try {
      const typesCollection = collection(db, 'notification_types');
      const dataToSave = {
        value: type.value,
        label: type.label,
        color: type.color,
        icon: type.icon,
        createdAt: new Date()
      };
      const docRef = await addDoc(typesCollection, dataToSave);
      const current = this.typesSubject.value;
      this.typesSubject.next([...current, { id: docRef.id, ...type, createdAt: dataToSave.createdAt }]);
    } catch (error) {
      console.error('Error creating notification type:', error);
      throw error;
    }
  }

  async updateType(id: string, updates: Partial<NotificationType>): Promise<void> {
    try {
      const typeDoc = doc(db, 'notification_types', id);
      await updateDoc(typeDoc, {
        value: updates.value,
        label: updates.label,
        color: updates.color,
        icon: updates.icon
      });
      const current = this.typesSubject.value;
      const updated = current.map(t => t.id === id ? { ...t, ...updates } : t);
      this.typesSubject.next(updated);
    } catch (error) {
      console.error('Error updating notification type:', error);
      throw error;
    }
  }

  async deleteType(id: string): Promise<void> {
    try {
      const typeDoc = doc(db, 'notification_types', id);
      await deleteDoc(typeDoc);
      const current = this.typesSubject.value;
      this.typesSubject.next(current.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting notification type:', error);
      throw error;
    }
  }
}
