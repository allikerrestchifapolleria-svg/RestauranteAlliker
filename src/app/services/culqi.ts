import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare let Culqi: any;

export interface CulqiConfig {
  amount: number;
  currency?: string;
  email?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface CulqiCharge {
  id: string;
  object: string;
  creation_date: number;
  amount: number;
  currency_code: string;
  email: string;
  source_type: string;
  card_number: string;
  card_brand: string;
  card_type: string;
  outcome: {
    type: string;
    user_message: string;
    merchant_message: string;
  };
  metadata: Record<string, string>;
}

export interface CulqiResult {
  success: boolean;
  charge?: CulqiCharge;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CulqiService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (typeof Culqi === 'undefined') {
      console.warn('[CULQI] SDK no disponible. Asegurese de incluir el script de Culqi Checkout v4.');
      return;
    }
    Culqi.publicKey = environment.culqi.publicKey;
    Culqi.options = {
      lang: 'auto',
      modal: true,
      installments: true
    };
    this.initialized = true;
    console.log('[CULQI] Inicializado correctamente.');
  }

  async openCheckout(config: CulqiConfig): Promise<CulqiResult> {
    if (!this.initialized) {
      return { success: false, error: 'Culqi no esta inicializado. Verifique la conexion.' };
    }

    return new Promise((resolve) => {
      const settings: any = {
        title: config.title || 'Alliker - Pago de Pedido',
        amount: Math.round(config.amount * 100),
        currency: config.currency || 'PEN',
        description: config.description || `Pedido: ${config.metadata?.['orderId'] || ''}`,
        email: config.email || 'cliente@alliker.pe'
      };

      if (config.metadata && Object.keys(config.metadata).length > 0) {
        settings.metadata = config.metadata;
      }

      let resolved = false;

      const cleanup = () => {
        resolved = true;
        clearTimeout(timeoutId);
        document.removeEventListener('culqi', handleCulqiAction);
        window.removeEventListener('culqi_close', handleCulqiClose);
        document.removeEventListener('culqi_close', handleCulqiClose);
      };

      try {
        Culqi.settings(settings);
        Culqi.open();
      } catch (err) {
        console.error('[CULQI] Error al abrir checkout:', err);
        resolve({ success: false, error: 'Error al abrir el formulario de pago.' });
        return;
      }

      const handleCulqiAction = (event: any) => {
        if (resolved) return;
        cleanup();
        const token = event.detail;
        Culqi.token = token;
        Culqi.close();
        resolve({ success: true, charge: token });
      };

      const handleCulqiClose = () => {
        if (resolved) return;
        cleanup();
        console.log('[CULQI] Modal cerrado por el usuario.');
        resolve({ success: false, error: 'Modal de pago cerrado por el usuario.' });
      };

      const timeoutId = setTimeout(() => {
        if (resolved) return;
        cleanup();
        console.warn('[CULQI] Timeout alcanzado.');
        resolve({ success: false, error: 'Tiempo de espera agotado. Intente de nuevo.' });
      }, 120000);

      document.addEventListener('culqi', handleCulqiAction, { once: true });
      window.addEventListener('culqi_close', handleCulqiClose, { once: true });
      document.addEventListener('culqi_close', handleCulqiClose, { once: true });
    });
  }
}
