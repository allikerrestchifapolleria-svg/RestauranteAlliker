import type { Handler } from '@netlify/functions';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './_firebase-admin';

// Se ejecuta cada 5 minutos (ver netlify.toml) y libera las mesas cuya
// reserva confirmada ya paso su ventana (reservedUntil), sin que nadie
// haya intervenido manualmente (ej: el mesero ya la marco 'occupied').
export const handler: Handler = async () => {
  try {
    const now = Timestamp.now();
    const expiredSnap = await adminDb.collection('tables')
      .where('status', '==', 'reserved')
      .where('reservedUntil', '<=', now)
      .get();

    if (expiredSnap.empty) {
      return { statusCode: 200, body: JSON.stringify({ success: true, released: 0 }) };
    }

    const reservationIds = new Set<string>();
    await Promise.all(expiredSnap.docs.map(doc => {
      const reservationId = doc.data()['reservationId'];
      if (reservationId) reservationIds.add(reservationId);
      return doc.ref.update({
        status: 'free',
        reservationId: null,
        reservationTime: null,
        reservedUntil: null
      });
    }));

    await Promise.all(Array.from(reservationIds).map(id =>
      adminDb.collection('reservations').doc(id).update({ status: 'completed' }).catch(() => {})
    ));

    console.log(`[RELEASE-EXPIRED-RESERVATIONS] Liberadas ${expiredSnap.size} mesa(s)`);
    return { statusCode: 200, body: JSON.stringify({ success: true, released: expiredSnap.size }) };
  } catch (error) {
    console.error('[RELEASE-EXPIRED-RESERVATIONS] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false }) };
  }
};
