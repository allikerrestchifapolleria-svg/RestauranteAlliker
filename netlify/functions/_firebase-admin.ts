import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY no esta configurada en las variables de entorno de Netlify');
  }
  return JSON.parse(raw);
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];
  return initializeApp({ credential: cert(getServiceAccount()) });
}

export const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

/**
 * Verifica el ID token de Firebase enviado por el cliente y confirma que el
 * usuario tiene role 'admin' en Firestore. Lanza HttpError si no.
 */
export async function requireAdmin(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Falta el token de autenticacion');
  }

  const idToken = authHeader.slice('Bearer '.length);
  const decoded = await adminAuth.verifyIdToken(idToken).catch(() => {
    throw new HttpError(401, 'Token invalido o expirado');
  });

  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.['role'] !== 'admin') {
    throw new HttpError(403, 'Solo un administrador puede realizar esta accion');
  }

  return decoded;
}
