import type { Handler } from '@netlify/functions';
import { createHash } from 'crypto';
import { requireAdmin, HttpError } from './_firebase-admin';

const ALLOWED_FOLDERS = ['menu_items', 'promotions'];

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

    const { folder } = body;
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Carpeta invalida' }) };
    }

    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!apiKey || !apiSecret || !cloudName) {
      throw new Error('Cloudinary no esta configurado en las variables de entorno de Netlify');
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = createHash('sha1').update(paramsToSign + apiSecret).digest('hex');

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, signature, timestamp, apiKey, cloudName, folder }),
    };
  } catch (error: any) {
    if (error instanceof HttpError) {
      return { statusCode: error.statusCode, body: JSON.stringify({ success: false, message: error.message }) };
    }
    console.error('[CLOUDINARY-SIGN] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Error interno del servidor' }) };
  }
};
