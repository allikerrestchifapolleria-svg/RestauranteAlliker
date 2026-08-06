import { Injectable } from '@angular/core';

const LOG_PREFIX = '[VOICE-CALL]';
const ATTEMPT_ID_LENGTH = 6;
const MAX_BODY_LENGTH = 1000;

/**
 * Claves cuyo valor no debe llegar a la consola. Para diagnosticar el 504 hace
 * falta la ESTRUCTURA del payload y los tiempos, no los datos personales del
 * cliente: se conserva lo primero y se enmascara lo segundo.
 */
const REDACTED_KEYS = [
  'customerphone', 'customeremail', 'customername',
  'phone', 'email', 'name', 'access_token', 'accesstoken'
];

/**
 * Trazas del flujo de confirmacion por voz.
 *
 * Cada intento recibe un id corto que acompaña a todas sus lineas. Sin el, los
 * logs del webhook, de Firestore y de los eventos del SDK de Retell se mezclan
 * y no hay forma de seguir un intento concreto.
 *
 * Los datos personales del cliente (telefono, email, nombre) y el access_token
 * se enmascaran antes de imprimirse: la consola del navegador es visible en
 * equipos compartidos y acaba en las capturas de soporte. Lo que hace falta para
 * perseguir el 504 --la estructura del payload y los tiempos-- se conserva
 * intacto (ver `redact`).
 */
@Injectable({ providedIn: 'root' })
export class VoiceCallLogger {

  private readonly startedAt = new Map<string, number>();

  startAttempt(): string {
    const attemptId = Math.random().toString(36).slice(2, 2 + ATTEMPT_ID_LENGTH);
    this.startedAt.set(attemptId, performance.now());
    console.info(`${LOG_PREFIX} ${attemptId} · inicio`, new Date().toISOString());
    return attemptId;
  }

  step(attemptId: string, phase: string, data?: unknown): void {
    console.info(`${LOG_PREFIX} ${attemptId} · ${phase} · ${this.elapsedLabel(attemptId)}`, this.redact(data) ?? '');
  }

  /**
   * Enmascara datos personales conservando la forma del objeto. Recorre en
   * profundidad porque el payload del webhook va anidado ({ url, payload }).
   */
  private redact(data: unknown): unknown {
    if (Array.isArray(data)) {
      return data.map(item => this.redact(item));
    }

    if (data === null || typeof data !== 'object') {
      return data;
    }

    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      output[key] = REDACTED_KEYS.includes(key.toLowerCase())
        ? '[oculto]'
        : this.redact(value);
    }
    return output;
  }

  failure(attemptId: string, phase: string, error: unknown): void {
    console.error(`${LOG_PREFIX} ${attemptId} · FALLO en ${phase} · ${this.elapsedLabel(attemptId)}`, error);
  }

  endAttempt(attemptId: string, outcome: string): void {
    console.info(`${LOG_PREFIX} ${attemptId} · fin (${outcome}) · ${this.elapsedLabel(attemptId)}`);
    this.startedAt.delete(attemptId);
  }

  /** Milisegundos desde que arranco el intento. Es el dato que identifica la causa
   *  del 504: cerca de 100 000 ms apunta al nodo Wait del Workflow 2. */
  elapsedMs(attemptId: string): number {
    const start = this.startedAt.get(attemptId);
    return start === undefined ? 0 : Math.round(performance.now() - start);
  }

  /** Recorta cuerpos largos: un 504 devuelve una pagina HTML entera. */
  truncate(body: string): string {
    return body.length > MAX_BODY_LENGTH
      ? `${body.slice(0, MAX_BODY_LENGTH)}… (${body.length} caracteres en total)`
      : body;
  }

  private elapsedLabel(attemptId: string): string {
    return `${this.elapsedMs(attemptId)} ms`;
  }
}
