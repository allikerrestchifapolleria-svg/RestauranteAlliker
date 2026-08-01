import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppUser } from '../models/user';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  Unsubscribe,
  DocumentData,
  DocumentSnapshot
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth as firebaseAuth } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {
  private usersSubject = new BehaviorSubject<AppUser[]>([]);
  public users$ = this.usersSubject.asObservable();
  private unsubscribeSnapshot: Unsubscribe | null = null;
  private unsubscribeAuth: Unsubscribe | null = null;
  // Token anti-carrera: si cambia la sesion mientras se lee el rol en Firestore,
  // el resultado stale no debe enganchar un listener para el usuario anterior.
  private listenerToken = 0;

  constructor(private ngZone: NgZone) {
    // La escucha de TODA la coleccion 'users' solo es valida para admins (reglas:
    // un usuario solo lee su propio documento, solo un admin lee todos). Antes se
    // arrancaba incondicionalmente en el constructor y cualquier sesion no-admin
    // (o sin sesion) reventaba con "Missing or insufficient permissions".
    // Ahora la escucha se re-arma segun el estado de auth y el rol:
    //   - sin sesion  -> sin escucha, lista vacia
    //   - admin       -> coleccion completa (panel de user-management)
    //   - user/staff  -> solo su propio documento users/{uid}
    this.unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
      const token = ++this.listenerToken;
      this.teardownSnapshot();
      this.usersSubject.next([]);

      if (!user) return;

      getDoc(doc(db, 'users', user.uid))
        .then((snap) => {
          if (token !== this.listenerToken) return;
          const role = snap.exists() ? snap.data()['role'] : null;
          this.ngZone.run(() => {
            if (role === 'admin') {
              this.listenAllUsers();
            } else {
              this.listenOwnProfile(user.uid);
            }
          });
        })
        .catch(() => {
          // Sin perfil o sin permiso: se deja la lista vacia sin spam en consola.
        });
    });
  }

  private listenAllUsers() {
    const usersCollection = collection(db, 'users');
    this.unsubscribeSnapshot = onSnapshot(usersCollection, (snapshot) => {
      this.ngZone.run(() => {
        const users: AppUser[] = [];
        snapshot.forEach(doc => users.push(this.mapUser(doc)));
        this.usersSubject.next(users);
      });
    }, (error) => {
      console.error('Error listening to users collection:', error);
    });
  }

  private listenOwnProfile(uid: string) {
    this.unsubscribeSnapshot = onSnapshot(doc(db, 'users', uid), (snap) => {
      this.ngZone.run(() => {
        this.usersSubject.next(snap.exists() ? [this.mapUser(snap)] : []);
      });
    }, (error) => {
      console.error('Error listening to own user profile:', error);
    });
  }

  private mapUser(snap: DocumentSnapshot<DocumentData>): AppUser {
    const data = snap.data() ?? {};
    return {
      id: snap.id,
      branchId: data['branchId'] || null,
      firstName: data['firstName'] || (data['name'] ? data['name'].split(' ')[0] : ''),
      lastName: data['lastName'] || (data['name'] ? data['name'].split(' ').slice(1).join(' ') : ''),
      email: data['email'] || '',
      role: data['role'] || '',
      createdAt: data['createdAt']?.toDate() || new Date()
    } as AppUser;
  }

  private teardownSnapshot() {
    this.unsubscribeSnapshot?.();
    this.unsubscribeSnapshot = null;
  }

  ngOnDestroy() {
    this.teardownSnapshot();
    this.unsubscribeAuth?.();
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