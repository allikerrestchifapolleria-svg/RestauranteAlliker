import { Injectable } from '@angular/core';
import { InvoiceData } from '../models/invoice';
import { numeroALetras } from '../utils/numero-a-letras';
import type { Receipt } from './payment';
import QRCode from 'qrcode';

@Injectable({ providedIn: 'root' })
export class TicketPrintService {

  async printThermalTicket(invoice: InvoiceData): Promise<void> {
    try {
      const qrDataUrl = await this.generarQRDataURL(invoice);
      console.log('[TICKET] QR:', qrDataUrl ? 'OK (' + qrDataUrl.length + ' bytes)' : 'FALLBACK');
      const html = this.buildTicketHtml(invoice, qrDataUrl);
      const printWindow = window.open('', '_blank', 'width=380,height=600,menubar=no,toolbar=no,location=no,status=no');

      if (!printWindow) {
        console.error('[TICKET] No se pudo abrir la ventana de impresión. Posible bloqueo de popups.');
        return;
      }

      let printed = false;

      printWindow.onload = () => {
        try {
          if (printed) return;
          printed = true;
          printWindow.focus();
          printWindow.print();
        } catch (err) {
          console.error('[TICKET] Error al ejecutar print():', err);
        }
      };

      printWindow.document.write(html);
      printWindow.document.close();

      setTimeout(() => {
        try {
          if (printed) return;
          printed = true;
          printWindow.focus();
          printWindow.print();
        } catch (err) {
          console.error('[TICKET] Error en fallback de print():', err);
        }
      }, 1500);

        setTimeout(() => {
        try {
          if (printWindow && !printWindow.closed) {
            printWindow.close();
          }
        } catch (err) {
          console.warn('[TICKET] No se pudo cerrar la ventana automáticamente:', err);
        }
      }, 12000);
    } catch (error) {
      console.error('[TICKET] Error generando ticket térmico:', error);
      if (error instanceof Error) {
        console.error('[TICKET] Stack:', error.stack);
      }
    }
  }

  private generarCadenaQR(invoice: InvoiceData): string {
    try {
      const c = invoice.company;
      const cust = invoice.customer;
      const isFactura = invoice.documentType === '01';
      const tipoComprobante = invoice.documentType;
      const tipoDocCliente = isFactura
        ? '6'
        : (cust.docNumber === '00000000' ? '0' : '1');
      const numDocCliente = cust.docNumber || '00000000';
      const fecha = invoice.issueDate || '';
      const igv = (invoice.igv != null ? invoice.igv : 0).toFixed(2);
      const total = (invoice.total != null ? invoice.total : 0).toFixed(2);
      const hash = invoice.xmlHash || '';
      // Serie y correlativo van en campos separados según el Anexo 7-A de la RS 097-2012/SUNAT
      const [serie, correlativo] = (invoice.serieNumber || '').split('-');

      return [c.ruc, tipoComprobante, serie || '', correlativo || '', igv, total, fecha, tipoDocCliente, numDocCliente, hash].join('|');
    } catch (error) {
      console.error('[TICKET] Error generando cadena SUNAT para QR:', error);
      if (error instanceof Error) {
        console.error('[TICKET] Stack:', error.stack);
      }
      return '';
    }
  }

  private async generarQRDataURL(invoice: InvoiceData): Promise<string> {
    try {
      const cadena = this.generarCadenaQR(invoice);
      if (!cadena) {
        console.warn('[TICKET] Cadena QR vacía, no se puede generar QR');
        return '';
      }
      return await QRCode.toDataURL(cadena, {
        width: 180,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (error) {
      console.error('[TICKET] Error generando imagen QR:', error);
      if (error instanceof Error) {
        console.error('[TICKET] Stack:', error.stack);
      }
      return '';
    }
  }

  private buildTicketHtml(invoice: InvoiceData, qrDataUrl: string = ''): string {
    const c = invoice.company;
    const cust = invoice.customer;
    const isBoleta = invoice.documentType === '03';
    const title = isBoleta ? 'BOLETA DE VENTA ELECTRÓNICA' : 'FACTURA ELECTRÓNICA';
    const docLabel = isBoleta ? 'DNI' : 'RUC';
    const docNumber = cust.docNumber;
    const docName = cust.name || 'Clientes Varios';
    const totalLetras = numeroALetras(invoice.total);

    const addressHtml = (!isBoleta && cust.address)
      ? '<div class="row"><span>Dirección:</span><span>' + cust.address + '</span></div>'
      : '';

    const qrHtml = qrDataUrl
      ? '<img src="' + qrDataUrl + '" alt="Código QR SUNAT" style="width:130px;height:130px;display:block;margin:0 auto;" />'
      : '<div style="font-size:8px;text-align:center;color:#999;padding:8px 0;">[QR No disponible - Error de datos]</div>';

    const itemsRows = invoice.items.map(item => {
      const descLines = this.wrapText(item.description || '', 28);
      const firstLine = descLines[0] || '';
      const restLines = descLines.slice(1);

      const cant = String(item.quantity || 0);
      const pu = (item.unitPriceWithoutIgv || 0).toFixed(2);
      const imp = (item.totalPriceWithIgv || 0).toFixed(2);

      let row = '<tr>\n        <td class="cant">' + cant + '</td>\n        <td class="desc">' + firstLine + '</td>\n        <td class="pu">' + pu + '</td>\n        <td class="imp">' + imp + '</td>\n      </tr>';

      for (const line of restLines) {
        row += '\n        <tr>\n          <td class="cant"></td>\n          <td class="desc">' + line + '</td>\n          <td class="pu"></td>\n          <td class="imp"></td>\n        </tr>';
      }

      return row;
    }).join('\n');

    const phoneHtml = c.phone
      ? '<div class="line">Tel: ' + c.phone + '</div>'
      : '';

    const docNumDisplay = docNumber || '00000000';

    return '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>' + title + '</title>\n<style>\n  @page { width: 80mm; margin: 0; padding: 0; }\n  * { margin: 0; padding: 0; box-sizing: border-box; }\n  body {\n    font-family: \'Courier New\', \'Courier\', monospace;\n    font-size: 10px;\n    width: 72mm;\n    margin: 0 auto;\n    padding: 3mm 2mm;\n    color: #000;\n    background: #fff;\n    line-height: 1.3;\n  }\n  .center { text-align: center; }\n  .header { margin-bottom: 4px; }\n  .header .title { font-size: 14px; font-weight: bold; }\n  .header .subtitle { font-size: 10px; }\n  .header .line { font-size: 9px; }\n  .divider {\n    text-align: center;\n    font-size: 10px;\n    letter-spacing: 2px;\n    margin: 4px 0;\n    border-top: 1px dashed #000;\n    padding-top: 4px;\n  }\n  .doc-type-box {\n    border: 2px solid #000;\n    padding: 4px 8px;\n    text-align: center;\n    font-weight: bold;\n    font-size: 11px;\n    margin: 4px 0;\n    display: inline-block;\n    width: auto;\n  }\n  .receipt-info { font-size: 9px; margin: 4px 0; }\n  .receipt-info .row { display: flex; justify-content: space-between; }\n  table { width: 100%; border-collapse: collapse; font-size: 8px; margin: 4px 0; }\n  th {\n    border-top: 1px dashed #000;\n    border-bottom: 1px dashed #000;\n    padding: 2px 1px;\n    font-size: 7px;\n    text-align: left;\n  }\n  th.cant { width: 10%; text-align: center; }\n  th.desc { width: 52%; }\n  th.pu { width: 18%; text-align: right; }\n  th.imp { width: 20%; text-align: right; }\n  td { padding: 1px; vertical-align: top; }\n  td.cant { text-align: center; white-space: nowrap; }\n  td.desc { word-wrap: break-word; max-width: 0; }\n  td.pu { text-align: right; white-space: nowrap; }\n  td.imp { text-align: right; white-space: nowrap; }\n  .totals { font-size: 9px; margin: 4px 0; }\n  .totals .row { display: flex; justify-content: space-between; padding: 1px 0; }\n  .totals .total { font-weight: bold; font-size: 11px; border-top: 1px dashed #000; padding-top: 2px; margin-top: 2px; }\n  .totals .total-text { font-size: 8px; font-weight: bold; text-align: center; margin-top: 2px; }\n  .qr-box {\n    width: 36mm;\n    height: 36mm;\n    margin: 1rem auto 1.5rem;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 100%;\n  }\n  .legal { display: block; font-size: 0.7rem; text-align: center; margin: 4px 0; color: #333; line-height: 1.4; }\n  .thanks { font-size: 10px; font-weight: bold; text-align: center; margin-top: 6px; }\n  @media print {\n    body { margin: 0; padding: 2mm; }\n  }\n</style>\n</head>\n<body>\n\n<div class="header center">\n  <div class="title">' + (c.commercialName || c.businessName || 'RESTAURANTE - CHIFA - POLLERÍA') + '</div>\n  ' + (c.businessName && c.businessName !== c.commercialName ? '<div class="subtitle">' + c.businessName + '</div>' : '') + '\n  ' + (c.ownerName ? '<div class="subtitle">' + c.ownerName + '</div>' : '') + '\n  <div class="line">RUC: ' + c.ruc + '</div>\n  <div class="line">' + c.address.street + (c.address.district ? ' - ' + c.address.district : '') + (c.address.province ? ' - ' + c.address.province : '') + (c.address.department ? ' - ' + c.address.department : '') + '</div>\n  ' + phoneHtml + '\n</div>\n\n<div class="divider"></div>\n\n<div class="center">\n  <div class="doc-type-box">' + title + '</div>\n  <div style="font-size:9px;font-weight:bold;margin:2px 0;">' + invoice.serieNumber + '</div>\n</div>\n\n<div class="receipt-info">\n  <div class="row"><span>Fecha:</span><span>' + invoice.issueDate + ' ' + invoice.issueTime + '</span></div>\n  <div class="row"><span>Cliente:</span><span>' + docName + '</span></div>\n  <div class="row"><span>' + docLabel + ':</span><span>' + docNumDisplay + '</span></div>\n  ' + addressHtml + '\n  <div class="row"><span>Pedido:</span><span>#' + (invoice.orderNumber || invoice.orderId.slice(-6)) + '</span></div>\n</div>\n\n<div class="divider"></div>\n\n<table>\n  <thead>\n    <tr>\n      <th class="cant">CANT</th>\n      <th class="desc">DESCRIPCIÓN</th>\n      <th class="pu">P.U.</th>\n      <th class="imp">IMPORTE</th>\n    </tr>\n  </thead>\n  <tbody>\n' + itemsRows + '\n  </tbody>\n</table>\n\n<div class="divider"></div>\n\n<div class="totals">\n  <div class="row"><span>Subtotal:</span><span>S/ ' + invoice.subtotal.toFixed(2) + '</span></div>\n  <div class="row"><span>IGV (18%):</span><span>S/ ' + invoice.igv.toFixed(2) + '</span></div>\n  <div class="row total"><span>TOTAL:</span><span>S/ ' + invoice.total.toFixed(2) + '</span></div>\n  <div class="total-text">SON: ' + totalLetras + ' SOLES</div>\n</div>\n\n<div class="divider"></div>\n\n<div class="qr-box">\n  ' + qrHtml + '\n</div>\n\n<div class="legal">\n  Representación impresa de la ' + title.toLowerCase() + '.<br>\n  ' + c.businessName + ' - ' + c.email + '\n</div>\n\n<div class="thanks">¡Gracias por Elegirnos...!</div>\n\n</body>\n</html>';
  }

  printSimpleTicket(receipt: Receipt): void {
    try {
      const html = this.buildSimpleReceiptHtml(receipt);
      const printWindow = window.open('', '_blank', 'width=380,height=600,menubar=no,toolbar=no,location=no,status=no');

      if (!printWindow) {
        console.error('[TICKET] No se pudo abrir la ventana de impresión.');
        return;
      }

      let printed = false;

      printWindow.onload = () => {
        try {
          if (printed) return;
          printed = true;
          printWindow.focus();
          printWindow.print();
        } catch (err) {
          console.error('[TICKET] Error al ejecutar print():', err);
        }
      };

      printWindow.document.write(html);
      printWindow.document.close();

      setTimeout(() => {
        try {
          if (printed) return;
          printed = true;
          printWindow.focus();
          printWindow.print();
        } catch (err) {
          console.error('[TICKET] Error en fallback de print():', err);
        }
      }, 1500);

      setTimeout(() => {
        try {
          if (printWindow && !printWindow.closed) {
            printWindow.close();
          }
        } catch (err) {
          console.warn('[TICKET] No se pudo cerrar la ventana automáticamente:', err);
        }
      }, 12000);
    } catch (error) {
      console.error('[TICKET] Error generando ticket simple:', error);
      if (error instanceof Error) {
        console.error('[TICKET] Stack:', error.stack);
      }
    }
  }

  private buildSimpleReceiptHtml(r: Receipt): string {
    const itemsRows = r.items.map(item =>
      '<tr>\n        <td class="cant">' + item.quantity + '</td>\n        <td class="desc">' + item.name + '</td>\n        <td class="pu">' + item.price.toFixed(2) + '</td>\n        <td class="imp">' + (item.price * item.quantity).toFixed(2) + '</td>\n      </tr>'
    ).join('\n');

    const methodLabel: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      yape: 'Yape'
    };

    return '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>Recibo</title>\n<style>\n  @page { width: 80mm; margin: 0; padding: 0; }\n  * { margin: 0; padding: 0; box-sizing: border-box; }\n  body {\n    font-family: \'Courier New\', \'Courier\', monospace;\n    font-size: 10px;\n    width: 72mm;\n    margin: 0 auto;\n    padding: 3mm 2mm;\n    color: #000;\n    background: #fff;\n    line-height: 1.3;\n  }\n  .center { text-align: center; }\n  .header { margin-bottom: 4px; }\n  .header .title { font-size: 14px; font-weight: bold; }\n  .header .line { font-size: 9px; }\n  .divider {\n    text-align: center;\n    font-size: 10px;\n    letter-spacing: 2px;\n    margin: 4px 0;\n    border-top: 1px dashed #000;\n    padding-top: 4px;\n  }\n  .receipt-info { font-size: 9px; margin: 4px 0; }\n  .receipt-info .row { display: flex; justify-content: space-between; }\n  table { width: 100%; border-collapse: collapse; font-size: 8px; margin: 4px 0; }\n  th {\n    border-top: 1px dashed #000;\n    border-bottom: 1px dashed #000;\n    padding: 2px 1px;\n    font-size: 7px;\n    text-align: left;\n  }\n  th.cant { width: 10%; text-align: center; }\n  th.desc { width: 52%; }\n  th.pu { width: 18%; text-align: right; }\n  th.imp { width: 20%; text-align: right; }\n  td { padding: 1px; vertical-align: top; }\n  td.cant { text-align: center; white-space: nowrap; }\n  td.desc { word-wrap: break-word; max-width: 0; }\n  td.pu { text-align: right; white-space: nowrap; }\n  td.imp { text-align: right; white-space: nowrap; }\n  .totals { font-size: 9px; margin: 4px 0; }\n  .totals .row { display: flex; justify-content: space-between; padding: 1px 0; }\n  .totals .total { font-weight: bold; font-size: 11px; border-top: 1px dashed #000; padding-top: 2px; margin-top: 2px; }\n  .thanks { font-size: 10px; font-weight: bold; text-align: center; margin-top: 6px; }\n  @media print {\n    body { margin: 0; padding: 2mm; }\n  }\n</style>\n</head>\n<body>\n\n<div class="header center">\n  <div class="title">RESTAURANT - CHIFA - POLLERÍA</div>\n  <div class="title">"ALLIKER"</div>\n  <div class="line">RUC: 10425772045</div>\n</div>\n\n<div class="divider"></div>\n\n<div class="center" style="font-size:9px;font-weight:bold;margin:2px 0;">COMPROBANTE DE PAGO</div>\n\n<div class="receipt-info">\n  <div class="row"><span>Recibo:</span><span>#' + r.id + '</span></div>\n  <div class="row"><span>Fecha:</span><span>' + r.timestamp.toLocaleDateString() + ' ' + r.timestamp.toLocaleTimeString() + '</span></div>\n  <div class="row"><span>Pedido:</span><span>#' + r.orderId.slice(-6) + '</span></div>\n  <div class="row"><span>Cliente:</span><span>Clientes Varios</span></div>\n</div>\n\n<div class="divider"></div>\n\n<table>\n  <thead>\n    <tr>\n      <th class="cant">CANT</th>\n      <th class="desc">DESCRIPCIÓN</th>\n      <th class="pu">P.U.</th>\n      <th class="imp">IMPORTE</th>\n    </tr>\n  </thead>\n  <tbody>\n' + itemsRows + '\n  </tbody>\n</table>\n\n<div class="divider"></div>\n\n<div class="totals">\n  <div class="row"><span>Subtotal:</span><span>S/ ' + r.subtotal.toFixed(2) + '</span></div>\n  <div class="row"><span>IGV (18%):</span><span>S/ ' + r.tax.toFixed(2) + '</span></div>\n  <div class="row total"><span>TOTAL:</span><span>S/ ' + r.total.toFixed(2) + '</span></div>\n  <div class="row"><span>Método:</span><span>' + (methodLabel[r.paymentMethod] || r.paymentMethod) + '</span></div>\n  ' + (r.paymentAmount > 0 && r.change !== undefined ? '<div class="row"><span>Vuelto:</span><span>S/ ' + r.change.toFixed(2) + '</span></div>' : '') + '\n</div>\n\n<div class="divider"></div>\n\n<div class="thanks">¡Gracias por Elegirnos...!</div>\n\n</body>\n</html>';
  }

  private wrapText(text: string, maxChars: number): string[] {
    if (!text) return [''];
    const lines: string[] = [];
    let current = '';
    for (const word of text.split(' ')) {
      if ((current + ' ' + word).trim().length <= maxChars) {
        current = (current + ' ' + word).trim();
      } else {
        if (current) lines.push(current);
        current = word;
        if (current.length > maxChars) {
          while (current.length > maxChars) {
            lines.push(current.substring(0, maxChars));
            current = current.substring(maxChars);
          }
        }
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }
}
