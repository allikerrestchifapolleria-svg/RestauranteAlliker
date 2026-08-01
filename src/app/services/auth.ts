import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
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
  private currentUserSubject = new BehaviorSubject<StoredUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      this.currentUser = JSON.parse(stored);
    }
    this.currentUserSubject.next(this.currentUser);

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
        this.currentUserSubject.next(null);
        return;
      }
      if (user && this.currentUser) {
        this.loadUserProfile(user.uid, user.email).catch((error) => {
          console.error('[AUTH] Error al refrescar perfil desde Firestore:', error);
        });
      }
    });
  }

  private emitUser(): void {
    this.currentUserSubject.next(this.currentUser);
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
    this.emitUser();

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
      console.log('[AUTH] loginWithGoogle: iniciando signInWithPopup');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(firebaseAuth, provider);
      console.log('[AUTH] loginWithGoogle: signInWithPopup OK. uid=', result.user.uid, 'email=', result.user.email);
      return await this.handleSocialLogin(result.user);
    } catch (error: any) {
      console.error('[AUTH] loginWithGoogle ERROR:', {
        code: error?.code,
        message: error?.message,
        name: error?.name,
        customData: error?.customData,
        stack: error?.stack,
      });
      // El codigo llega a la pantalla: el fallo casi nunca es del popup, sino de
      // Firestore al crear el perfil (permission-denied), y el mensaje generico
      // lo ocultaba por completo.
      return { success: false, message: this.mapAuthError(error) };
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
    console.log('[AUTH] handleSocialLogin: verificando perfil existente para uid=', user.uid);
    const existing = await getDoc(doc(db, 'users', user.uid));

    if (existing.exists()) {
      const data = existing.data();
      const role = (data['role'] as UserRole) || 'user';
      const branchId = data['branchId'] || null;
      this.currentUser = { uid: user.uid, email: user.email || data['email'] || '', role, branchId };
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      this.emitUser();
      console.log('[AUTH] handleSocialLogin: usuario ya existia. role=', role, 'branchId=', branchId);
      return { success: true, role, branchId, isNewUser: false };
    }

    const nameParts = (user.displayName || '').split(' ');
    console.log('[AUTH] handleSocialLogin: creando perfil nuevo para uid=', user.uid, 'displayName=', user.displayName);
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
    this.emitUser();
    console.log('[AUTH] handleSocialLogin: perfil creado OK (role=user)');
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

      // --- Login social (Google/Facebook) ---
      case 'auth/popup-blocked':
        return 'El navegador bloqueo la ventana de Google. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Se cerro la ventana de Google antes de terminar. Intentalo de nuevo.';
      case 'auth/unauthorized-domain':
        return 'Este dominio no esta autorizado en Firebase Authentication. Agregalo en Authentication > Settings > Authorized domains.';
      case 'auth/account-exists-with-different-credential':
        return 'Ya existe una cuenta con este correo creada por otro metodo. Inicia sesion con email y contraseña.';
      case 'auth/operation-not-allowed':
        return 'El acceso con Google no esta habilitado en Firebase Authentication.';

      // Firestore, no Auth: el popup funciono pero fallo al leer o crear el perfil.
      // Es el sintoma tipico de unas reglas de seguridad que bloquean users/{uid}.
      case 'permission-denied':
        return 'Tu cuenta se creo, pero las reglas de Firestore no permiten guardar tu perfil. Revisa la regla de la coleccion "users".';

      default:
        return 'Error de conexion. Intente de nuevo.';
    }
  }

  logout(): void {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    this.emitUser();
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

  /**
   * Rol cacheado en localStorage. Sirve para pintar la UI, NO para decidir
   * accesos: el propio usuario puede editarlo desde las devtools. Para eso esta
   * resolveVerifiedRole().
   */
  getUserRole(): UserRole | null {
    return this.currentUser?.role || null;
  }

  /**
   * Rol reconfirmado contra Firestore, que es la unica fuente fiable.
   *
   * Firestore y las Netlify Functions ya resuelven el rol en servidor, asi que
   * un localStorage manipulado nunca daba acceso a datos; pero si abria el panel
   * de admin y dejaba la app en un estado incoherente. Esto lo cierra.
   *
   * Espera a authStateReady() porque tras recargar la pagina Firebase restaura
   * la sesion de forma asincrona: sin esa espera, currentUser seria null y el
   * guard echaria a un usuario legitimo en cada F5.
   *
   * Ante un error de lectura devuelve null (fail secure): preferimos denegar el
   * acceso a concederlo sin haber podido comprobarlo.
   */
  async resolveVerifiedRole(): Promise<UserRole | null> {
    await firebaseAuth.authStateReady();
    const user = firebaseAuth.currentUser;

    if (!user) {
      return null;
    }

    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.exists()) {
        return null;
      }

      const role = (snap.data()['role'] as UserRole) || 'user';
      // Realinea el cache si se habia quedado desfasado o manipulado.
      if (this.currentUser && this.currentUser.role !== role) {
        this.currentUser = { ...this.currentUser, role };
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        this.emitUser();
      }
      return role;
    } catch (error) {
      console.error('[AUTH] No se pudo verificar el rol contra Firestore:', error);
      return null;
    }
  }

  getUserBranchId(): string | null {
    return this.currentUser?.branchId ?? null;
  }

  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }
}
