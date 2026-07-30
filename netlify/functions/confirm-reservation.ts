import type { Handler } from '@netlify/functions';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './_firebase-admin';

// "Duración de la cena": tiempo que la mesa se mantiene bloqueada como
// 'reserved' a partir de la hora de inicio de la reserva confirmada.
// El job release-expired-reservations.ts la libera automáticamente al vencer.
const RESERVATION_DURATION_MINUTES = 45;

type IncomingStatus = 'confirmado' | 'cancelado';

function mapStatus(status: IncomingStatus): 'confirmed' | 'cancelled' {
  return status === 'confirmado' ? 'confirmed' : 'cancelled';
}

// El tableId de una reserva puede ser una mesa individual o 'fam_<groupId>'
// (mesa familiar), igual que en el resto de la app (ver TableService.getTableDisplayName).
async function tableDocsForTableId(tableId: string) {
  if (tableId.startsWith('fam_')) {
    const groupId = tableId.slice(4);
    const snap = await adminDb.collection('tables').where('familyGroupId', '==', groupId).get();
    return snap.docs;
  }
  const doc = await adminDb.collection('tables').doc(tableId).get();
  return doc.exists ? [doc] : [];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Metodo no permitido' }) };
  }

  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error('[CONFIRM-RESERVATION] N8N_WEBHOOK_SECRET no esta configurada en Netlify');
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Webhook no configurado' }) };
  }
  if (event.headers['x-webhook-secret'] !== expectedSecret) {
    return { statusCode: 401, body: JSON.stringify({ success: false, message: 'No autorizado' }) };
  }

  let body: { firebaseId?: string; status?: IncomingStatus };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'JSON invalido' }) };
  }

  const { firebaseId, status } = body;

  if (!firebaseId) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Falta firebaseId' }) };
  }
  if (status !== 'confirmado' && status !== 'cancelado') {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: "status debe ser 'confirmado' o 'cancelado'" }) };
  }

  try {
    const reservationRef = adminDb.collection('reservations').doc(firebaseId);
    const reservationSnap = await reservationRef.get();
    if (!reservationSnap.exists) {
      return { statusCode: 404, body: JSON.stringify({ success: false, message: 'Reserva no encontrada' }) };
    }
    const reservation = reservationSnap.data()!;
    const mappedStatus = mapStatus(status);
    await reservationRef.update({ status: mappedStatus });

    if (status === 'cancelado') {
      // Libera cualquier mesa que haya quedado bloqueada por esta reserva
      const lockedSnap = await adminDb.collection('tables').where('reservationId', '==', firebaseId).get();
      await Promise.all(lockedSnap.docs.map(doc => doc.ref.update({
        status: 'free',
        reservationId: null,
        reservationTime: null,
        reservedUntil: null
      })));
      return { statusCode: 200, body: JSON.stringify({ success: true, status: mappedStatus }) };
    }

    // confirmado: bloquear la(s) mesa(s) de la reserva durante la duración de la cena
    const tableId = reservation['tableId'] as string | undefined;
    if (!tableId) {
      return { statusCode: 200, body: JSON.stringify({ success: true, status: mappedStatus, warning: 'La reserva no tiene mesa asociada' }) };
    }

    const startDate: Date = reservation['date']?.toDate ? reservation['date'].toDate() : new Date(reservation['date']);
    const reservedUntil = new Date(startDate.getTime() + RESERVATION_DURATION_MINUTES * 60000);

    const tableDocs = await tableDocsForTableId(tableId);
    if (tableDocs.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ success: true, status: mappedStatus, warning: 'No se encontro la mesa asociada' }) };
    }

    // 'family_merged' es el status normal de reposo de una mesa familiar (no significa ocupada)
    const alreadyTaken = tableDocs.some(doc => {
      const s = doc.data()?.['status'];
      return s !== 'free' && s !== 'available' && s !== 'family_merged';
    });
    if (alreadyTaken) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, status: mappedStatus, tableConflict: true, message: 'La mesa ya no esta libre, revisar manualmente' })
      };
    }

    await Promise.all(tableDocs.map(doc => doc.ref.update({
      status: 'reserved',
      reservationId: firebaseId,
      reservationTime: startDate.toISOString(),
      reservedUntil: Timestamp.fromDate(reservedUntil)
    })));

    return { statusCode: 200, body: JSON.stringify({ success: true, status: mappedStatus }) };
  } catch (error) {
    console.error('[CONFIRM-RESERVATION] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Error interno del servidor' }) };
  }
};
