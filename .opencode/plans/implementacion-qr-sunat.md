# Implementacion QR Dinamico SUNAT para Ticket Termico

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `package.json` | Se agrego dependencia `qrcode` + `@types/qrcode` |
| `src/app/services/ticket-print.service.ts` | Nuevos metodos `generarCadenaQR`, `generarQRDataURL`; `printThermalTicket` async; `buildTicketHtml` recibe `qrDataUrl` |
| `src/app/modules/waiter/payment/payment.ts` | Agregar `await` en lineas 654 y 682; `printReceipt()` pasa a `async` |

---

## Detalle de Implementacion

### 1. `src/app/services/ticket-print.service.ts`

**Import:**
```typescript
import QRCode from 'qrcode';
```

**`printThermalTicket` cambiar firma:**
```typescript
async printThermalTicket(invoice: InvoiceData): Promise<void> {
```
Dentro del try-block, antes de `const html = this.buildTicketHtml(invoice);` agregar:
```typescript
const qrDataUrl = await this.generarQRDataURL(invoice);
const html = this.buildTicketHtml(invoice, qrDataUrl);
```

**Nuevo metodo `generarCadenaQR`:**
```typescript
private generarCadenaQR(invoice: InvoiceData): string {
  try {
    const c = invoice.company;
    const cust = invoice.customer;
    const isFactura = invoice.documentType === '01';
    const tipoDocCliente = isFactura
      ? '6'
      : (cust.docNumber === '00000000' ? '0' : '1');
    const numDocCliente = cust.docNumber || '00000000';
    const igv = (invoice.igv != null ? invoice.igv : 0).toFixed(2);
    const total = (invoice.total != null ? invoice.total : 0).toFixed(2);
    const hash = invoice.xmlHash || '---';
    return `${c.ruc}|${invoice.documentType}|${invoice.serieNumber}|${igv}|${total}|${invoice.issueDate || ''}|${tipoDocCliente}|${numDocCliente}|${hash}|`;
  } catch (error) {
    console.error('[TICKET] Error generando cadena SUNAT:', error);
    if (error instanceof Error) console.error('[TICKET] Stack:', error.stack);
    return '';
  }
}
```

**Nuevo metodo `generarQRDataURL`:**
```typescript
private async generarQRDataURL(invoice: InvoiceData): Promise<string> {
  try {
    const cadena = this.generarCadenaQR(invoice);
    if (!cadena) {
      console.warn('[TICKET] Cadena QR vacia');
      return '';
    }
    return await QRCode.toDataURL(cadena, {
      width: 180,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (error) {
    console.error('[TICKET] Error generando QR:', error);
    if (error instanceof Error) console.error('[TICKET] Stack:', error.stack);
    return '';
  }
}
```

**`buildTicketHtml` cambiar firma:**
```typescript
private buildTicketHtml(invoice: InvoiceData, qrDataUrl: string = ''): string {
```

Agregar variable cerca del inicio del metodo:
```typescript
const qrHtml = qrDataUrl
  ? `<img src="${qrDataUrl}" alt="Codigo QR SUNAT" style="width:180px;height:180px;display:block;margin:0 auto;" />`
  : `<div style="font-size:8px;text-align:center;color:#999;padding:8px 0;">[QR No disponible - Error de datos]</div>`;
```

Reemplazar bloque QR placeholder (lineas 242-247):
```html
<div class="qr-box">
  ${qrHtml}
</div>
```

CSS `.qr-box` actualizado (lineas 171-182):
```css
.qr-box {
  width: 36mm;
  height: 36mm;
  margin: 6px auto 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 2. `src/app/modules/waiter/payment/payment.ts`

Linea 654: `await this.ticketPrint.printThermalTicket(invoiceData);`

Linea 674: cambiar `printReceipt()` a `async printReceipt()`.

Linea 682: `await this.ticketPrint.printThermalTicket(this.lastInvoiceData);`

---

## Formato SUNAT QR

`RUC_EMISOR|TIPO_COMPROBANTE|SERIE_CORRELATIVO|IGV|TOTAL|FECHA|TIPO_DOC_CLIENTE|NUM_DOC_CLIENTE|HASH|`

| Campo | Fuente | Logica |
|-------|--------|--------|
| RUC | `company.ruc` | Directo |
| TIPO_COMPROBANTE | `documentType` | `'01'` Factura, `'03'` Boleta |
| SERIE | `serieNumber` | Ej: F001-00000123 |
| IGV | `igv.toFixed(2)` | 2 decimales |
| TOTAL | `total.toFixed(2)` | 2 decimales |
| FECHA | `issueDate` | Formato YYYY-MM-DD |
| TIPO_DOC_CLIENTE | Logica | Factura=`'6'`, Boleta con DNI=`'1'`, Boleta sin DNI=`'0'` |
| NUM_DOC_CLIENTE | `customer.docNumber` | Fallback `'00000000'` |
| HASH | `xmlHash` | Fallback `'---'` |

## Resiliencia (Skill Arquitectura Resiliente)

- Todo el flujo QR esta envuelto en try-catch
- Si `generarCadenaQR` falla, retorna `''` y se muestra "[QR No disponible - Error de datos]"
- Si `QRCode.toDataURL` falla, retorna `''` con console.error + stack
- Si `printThermalTicket` completo falla, el catch externo ya existente lo captura
- La aplicacion nunca se rompe por error en el QR
