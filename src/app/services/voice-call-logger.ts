import { Injectable } from '@angular/core';

const LOG_PREFIX = '[VOICE-CALL]';
const ATTEMPT_ID_LENGTH = 6;
const MAX_BODY_LENGTH = 1000;

/**
 * Trazas del flujo de confirmacion por voz.
 *
 * Cada intento recibe un id corto que acompaña a todas sus lineas. Sin el, los
 * logs del webhook, de Firestore y de los eventos del SDK de Retell se mezclan
 * y no hay forma de seguir un intento concreto.
 *
 * NOTA: registra el payload completo, que incluye telefono y email del cliente.
 * Es deliberado mientras se persigue el 504 en produccion, porque el fallo no
 * se reproduce en local. Cuando el flujo este estable conviene reducirlo a
 * estructura y tiempos (ver `describePayload`).
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
    console.info(`${LOG_PREFIX} ${attemptId} · ${phase} · ${this.elapsedLabel(attemptId)}`, data ?? '');
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
