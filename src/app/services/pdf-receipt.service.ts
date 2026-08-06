import { Injectable } from '@angular/core';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any)['vfs'];

import { InvoiceData } from '../models/invoice';

@Injectable({ providedIn: 'root' })
export class PdfReceiptService {

  async generateReceiptPdf(invoice: InvoiceData): Promise<void> {
    const docDef = this.buildDocDefinition(invoice);
    const filename = `${invoice.documentType === '01' ? 'F' : 'B'}-${invoice.serieNumber.replace('-', '')}.pdf`;

    pdfMake.createPdf(docDef).download(filename);
  }

  private buildDocDefinition(invoice: InvoiceData): any {
    const c = invoice.company;
    const cust = invoice.customer;
    const title = invoice.documentType === '01' ? 'FACTURA ELECTRÓNICA' : 'BOLETA ELECTRÓNICA';
    const rucLabel = invoice.documentType === '01' ? 'RUC' : 'DNI';

    const header = [
      { text: title, style: 'title', alignment: 'center', margin: [0, 0, 0, 8] },
      { text: `N° ${invoice.serieNumber}`, style: 'subtitle', alignment: 'center', margin: [0, 0, 0, 12] },
    ];

    const companyInfo = [
      { text: c.businessName, style: 'companyName', margin: [0, 0, 0, 2] },
      { text: `RUC: ${c.ruc || '_________'}`, style: 'info', margin: [0, 0, 0, 2] },
      { text: c.address.street, style: 'info', margin: [0, 0, 0, 2] },
      { text: `${c.address.district}, ${c.address.province} - ${c.address.department}`, style: 'info', margin: [0, 0, 0, 2] },
      { text: `Tel: ${c.phone || '_________'}`, style: 'info', margin: [0, 0, 0, 2] },
      { text: `Email: ${c.email}`, style: 'info', margin: [0, 0, 0, 6] },
    ];

    const clientInfo = [
      { text: 'DATOS DEL CLIENTE', style: 'sectionTitle', margin: [0, 0, 0, 4] },
      {
        columns: [
          { width: '30%', text: `${rucLabel}:`, style: 'fieldLabel' },
          { width: '70%', text: cust.docNumber, style: 'fieldValue' }
        ], margin: [0, 0, 0, 2]
      },
      {
        columns: [
          { width: '30%', text: 'Nombre:', style: 'fieldLabel' },
          { width: '70%', text: cust.name, style: 'fieldValue' }
        ], margin: [0, 0, 0, 2]
      },
      ...(cust.address ? [{
        columns: [
          { width: '30%', text: 'Dirección:', style: 'fieldLabel' },
          { width: '70%', text: cust.address, style: 'fieldValue' }
        ], margin: [0, 0, 0, 6]
      }] : [{ text: '', margin: [0, 0, 0, 6] }])
    ];

    const tableBody = [
      [
        { text: '#', style: 'tableHeader', alignment: 'center' },
        { text: 'Producto', style: 'tableHeader' },
        { text: 'Cant.', style: 'tableHeader', alignment: 'center' },
        { text: 'P. Unit.', style: 'tableHeader', alignment: 'right' },
        { text: 'Total', style: 'tableHeader', alignment: 'right' }
      ],
      ...invoice.items.map(item => [
        { text: item.lineNumber.toString(), alignment: 'center', fontSize: 8 },
        { text: item.description, fontSize: 8 },
        { text: item.quantity.toString(), alignment: 'center', fontSize: 8 },
        { text: `S/ ${item.unitPriceWithoutIgv.toFixed(2)}`, alignment: 'right', fontSize: 8 },
        { text: `S/ ${item.totalPriceWithoutIgv.toFixed(2)}`, alignment: 'right', fontSize: 8 }
      ])
    ];

    const totalsTable = [
      [{ text: 'RESUMEN', style: 'tableHeader', colSpan: 2, alignment: 'center' }, {}],
      [
        { text: 'Subtotal (sin IGV)', style: 'totalsLabel' },
        { text: `S/ ${invoice.subtotal.toFixed(2)}`, style: 'totalsValue', alignment: 'right' }
      ],
      [
        { text: 'IGV (18%)', style: 'totalsLabel' },
        { text: `S/ ${invoice.igv.toFixed(2)}`, style: 'totalsValue', alignment: 'right' }
      ],
      [
        { text: 'TOTAL', style: 'totalsLabelBold' },
        { text: `S/ ${invoice.total.toFixed(2)}`, style: 'totalsValueBold', alignment: 'right' }
      ],
      [
        { text: 'Método de pago', style: 'totalsLabel' },
        { text: this.getPaymentLabel(invoice.paymentMethod), style: 'totalsValue', alignment: 'right' }
      ]
    ];

    const footer = [
      { text: `Fecha de emisión: ${invoice.issueDate} ${invoice.issueTime}`, style: 'footerText', alignment: 'center', margin: [0, 8, 0, 2] },
      { text: `Pedido: #${invoice.orderNumber || invoice.orderId.slice(-6)}`, style: 'footerText', alignment: 'center', margin: [0, 0, 0, 4] },
      { text: 'Gracias por su preferencia', style: 'footerThanks', alignment: 'center', margin: [0, 0, 0, 2] },
    ];

    return {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      content: [
        ...header,
        ...companyInfo,
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 0, 0, 6] },
        ...clientInfo,
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 0, 0, 6] },
        { text: 'DETALLE DE PRODUCTOS', style: 'sectionTitle', margin: [0, 0, 0, 4] },
        { table: { headerRows: 1, widths: [20, '*', 35, 55, 55], body: tableBody }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 8] },
        { table: { widths: ['*', 100], body: totalsTable }, layout: 'noBorders', margin: [0, 0, 0, 10] },
        ...footer,
      ],
      styles: {
        title: { fontSize: 14, bold: true, color: '#1a1a2e' },
        subtitle: { fontSize: 11, bold: true, color: '#e94560' },
        companyName: { fontSize: 12, bold: true, color: '#16213e' },
        info: { fontSize: 8, color: '#666666' },
        sectionTitle: { fontSize: 9, bold: true, color: '#1a1a2e', decoration: 'underline' },
        fieldLabel: { fontSize: 8, bold: true, color: '#444444' },
        fieldValue: { fontSize: 8, color: '#333333' },
        tableHeader: { fontSize: 8, bold: true, color: '#ffffff', fillColor: '#16213e', margin: [3, 3, 3, 3] },
        totalsLabel: { fontSize: 9, color: '#444444', margin: [0, 2, 0, 2] },
        totalsValue: { fontSize: 9, color: '#333333', margin: [0, 2, 0, 2] },
        totalsLabelBold: { fontSize: 10, bold: true, color: '#1a1a2e', margin: [0, 3, 0, 3] },
        totalsValueBold: { fontSize: 10, bold: true, color: '#e94560', margin: [0, 3, 0, 3] },
        footerText: { fontSize: 7, color: '#999999' },
        footerThanks: { fontSize: 9, italic: true, color: '#666666' },
      },
      defaultStyle: {
        font: 'Roboto'
      }
    };
  }

  private getPaymentLabel(method: string): string {
    const labels: Record<string, string> = {
      card: 'Tarjeta (Culqi)',
      cash: 'Efectivo',
      yape: 'Yape'
    };
    return labels[method] || method;
  }
}
