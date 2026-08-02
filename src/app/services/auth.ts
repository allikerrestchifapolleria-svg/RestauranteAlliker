import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { db, auth as firebaseAuth } from '../firebase.config';
import { environment } from '../../environments/environment';

// Tipos minimos de Google Identity Services (window.google.accounts.id).
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            cancel_on_tap_outside?: boolean;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              width?: number | string;
            }
          ): void;
          prompt(momentListener?: (notification: { getNotDisplayedReason?: () => string }) => void): void;
          cancel(): void;
        };
      };
    };
  }
}

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

  /**
   * Renderiza el boton "Continuar con Google" usando Google Identity Services
   * (GSI). GSI devuelve el ID token directamente a esta pagina (popup propio de
   * Google, inmune al bloqueo de almacenamiento de terceros de los navegadores) y
   * luego Firebase lo valida con signInWithCredential: sin redirect, sin
   * authDomain cruzado, sin recarga de pagina.
   *
   * Carga https://accounts.google.com/gsi/client on demand (la CSP de public/_headers
   * ya lo permite en script-src). El resultado se entrega via onResult(result).
   */
  renderGoogleSignInButton(container: HTMLElement, onResult: (result: AuthResult) => void): void {
    const clientId = environment.firebase.googleClientId;
    if (!clientId) {
      onResult({ success: false, message: 'Falta googleClientId en environment.ts.' });
      return;
    }

    this.loadGsiScript()
      .then(() => {
        const google = window.google;
        if (!google?.accounts?.id) {
          onResult({ success: false, message: 'Google Identity Services no esta disponible.' });
          return;
        }

        google.accounts.id.initialize({
          client_id: clientId,
          cancel_on_tap_outside: false,
          callback: async (response) => {
            try {
              const credential = GoogleAuthProvider.credential(response.credential);
              const userCredential = await signInWithCredential(firebaseAuth, credential);
              console.log('[AUTH] GSI sign-in OK. uid=', userCredential.user.uid, 'email=', userCredential.user.email);
              onResult(await this.handleSocialLogin(userCredential.user));
            } catch (error: any) {
              console.error('[AUTH] GSI sign-in ERROR:', {
                code: error?.code,
                message: error?.message,
              });
              onResult({ success: false, message: this.mapAuthError(error) });
            }
          },
        });

        const options: Parameters<typeof google.accounts.id.renderButton>[1] = {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
        };
        if (container.clientWidth > 0) {
          options.width = container.clientWidth;
        }
        google.accounts.id.renderButton(container, options);
      })
      .catch((error: any) => {
        console.error('[AUTH] Error cargando el script GSI:', error);
        onResult({ success: false, message: 'No se pudo cargar el boton de Google. Revisa tu conexion.' });
      });
  }

  private gsiScriptPromise: Promise<void> | null = null;

  private loadGsiScript(): Promise<void> {
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }
    if (!this.gsiScriptPromise) {
      this.gsiScriptPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          'script[src="https://accounts.google.com/gsi/client"]'
        );
        if (existing) {
          if (existing.dataset['loaded'] === 'true') {
            resolve();
            return;
          }
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('GSI script load error')));
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          script.dataset['loaded'] = 'true';
          resolve();
        };
        script.onerror = () => reject(new Error('GSI script load error'));
        document.head.appendChild(script);
      });
    }
    return this.gsiScriptPromise;
  }

  /**
   * Completa un sign-in social iniciado con signInWithRedirect (Google/Facebook).
   *
   * Tras volver de Google la app recarga y este metodo lee el resultado pendiente
   * con getRedirectResult(); si Firebase trae usuario, crea/reutiliza el perfil
   * en users/{uid} y devuelve el AuthResult para que la pagina navegue.
   *
   * Devuelve null si no habia redirect pendiente o si el usuario cancelo en
   * Google (caso normal al entrar directo al login). Ante un error de Firebase
   * (p.ej. ya existe cuenta con ese correo creada por otro metodo) devuelve un
   * AuthResult con success:false y el mensaje traducido.
   */
  async completeRedirectSignIn(): Promise<AuthResult | null> {
    let result: AuthResult | null = null;
    console.log(
      '[AUTH] completeRedirectSignIn: path=',
      window.location.pathname,
      '| con query/hash:',
      window.location.search.length > 0 || window.location.hash.length > 0
    );
    try {
      const credential = await getRedirectResult(firebaseAuth);
      if (!credential?.user) {
        // No habia resultado pendiente en la URL. Pero la sesion pudo crearse
        // igualmente (el handler de Google completo el sign-in y el retorno perdio
        // la respuesta). Si Firebase tiene usuario, completamos el perfil.
        const user = firebaseAuth.currentUser;
        if (user) {
          console.log(
            '[AUTH] completeRedirectSignIn: sin resultado en URL pero hay sesion activa. uid=',
            user.uid
          );
          return await this.handleSocialLogin(user);
        }
        return null;
      }
      console.log(
        '[AUTH] completeRedirectSignIn: resultado de Google. uid=',
        credential.user.uid,
        'email=',
        credential.user.email
      );
      result = await this.handleSocialLogin(credential.user);
    } catch (error: any) {
      console.error('[AUTH] completeRedirectSignIn ERROR:', {
        code: error?.code,
        message: error?.message,
      });
      // Fallback de resiliencia: aunque getRedirectResult falle (p.ej.
      // auth/internal-error por bloqueo de almacenamiento de terceros de Edge o
      // una extension), Firebase puede haber creado la sesion igualmente. Si hay
      // usuario autenticado, completamos el perfil y el login en vez de fallar.
      const user = firebaseAuth.currentUser;
      if (user) {
        console.log(
          '[AUTH] completeRedirectSignIn: getRedirectResult fallo pero hay sesion activa. uid=',
          user.uid
        );
        try {
          result = await this.handleSocialLogin(user);
        } catch (innerError: any) {
          console.error('[AUTH] completeRedirectSignIn: handleSocialLogin fallo tras el fallback:', innerError);
          result = { success: false, message: this.mapAuthError(innerError) };
        }
      } else {
        result = { success: false, message: this.mapAuthError(error) };
      }
    }
    return result;
  }

  async loginWithFacebook(): Promise<AuthResult> {
    try {
      console.log('[AUTH] loginWithFacebook: iniciando signInWithRedirect');
      const provider = new FacebookAuthProvider();
      // Mismo flujo que Google: navega y se completa con completeRedirectSignIn().
      await signInWithRedirect(firebaseAuth, provider);
      return { success: true };
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
      case 'auth/network-request-failed':
        return 'No se pudo conectar con Google. Revisa tu conexion, desactiva bloqueadores/extensiones y prueba en una ventana de incognito.';
      case 'auth/internal-error':
        return 'Google no pudo completar el acceso. Prueba en Chrome o en una ventana de incognito (Edge/bloqueadores pueden romper el retorno de Google).';
      case 'auth/invalid-oauth-client-id':
        return 'El cliente OAuth de Google no coincide con la configuracion de Firebase.';
      case 'auth/redirect-cancelled-by-user':
        return 'Se cancelo el acceso con Google. Intentalo de nuevo.';

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
