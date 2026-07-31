import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { VoiceCallLogger } from './voice-call-logger';

/**
 * Datos que el Workflow 2 de n8n necesita para pedirle a Retell la llamada de
 * confirmacion. Es el contrato entre la app y ese workflow.
 */
export interface VoiceConfirmationRequest {
  reservationId: string;
  branchId: string;
  branchName: string;
  tableId: string;
  tableName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  /** Formato YYYY-MM-DD, tal cual lo escribe el formulario. */
  date: string;
  /** Formato HH:MM, tal cual lo escribe el formulario. */
  time: string;
  peopleCount: number;
  specialRequests: string;
}

/** Error del webhook con el codigo HTTP, para que la UI explique la causa real. */
export class VoiceConfirmationError extends Error {
  constructor(message: string, readonly status: number | null, readonly responseBody = '') {
    super(message);
    this.name = 'VoiceConfirmationError';
  }
}

const PENDING_STATUS = 'pending';

/**
 * Por encima del timeout del gateway de n8n (~100 s). Si se agota este, es que
 * ni siquiera el gateway respondio: problema de red o de DNS, no del workflow.
 */
const REQUEST_TIMEOUT_MS = 110_000;

/** Codigo sintetico para el aborto local, que no tiene status HTTP propio. */
export const TIMEOUT_STATUS = 0;

/**
 * Unico punto de contacto con el webhook de n8n que inicia la llamada de voz.
 * Vive fuera del componente para que la pagina de reservas no conozca detalles
 * del transporte ni del formato que espera el workflow.
 */
@Injectable({ providedIn: 'root' })
export class VoiceConfirmationService {

  private readonly logger = inject(VoiceCallLogger);

  /**
   * Pide el access_token con el que el navegador abre la llamada de Retell.
   *
   * El Workflow 2 no responde hasta que su nodo Wait alcanza `fecha_alerta`
   * (la hora de la reserva menos un minuto). Si esa espera supera el timeout
   * del gateway de n8n, la peticion muere con 504 en vez de devolver el token.
   */
  async requestAccessToken(request: VoiceConfirmationRequest, attemptId: string): Promise<string> {
    const url = environment.n8n.createReservationWebhook;
    const payload = this.toWebhookPayload(request);

    this.logger.step(attemptId, 'webhook-request', { url, payload });

    const response = await this.postWithTimeout(url, payload, attemptId);

    // Se lee como texto antes de parsear: un 504 devuelve una pagina HTML de
    // error y `response.json()` reventaria con "Unexpected end of JSON input",
    // ocultando el cuerpo real que explica el fallo.
    const rawBody = await response.text();

    this.logger.step(attemptId, 'webhook-response', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      body: this.logger.truncate(rawBody)
    });

    if (!response.ok) {
      throw new VoiceConfirmationError(
        `El webhook de n8n respondio ${response.status} ${response.statusText}`,
        response.status,
        rawBody
      );
    }

    const accessToken = this.extractAccessToken(rawBody, attemptId);
    this.logger.step(attemptId, 'access-token-recibido', { length: accessToken.length });
    return accessToken;
  }

  private async postWithTimeout(
    url: string,
    payload: Record<string, unknown>,
    attemptId: string
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new VoiceConfirmationError(
          `La peticion al webhook se abortó tras ${REQUEST_TIMEOUT_MS} ms sin respuesta`,
          TIMEOUT_STATUS
        );
      }
      // Un fallo de red aqui suele ser CORS o DNS: el navegador no da detalle.
      this.logger.failure(attemptId, 'webhook-network', error);
      throw new VoiceConfirmationError(
        'No se pudo contactar con el webhook de n8n (red, DNS o CORS)',
        null
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractAccessToken(rawBody: string, attemptId: string): string {
    let parsed: { access_token?: string } | null = null;

    try {
      parsed = JSON.parse(rawBody);
    } catch (error) {
      this.logger.failure(attemptId, 'webhook-json-invalido', error);
      throw new VoiceConfirmationError('El webhook de n8n no devolvio JSON valido', null, rawBody);
    }

    if (!parsed?.access_token) {
      throw new VoiceConfirmationError(
        'El webhook de n8n no devolvio un access_token',
        null,
        rawBody
      );
    }

    return parsed.access_token;
  }

  /**
   * El nodo `Code` del Workflow 2 lee estas claves por nombre. Renombrar
   * cualquiera rompe el flujo en n8n sin producir ningun error en el navegador:
   * la llamada arranca igual, pero Daniela recibe variables vacias.
   */
  private toWebhookPayload(request: VoiceConfirmationRequest): Record<string, unknown> {
    return {
      id: request.reservationId,
      branchId: request.branchId,
      branchName: request.branchName,
      tableId: request.tableId,
      tableName: request.tableName,
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      customerEmail: request.customerEmail,
      date: request.date,
      time: request.time,
      peopleCount: request.peopleCount,
      specialRequests: request.specialRequests,
      status: PENDING_STATUS
    };
  }
}
