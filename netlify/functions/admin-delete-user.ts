import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb, requireAdmin, HttpError } from './_firebase-admin';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Metodo no permitido' }) };
  }

  try {
    const caller = await requireAdmin(event.headers.authorization);

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'JSON invalido' }) };
    }

    const { uid } = body;
    if (!uid) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Falta el uid del usuario' }) };
    }

    if (uid === caller.uid) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'No puedes eliminar tu propia cuenta' }) };
    }

    await adminAuth.deleteUser(uid).catch((error: any) => {
      if (error?.code !== 'auth/user-not-found') throw error;
    });
    await adminDb.collection('users').doc(uid).delete();

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error: any) {
    if (error instanceof HttpError) {
      return { statusCode: error.statusCode, body: JSON.stringify({ success: false, message: error.message }) };
    }
    console.error('[ADMIN-DELETE-USER] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Error interno del servidor' }) };
  }
};
