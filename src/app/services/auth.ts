import { Injectable } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { db, auth as firebaseAuth } from '../firebase.config';

export type UserRole = 'admin' | 'cook' | 'waiter' | 'user';

interface StoredUser {
  uid: string;
  email: string;
  role: UserRole;
  branchId: string | null;
}

interface AuthResult {
  success: boolean;
  role?: UserRole;
  branchId?: string | null;
  message?: string;
  isNewUser?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private currentUser: StoredUser | null = null;

  constructor() {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      this.currentUser = JSON.parse(stored);
    }

    // Si Firebase reporta que ya no hay sesion (token revocado, logout en otra
    // pestana, etc.) invalidamos el cache local para que los guards no confien
    // en una sesion que ya no existe.
    // Si hay sesion y hay cache, refrescamos el perfil desde Firestore: evita
    // que un role/branchId antiguo almacenado en localStorage quede vigente
    // (por ejemplo si un admin le quito el rol a un usuario o lo movio de sucursal).
    onAuthStateChanged(firebaseAuth, (user) => {
      if (!user && this.currentUser) {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        return;
      }
      if (user && this.currentUser) {
        this.loadUserProfile(user.uid, user.email).catch((error) => {
          console.error('[AUTH] Error al refrescar perfil desde Firestore:', error);
        });
      }
    });
  }

  private async loadUserProfile(uid: string, email: string | null): Promise<AuthResult> {
    const userSnap = await getDoc(doc(db, 'users', uid));

    if (!userSnap.exists()) {
      return { success: false, message: 'No se encontro el perfil de este usuario.' };
    }

    const data = userSnap.data();
    const role = (data['role'] as UserRole) || 'user';
    const branchId = data['branchId'] || null;

    this.currentUser = { uid, email: email || data['email'] || '', role, branchId };
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

    return { success: true, role, branchId };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      return await this.loadUserProfile(credential.user.uid, credential.user.email);
    } catch (error: any) {
      console.error('[AUTH] Error during login:', error);
      return { success: false, message: this.mapAuthError(error) };
    }
  }

  async loginWithGoogle(): Promise<AuthResult> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(firebaseAuth, provider);
      return await this.handleSocialLogin(result.user);
    } catch (error: any) {
      console.error('[AUTH] Google login error:', error);
      return { success: false, message: 'Error al iniciar sesion con Google. Intente de nuevo.' };
    }
  }

  async loginWithFacebook(): Promise<AuthResult> {
    try {
      const provider = new FacebookAuthProvider();
      const result = await signInWithPopup(firebaseAuth, provider);
      return await this.handleSocialLogin(result.user);
    } catch (error: any) {
      console.error('[AUTH] Facebook login error:', error);
      return { success: false, message: 'Error al iniciar sesion con Facebook. Intente de nuevo.' };
    }
  }

  private async handleSocialLogin(user: FirebaseUser): Promise<AuthResult> {
    const existing = await getDoc(doc(db, 'users', user.uid));

    if (existing.exists()) {
      const data = existing.data();
      const role = (data['role'] as UserRole) || 'user';
      const branchId = data['branchId'] || null;
      this.currentUser = { uid: user.uid, email: user.email || data['email'] || '', role, branchId };
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      return { success: true, role, branchId, isNewUser: false };
    }

    const nameParts = (user.displayName || '').split(' ');
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      role: 'user',
      branchId: null,
      createdAt: new Date(),
    });

    this.currentUser = { uid: user.uid, email: user.email || '', role: 'user', branchId: null };
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    return { success: true, role: 'user', branchId: null, isNewUser: true };
  }

  async register(name: string, email: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const parts = name.trim().split(' ');

      await setDoc(doc(db, 'users', credential.user.uid), {
        email,
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        role: 'user',
        branchId: null,
        createdAt: new Date(),
      });

      return { success: true };
    } catch (error: any) {
      console.error('[AUTH] Error during registration:', error);
      return { success: false, message: this.mapAuthError(error) };
    }
  }

  async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      return { success: true };
    } catch (error: any) {
      console.error('[AUTH] Error sending password reset email:', error);
      return { success: false, message: this.mapAuthError(error) };
    }
  }

  private mapAuthError(error: any): string {
    switch (error?.code) {
      case 'auth/invalid-email':
        return 'El email no es valido.';
      case 'auth/user-disabled':
        return 'Esta cuenta esta deshabilitada.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Email o contraseña incorrectos.';
      case 'auth/email-already-in-use':
        return 'El email ya esta registrado.';
      case 'auth/weak-password':
        return 'La contraseña es demasiado debil (minimo 6 caracteres).';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Intente nuevamente mas tarde.';
      default:
        return 'Error de conexion. Intente de nuevo.';
    }
  }

  logout(): void {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('selectedBranchId');
    signOut(firebaseAuth).catch((error) => console.error('[AUTH] Error signing out:', error));
  }

  async getIdToken(): Promise<string | null> {
    try {
      const user = firebaseAuth.currentUser;
      return user ? await user.getIdToken() : null;
    } catch (error) {
      console.error('[AUTH] Error al obtener el ID token:', error);
      return null;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUserRole(): UserRole | null {
    return this.currentUser?.role || null;
  }

  getUserBranchId(): string | null {
    return this.currentUser?.branchId ?? null;
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }
}
