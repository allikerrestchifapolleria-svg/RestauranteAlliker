import type { Handler } from '@netlify/functions';

interface ConsultasPeruResponse {
  success: boolean;
  data?: {
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  };
}

export const handler: Handler = async (event, context) => {
  try {
    console.log('[CONSULTAR-DNI] Iniciando handler');

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ success: false, message: 'Método no permitido' }),
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
    console.log('[CONSULTAR-DNI] DNI recibido:', dni);

    if (!/^\d{8}$/.test(dni)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'DNI debe tener 8 dígitos' }),
      };
    }

    const token = process.env.CONSULTAS_PERU_TOKEN;
    console.log('[CONSULTAR-DNI] Token presente:', !!token);

    if (!token) {
      console.error('[CONSULTAR-DNI] Token no configurado');
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, message: 'Configuración de API incompleta' }),
      };
    }

    console.log('[CONSULTAR-DNI] Consultando API externa...');
    const apiResponse = await fetch('http://api.consultasperu.com/api/v1/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({ type: 'dni', document: dni }),
    });

    console.log('[CONSULTAR-DNI] Status API:', apiResponse.status);

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text().catch(() => '');
      console.error('[CONSULTAR-DNI] Error API:', apiResponse.status, errorText);
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: 'No se encontraron datos para el DNI ' + dni + '. Ingrese el nombre manualmente.',
        }),
      };
    }

    const data = (await apiResponse.json()) as ConsultasPeruResponse;
    console.log('[CONSULTAR-DNI] Respuesta:', JSON.stringify(data));

    if (!data.success || !data.data) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: 'No se encontraron datos para el DNI ' + dni + '. Ingrese el nombre manualmente.',
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
          message: 'No se encontraron datos para el DNI ' + dni + '. Ingrese el nombre manualmente.',
        }),
      };
    }

    console.log('[CONSULTAR-DNI] Nombre encontrado:', fullName);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, name: fullName }),
    };
  } catch (error) {
    console.error('[CONSULTAR-DNI] Error inesperado:', error);
    if (error instanceof Error) {
      console.error('[CONSULTAR-DNI] Stack:', error.stack);
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Error interno del servidor. Ingrese el nombre manualmente.',
      }),
    };
  }
};
