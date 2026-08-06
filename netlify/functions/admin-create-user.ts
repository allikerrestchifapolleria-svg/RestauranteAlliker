import type { Handler } from '@netlify/functions';
import { adminAuth, adminDb, requireAdmin, HttpError } from './_firebase-admin';

const VALID_ROLES = ['admin', 'cook', 'waiter', 'user'];

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Metodo no permitido' }) };
  }

  try {
    await requireAdmin(event.headers.authorization);

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'JSON invalido' }) };
    }

    const { firstName, lastName, email, password, role, branchId } = body;

    if (!firstName || !lastName || !email || !password || !role) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Faltan campos requeridos' }) };
    }

    if (!VALID_ROLES.includes(role)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Role invalido' }) };
    }

    if (String(password).length < 6) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' }) };
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`.trim(),
    });

    await adminDb.collection('users').doc(userRecord.uid).set({
      email,
      firstName,
      lastName,
      role,
      branchId: branchId || null,
      createdAt: new Date(),
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, uid: userRecord.uid }) };
  } catch (error: any) {
    if (error instanceof HttpError) {
      return { statusCode: error.statusCode, body: JSON.stringify({ success: false, message: error.message }) };
    }
    console.error('[ADMIN-CREATE-USER] Error:', error);
    if (error?.code === 'auth/email-already-exists') {
      return { statusCode: 409, body: JSON.stringify({ success: false, message: 'El email ya esta registrado' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Error interno del servidor' }) };
  }
};
