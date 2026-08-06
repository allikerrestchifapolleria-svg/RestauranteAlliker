import type { Handler } from '@netlify/functions';
import { requireStaff, HttpError } from './_firebase-admin';

interface ConsultasPeruResponse {
  success: boolean;
  data?: {
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  };
}

// Rate limit simple (best-effort): Netlify functions son efimeras/stateless, asi
// que este limite es por instancia y por memoria; no sustituye un rate limiter
// real (p. ej. en un WAF/CDN). Suficiente para frenar abuso trivial.
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function clientIp(event: { headers?: Record<string, string | undefined> }): string {
  const fwd = event.headers?.['x-forwarded-for'];
  if (fwd) {
    const first = fwd.split(',')[0].trim();
    if (first) return first;
  }
  return event.headers?.['x-real-ip'] || 'unknown';
}

export const handler: Handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ success: false, message: 'Método no permitido' }),
      };
    }

    // Solo el personal (staff) autenticado puede consultar DNI: evita abuso de la
    // API pagada y la enumeracion de datos personales desde internet.
    try {
      await requireStaff(event.headers.authorization);
    } catch (error) {
      if (error instanceof HttpError) {
        return {
          statusCode: error.statusCode,
          body: JSON.stringify({ success: false, message: error.message }),
        };
      }
      throw error;
    }

    if (rateLimited(clientIp(event))) {
      return {
        statusCode: 429,
        body: JSON.stringify({ success: false, message: 'Demasiadas consultas. Intente más tarde.' }),
      };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'JSON inválido' }),
      };
    }

    const dni = (body.dni || '').trim();

    if (!/^\d{8}$/.test(dni)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'DNI debe tener 8 dígitos' }),
      };
    }

    const token = process.env.CONSULTAS_PERU_TOKEN;

    if (!token) {
      console.error('[CONSULTAR-DNI] Token no configurado');
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: 'Configuración de API incompleta' }),
      };
    }

    const apiResponse = await fetch('https://api.consultasperu.com/api/v1/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({ type: 'dni', document: dni }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text().catch(() => '');
      console.error('[CONSULTAR-DNI] Error API:', apiResponse.status);
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: 'No se encontraron datos para el DNI. Ingrese el nombre manualmente.',
        }),
      };
    }

    const data = (await apiResponse.json()) as ConsultasPeruResponse;

    if (!data.success || !data.data) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: 'No se encontraron datos para el DNI. Ingrese el nombre manualmente.',
        }),
      };
    }

    const nombres = data.data.nombres || '';
    const apellidoPaterno = data.data.apellidoPaterno || '';
    const apellidoMaterno = data.data.apellidoMaterno || '';
    const fullName = [nombres, apellidoPaterno, apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .toUpperCase()
      .trim();

    if (!fullName) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: 'No se encontraron datos para el DNI. Ingrese el nombre manualmente.',
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, name: fullName }),
    };
  } catch (error) {
    console.error('[CONSULTAR-DNI] Error inesperado:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Error interno del servidor. Ingrese el nombre manualmente.',
      }),
    };
  }
};
