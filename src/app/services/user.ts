import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppUser } from '../models/user';
import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {
  private usersSubject = new BehaviorSubject<AppUser[]>([]);
  public users$ = this.usersSubject.asObservable();
  private unsubscribeSnapshot: Unsubscribe | null = null;

  constructor(private ngZone: NgZone) {
    this.listenUsersFromFirestore();
  }

  private listenUsersFromFirestore() {
    const usersCollection = collection(db, 'users');
    this.unsubscribeSnapshot = onSnapshot(usersCollection, (snapshot) => {
      this.ngZone.run(() => {
        const users: AppUser[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          users.push({
            id: doc.id,
            branchId: data['branchId'] || null,
            firstName: data['firstName'] || (data['name'] ? data['name'].split(' ')[0] : ''),
            lastName: data['lastName'] || (data['name'] ? data['name'].split(' ').slice(1).join(' ') : ''),
            email: data['email'] || '',
            role: data['role'] || '',
            createdAt: data['createdAt']?.toDate() || new Date()
          } as AppUser);
        });
        this.usersSubject.next(users);
      });
    }, (error) => {
      console.error('Error listening to users collection:', error);
    });
  }

  ngOnDestroy() {
    this.unsubscribeSnapshot?.();
  }

  getUsers(): Observable<AppUser[]> {
    return this.users$;
  }

  // Crea la cuenta de staff via backend (Admin SDK): esto crea la cuenta real
  // de Firebase Auth con la contraseña generada, sin afectar la sesion del
  // admin que esta creando el usuario (createUserWithEmailAndPassword del lado
  // del cliente hubiera cerrado la sesion del admin y abierto la del nuevo staff).
  async createUser(user: Omit<AppUser, 'id' | 'createdAt'>): Promise<void> {
    const idToken = await firebaseAuth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error('No hay una sesion de administrador activa');
    }

    const response = await fetch('/.netlify/functions/admin-create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(user),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Error al crear el usuario');
    }
  }

  getUserById(id: string): Observable<AppUser | undefined> {
    return new Observable(observer => {
      const users = this.usersSubject.value;
      const user = users.find(u => u.id === id);
      observer.next(user);
      observer.complete();
    });
  }

  // Los cambios de email/rol/contraseña de staff via backend (Admin SDK): un
  // cambio de contraseña o email debe reflejarse tambien en la cuenta real de
  // Firebase Auth, no solo en el documento de Firestore.
  async updateUser(id: string, updates: Partial<AppUser> & { password?: string }): Promise<void> {
    const idToken = await firebaseAuth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error('No hay una sesion de administrador activa');
    }

    const { firstName, lastName, email, role, branchId, password } = updates;
    const payload: Record<string, any> = { uid: id, firstName, lastName, email, role, branchId };
    if (password) payload['password'] = password;

    const response = await fetch('/.netlify/functions/admin-update-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Error al actualizar el usuario');
    }
  }

  // Borra tanto el perfil de Firestore como la cuenta de Firebase Auth via
  // backend (Admin SDK); un deleteDoc directo dejaria una cuenta de Auth
  // huerfana que todavia podria iniciar sesion.
  async deleteUser(id: string): Promise<void> {
    const idToken = await firebaseAuth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error('No hay una sesion de administrador activa');
    }

    const response = await fetch('/.netlify/functions/admin-delete-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ uid: id }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Error al eliminar el usuario');
    }
  }
}