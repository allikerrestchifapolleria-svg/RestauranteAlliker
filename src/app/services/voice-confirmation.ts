import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

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

const PENDING_STATUS = 'pending';

/**
 * Unico punto de contacto con el webhook de n8n que inicia la llamada de voz.
 * Vive fuera del componente para que la pagina de reservas no conozca detalles
 * del transporte ni del formato que espera el workflow.
 */
@Injectable({ providedIn: 'root' })
export class VoiceConfirmationService {

  /**
   * Pide el access_token con el que el navegador abre la llamada de Retell.
   *
   * El Workflow 2 no responde hasta que su nodo Wait alcanza `fecha_alerta`
   * (la hora de la reserva menos un minuto). Si esa espera supera el timeout
   * del gateway de n8n, la peticion muere con 504 en vez de devolver el token.
   */
  async requestAccessToken(request: VoiceConfirmationRequest): Promise<string> {
    const response = await fetch(environment.n8n.createReservationWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.toWebhookPayload(request))
    });

    if (!response.ok) {
      throw new Error(`El webhook de n8n respondio ${response.status} ${response.statusText}`);
    }

    const body = await response.json().catch(() => null);
    if (!body?.access_token) {
      throw new Error('El webhook de n8n no devolvio un access_token');
    }

    return body.access_token;
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
