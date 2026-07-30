import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoiceService } from '../../../services/invoice.service';
import { PdfReceiptService } from '../../../services/pdf-receipt.service';
import { TicketPrintService } from '../../../services/ticket-print.service';
import { InvoiceData, SUNAT_DOC_TYPES, DOC_TYPE_CODES } from '../../../models/invoice';

@Component({
  selector: 'app-invoices',
  imports: [CommonModule, FormsModule],
  templateUrl: './invoices.html',
  styleUrl: './invoices.css'
})
export class Invoices implements OnInit {
  invoices: InvoiceData[] = [];
  loading = true;
  searchTerm = '';
  selectedDocType = '';

  constructor(
    private invoiceService: InvoiceService,
    private pdfService: PdfReceiptService,
    private ticketPrint: TicketPrintService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log('[INVOICES] ngOnInit - suscribiendose a getInvoices()');
    this.invoiceService.getInvoices().subscribe({
      next: (data) => {
        console.log('[INVOICES] Comprobantes recibidos:', data?.length ?? 0, data);
        this.ngZone.run(() => {
          this.invoices = data || [];
          this.loading = false;
          this.cdr.detectChanges();
          console.log('[INVOICES] loading = false (vista actualizada)');
        });
      },
      error: (err) => {
        console.error('[INVOICES] ERROR al cargar comprobantes:', err);
        this.ngZone.run(() => {
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  get filteredInvoices(): InvoiceData[] {
    let list = this.invoices;
    if (this.selectedDocType) {
      list = list.filter(i => i.documentType === this.selectedDocType);
    }
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(i =>
        i.serieNumber.toLowerCase().includes(term) ||
        i.customer?.name.toLowerCase().includes(term) ||
        i.customer?.docNumber.includes(term)
      );
    }
    return list;
  }

  getDocTypeLabel(type: string): string {
    return SUNAT_DOC_TYPES[type as keyof typeof SUNAT_DOC_TYPES] || type;
  }

  getDocCodeLabel(code: string): string {
    return DOC_TYPE_CODES[code as keyof typeof DOC_TYPE_CODES] || code;
  }

  getSunatStatusClass(status?: string): string {
    const classes: Record<string, string> = {
      pending: 'status-pending',
      sent: 'status-sent',
      accepted: 'status-accepted',
      rejected: 'status-rejected'
    };
    return classes[status || 'pending'] || 'status-pending';
  }

  getSunatStatusIcon(status?: string): string {
    const icons: Record<string, string> = {
      pending: 'fa-clock',
      sent: 'fa-paper-plane',
      accepted: 'fa-circle-check',
      rejected: 'fa-circle-xmark'
    };
    return icons[status || 'pending'] || 'fa-clock';
  }

  getSunatStatusLabel(status?: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      sent: 'Enviado',
      accepted: 'Aceptado',
      rejected: 'Rechazado'
    };
    return labels[status || 'pending'] || 'Desconocido';
  }

  totalAmount(): number {
    return this.filteredInvoices.reduce((s, i) => s + (i.total || 0), 0);
  }

  get acceptedCount(): number {
    return this.filteredInvoices.filter(i => i.sunatStatus === 'accepted').length;
  }

  get pendingCount(): number {
    return this.filteredInvoices.filter(i => !i.sunatStatus || i.sunatStatus === 'pending' || i.sunatStatus === 'sent').length;
  }

  async downloadPdf(invoice: InvoiceData) {
    try {
      await this.pdfService.generateReceiptPdf(invoice);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    }
  }

  async printTicket(invoice: InvoiceData) {
    try {
      await this.ticketPrint.printThermalTicket(invoice);
    } catch (err) {
      console.error('[INVOICES] Error printing ticket:', err);
    }
  }

  trackById(index: number, item: InvoiceData): string {
    return item.id;
  }
}
