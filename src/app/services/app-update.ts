import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

const LOG_PREFIX = '[APP-UPDATE]';

/**
 * Activa las versiones nuevas del service worker.
 *
 * Sin esto, el service worker de Angular descarga la version nueva pero sigue
 * sirviendo la vieja a las pestañas ya abiertas: se quedan con codigo antiguo
 * indefinidamente y cada despliegue parece no haber surtido efecto.
 *
 * La recarga se aplaza mientras algo importante este en curso (una llamada de
 * voz activa, un formulario a medio llenar) para no perder datos del usuario.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {

  private readonly swUpdate = inject(SwUpdate);
  private readonly router = inject(Router);

  private holdCount = 0;
  private reloadPending = false;

  start(): void {
    console.info(`${LOG_PREFIX} build activo:`, this.currentVersionLabel());

    if (!this.swUpdate.isEnabled) {
      console.info(`${LOG_PREFIX} service worker deshabilitado (modo desarrollo)`);
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(event => {
        console.info(`${LOG_PREFIX} version nueva lista`, {
          actual: event.currentVersion.hash,
          nueva: event.latestVersion.hash
        });
        this.swUpdate.activateUpdate().then(() => this.reloadWhenSafe());
      });

    // Red de seguridad: si la recarga quedo aplazada y el usuario navega a otra
    // pagina, ese es un momento seguro para aplicarla.
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.reloadPending) {
          this.reloadWhenSafe();
        }
      });
  }

  /** Impide recargar mientras dure una operacion que perderia datos. */
  holdReload(): void {
    this.holdCount += 1;
  }

  releaseReload(): void {
    this.holdCount = Math.max(0, this.holdCount - 1);
    if (this.reloadPending) {
      this.reloadWhenSafe();
    }
  }

  private reloadWhenSafe(): void {
    if (this.holdCount > 0) {
      this.reloadPending = true;
      console.info(`${LOG_PREFIX} recarga aplazada: hay ${this.holdCount} operación(es) en curso`);
      return;
    }

    console.info(`${LOG_PREFIX} recargando para aplicar la version nueva`);
    document.location.reload();
  }

  /**
   * Nombre del bundle principal, que lleva el hash del contenido. Es la forma
   * directa de saber que build esta ejecutando el navegador: si tras desplegar
   * sigue apareciendo el hash anterior, estas viendo caché vieja.
   */
  private currentVersionLabel(): string {
    const mainScript = document.querySelector<HTMLScriptElement>('script[src*="main-"]');
    return mainScript?.src.split('/').pop() ?? 'desconocido';
  }
}
