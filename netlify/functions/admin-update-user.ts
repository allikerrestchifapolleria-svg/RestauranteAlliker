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

    const { uid, firstName, lastName, email, role, branchId, password } = body;

    if (!uid) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Falta el uid del usuario' }) };
    }

    if (role && !VALID_ROLES.includes(role)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Role invalido' }) };
    }

    if (password && String(password).length < 6) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' }) };
    }

    const authUpdates: Record<string, any> = {};
    if (email) authUpdates['email'] = email;
    if (password) authUpdates['password'] = password;
    if (firstName || lastName) authUpdates['displayName'] = `${firstName || ''} ${lastName || ''}`.trim();

    if (Object.keys(authUpdates).length > 0) {
      await adminAuth.updateUser(uid, authUpdates);
    }

    const docUpdates: Record<string, any> = {};
    if (firstName !== undefined) docUpdates['firstName'] = firstName;
    if (lastName !== undefined) docUpdates['lastName'] = lastName;
    if (email !== undefined) docUpdates['email'] = email;
    if (role !== undefined) docUpdates['role'] = role;
    if (branchId !== undefined) docUpdates['branchId'] = branchId || null;

    if (Object.keys(docUpdates).length > 0) {
      await adminDb.collection('users').doc(uid).update(docUpdates);
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error: any) {
    if (error instanceof HttpError) {
      return { statusCode: error.statusCode, body: JSON.stringify({ success: false, message: error.message }) };
    }
    console.error('[ADMIN-UPDATE-USER] Error:', error);
    if (error?.code === 'auth/email-already-exists') {
      return { statusCode: 409, body: JSON.stringify({ success: false, message: 'El email ya esta registrado' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Error interno del servidor' }) };
  }
};
