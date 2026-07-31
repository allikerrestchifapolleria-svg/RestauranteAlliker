import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PaymentService, PaymentMethod, Receipt } from '../../../services/payment';
import type { Payment as PaymentRecord } from '../../../services/payment';
import { OrdersService } from '../../../services/orders';
import { TableService } from '../../../services/table';
import { InvoiceService } from '../../../services/invoice.service';
import { InvoiceBuilderService } from '../../../services/invoice-builder.service';
import { PdfReceiptService } from '../../../services/pdf-receipt.service';
import { TicketPrintService } from '../../../services/ticket-print.service';
import { CustomerData, CompanyData, SunatDocType } from '../../../models/invoice';
import { firstValueFrom } from 'rxjs';
import { db } from '../../../firebase.config';
import { doc, collection, writeBatch, Timestamp, getDoc } from 'firebase/firestore';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  branchId: string;
  items: OrderItem[];
  total: number;
  waiterId?: string;
  waiterName?: string;
  orderNumber?: number;
}

interface MethodAlloc {
  amount: number | null;
  received?: number | null;
}

interface TableReleaseInfo {
  id: string;
  status: string;
  familyGroupId: string | null;
  permanentFamily: boolean;
  hasLiveReservation: boolean;
}

@Component({
  selector: 'app-waiter-payment',
  imports: [CommonModule, FormsModule],
  templateUrl: './payment.html',
  styleUrl: './payment.css',
})
export class Payment implements OnInit {
  @Input() currentOrder: Order | null = null;

  isProcessing: boolean = false;
  paymentResult: { success: boolean; receipt?: Receipt; message?: string } | null = null;
  errorMessage: string = '';

  paymentMethods: PaymentMethod[] = ['cash', 'card', 'yape'];

  allocs: Record<PaymentMethod, MethodAlloc> = {
    cash: { amount: null, received: null },
    card: { amount: null },
    yape: { amount: null }
  };

  methodLabels: Record<PaymentMethod, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    yape: 'Yape'
  };

  methodIcons: Record<PaymentMethod, string> = {
    cash: 'fa-money-bill-wave',
    card: 'fa-credit-card',
    yape: 'fa-mobile-alt'
  };

  methodColors: Record<PaymentMethod, string> = {
    cash: '#10b981',
    card: '#3b82f6',
    yape: '#22d3ee'
  };

  orderAlreadyPaid: boolean = false;
  todoActive: boolean = false;
  todoMethod: PaymentMethod | null = null;
  currentAssigned: number = 0;
  isConfirmDisabled: boolean = true;
  calcVisible: boolean = false;
  calcDisplay: string = '0';
  calcPrevious: number = 0;
  calcOperator: string | null = null;
  calcNewEntry: boolean = true;
  calcExpression: string = '';
  Math = Math;
  private tableName: string = '';
  private tablesToRelease: TableReleaseInfo[] = [];

  clienteDocNum: string = '';
  clienteNombre: string = '';
  clienteNombreDisabled: boolean = true;
  clienteRuc: string = '';
  clienteRazonSocial: string = '';
  clienteDireccion: string = '';
  useFactura: boolean = false;
  dniLoading: boolean = false;
  dniError: string = '';
  isVariosClientes: boolean = false;
  lastInvoiceData?: import('../../../models/invoice').InvoiceData;

  constructor(
    private paymentService: PaymentService,
    private ordersService: OrdersService,
    private tableService: TableService,
    private invoiceService: InvoiceService,
    private invoiceBuilder: InvoiceBuilderService,
    private pdfReceipt: PdfReceiptService,
    private ticketPrint: TicketPrintService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    const params = await firstValueFrom(this.route.queryParams);
    const orderId = params['orderId'];
    const tableId = params['tableId'];

    if (!orderId) {
      this.errorMessage = 'No se ha especificado una orden para pagar.';
      return;
    }

    try {
      const orderSnap = await getDoc(doc(db, 'orders', orderId));
      if (!orderSnap.exists()) {
        this.errorMessage = `No se encontró la orden.`;
        return;
      }

      const orderData = orderSnap.data();

      if (orderData['paymentStatus'] === 'paid') {
        this.orderAlreadyPaid = true;
      }

      const items: OrderItem[] = (orderData['items'] || []).map((it: any) => ({
        name: it.name || '',
        quantity: it.qty || it.quantity || 1,
        price: it.price || 0
      }));
      this.currentOrder = {
        id: orderId,
        branchId: orderData['branchId'] || '',
        items,
        total: Number(orderData['total']) || 0,
        waiterId: orderData['waiterId'] || undefined,
        waiterName: orderData['waiterName'] || undefined,
        orderNumber: orderData['orderNumber'] || undefined
      };

      if (tableId) {
        try {
          const tables = await firstValueFrom(this.tableService.getTables());
          const table = tables.find(t => {
            if (tableId.startsWith('fam_')) {
              return t.familyGroupId === tableId.replace('fam_', '');
            }
            return String(t.number) === String(tableId);
          });
          if (table) {
            const familyGroupId = table.familyGroupId;
            if (familyGroupId && tableId.startsWith('fam_')) {
              const familyTables = tables.filter(t => t.familyGroupId === familyGroupId);
              this.tablesToRelease = familyTables.map(t => this.toTableReleaseInfo(t));
              const names = familyTables.map(t => t.name).join(' + ');
              this.tableName = `Mesa Familiar: ${names}`;
            } else {
              this.tablesToRelease = [this.toTableReleaseInfo(table)];
              this.tableName = `${table.name} — ${table.capacity} pers.`;
            }
          } else {
            this.tableName = `Mesa ${tableId}`;
          }
        } catch {
          this.tableName = tableId;
        }
      } else {
        this.tableName = 'Sin mesa';
      }

      this.cdr.detectChanges();
    } catch (e) {
      console.error('[PAYMENT] Error fetching order:', e);
      this.errorMessage = `Error al cargar la orden.`;
    }
  }

  getTotalAllocated(): number {
    return (this.allocs.cash.amount || 0) + (this.allocs.card.amount || 0) + (this.allocs.yape.amount || 0);
  }

  getRemaining(): number {
    return this.calculateTotal() - this.getTotalAllocated();
  }

  getCashChange(): number {
    const cash = this.allocs.cash;
    if (!cash.received || !cash.amount) return 0;
    return Math.max(0, cash.received - cash.amount);
  }

  private resetAllocs() {
    this.allocs = {
      cash: { amount: null, received: null },
      card: { amount: null },
      yape: { amount: null }
    };
  }

  isTodoActive(method: PaymentMethod): boolean {
    return this.todoActive && this.todoMethod === method;
  }

  payAllWith(method: PaymentMethod) {
    if (this.isTodoActive(method)) {
      this.todoActive = false;
      this.todoMethod = null;
      this.resetAllocs();
      this.updateTotals();
      return;
    }
    this.todoActive = true;
    this.todoMethod = method;
    const total = this.calculateTotal();
    this.resetAllocs();
    this.allocs[method].amount = total;
    if (method === 'cash') {
      this.allocs.cash.received = total;
    }
    this.updateTotals();
  }

  onAmountChange(changedMethod: PaymentMethod) {
    try {
      let raw = this.allocs[changedMethod].amount ?? 0;
      const str = String(raw);
      const dotIdx = str.indexOf('.');
      if (dotIdx !== -1 && str.length > dotIdx + 3) {
        raw = parseFloat(str.substring(0, dotIdx + 3));
      }
      const value = raw;
      if (isNaN(value) || value < 0) {
        this.allocs[changedMethod].amount = null;
        this.cdr.detectChanges();
        return;
      }

      const total = this.calculateTotal();
      if (total <= 0) return;

      const hasOtherAmounts = this.paymentMethods
        .filter(m => m !== changedMethod)
        .some(m => (this.allocs[m].amount ?? 0) > 0);

      if (value >= total && !hasOtherAmounts) {
        this.todoActive = true;
        this.todoMethod = changedMethod;
        this.resetAllocs();
        this.allocs[changedMethod].amount = total;
        if (changedMethod === 'cash') this.allocs.cash.received = total;
        this.updateTotals();
        return;
      }

      if (this.todoActive && changedMethod !== this.todoMethod && this.todoMethod !== null) {
        this.allocs[this.todoMethod].amount = null;
        if (this.todoMethod === 'cash') this.allocs.cash.received = null;
        this.todoActive = false;
        this.todoMethod = null;
      }

      this.allocs[changedMethod].amount = value;
      if ((this.allocs.cash.amount ?? 0) > 0) {
        this.allocs.cash.received = this.allocs.cash.amount;
      }

      this.updateTotals();
    } catch (error) {
      console.error('[PAYMENT] Error en onAmountChange:', error);
    }
  }

  private updateTotals() {
    try {
      const total = this.calculateTotal();
      this.currentAssigned = this.getTotalAllocated();
      const diff = Math.abs(this.currentAssigned - total);

      if (total < 700) {
        this.isVariosClientes = true;
      }

      if (this.currentAssigned > total) {
        this.isConfirmDisabled = true;
        this.errorMessage = `El monto asignado excede por S/ ${(this.currentAssigned - total).toFixed(2)}`;
      } else if (diff <= 0.01 && this.currentAssigned > 0) {
        const cash = this.allocs.cash;
        if ((cash.amount ?? 0) > 0 && (!cash.received || (cash.received ?? 0) < (cash.amount ?? 0))) {
          this.isConfirmDisabled = true;
          this.errorMessage = 'Indique el monto recibido en efectivo';
        } else {
          this.isConfirmDisabled = false;
          this.errorMessage = '';
        }
      } else {
        this.isConfirmDisabled = true;
        this.errorMessage = '';
      }
    } catch (error) {
      console.error('[PAYMENT] Error en updateTotals:', error);
      this.isConfirmDisabled = true;
    }
  }

  preventInputKey(event: KeyboardEvent) {
    if (event.key === 'e' || event.key === 'E' || event.key === '-' || event.key === '+') {
      event.preventDefault();
    }
  }

  calcOpen() {
    this.calcDisplay = '0';
    this.calcExpression = '';
    this.calcPrevious = 0;
    this.calcOperator = null;
    this.calcNewEntry = true;
    this.calcVisible = true;
  }

  calcClose() {
    this.calcVisible = false;
  }

  private calcExprNum(n: number): string {
    return n % 1 === 0 ? n + '' : n.toFixed(2);
  }

  private calcBuildExpr() {
    const prev = this.calcExprNum(this.calcPrevious);
    if (this.calcOperator) {
      this.calcExpression = `${prev} ${this.calcOpSymbol(this.calcOperator)} ${this.calcNewEntry ? '' : this.calcDisplay}`;
    } else {
      this.calcExpression = this.calcDisplay === '0' && this.calcNewEntry ? '' : this.calcDisplay;
    }
  }

  private calcOpSymbol(op: string): string {
    switch (op) {
      case '+': return '+';
      case '-': return '−';
      case '*': return '×';
      case '/': return '÷';
      default: return op;
    }
  }

  calcAppend(digit: string) {
    if (digit === '.' && this.calcDisplay.includes('.') && !this.calcNewEntry) return;
    if (this.calcNewEntry) {
      this.calcDisplay = digit === '.' ? '0.' : digit;
      this.calcNewEntry = false;
    } else {
      if (this.calcDisplay.replace('-', '').replace('.', '').length >= 10) return;
      this.calcDisplay += digit;
    }
    this.calcBuildExpr();
  }

  calcClear() {
    this.calcDisplay = '0';
    this.calcExpression = '';
    this.calcPrevious = 0;
    this.calcOperator = null;
    this.calcNewEntry = true;
  }

  calcBackspace() {
    if (this.calcNewEntry) return;
    this.calcDisplay = this.calcDisplay.slice(0, -1) || '0';
    if (this.calcDisplay === '-' || this.calcDisplay === '') this.calcDisplay = '0';
    this.calcBuildExpr();
  }

  calcSetOp(op: string) {
    const current = parseFloat(this.calcDisplay);
    if (this.calcOperator && !this.calcNewEntry) {
      this.calcDisplay = this.calcCompute(this.calcPrevious, current, this.calcOperator);
      this.calcPrevious = parseFloat(this.calcDisplay);
    } else {
      this.calcPrevious = current;
    }
    this.calcOperator = op;
    this.calcNewEntry = true;
    this.calcExpression = `${this.calcExprNum(this.calcPrevious)} ${this.calcOpSymbol(op)} `;
  }

  calcEquals() {
    const current = parseFloat(this.calcDisplay);
    if (!this.calcOperator) return;
    const prev = this.calcPrevious;
    const op = this.calcOperator;
    this.calcDisplay = this.calcCompute(prev, current, op);
    this.calcExpression = `${this.calcExprNum(prev)} ${this.calcOpSymbol(op)} ${this.calcExprNum(current)} = ${this.calcDisplay}`;
    this.calcOperator = null;
    this.calcNewEntry = true;
  }

  private calcCompute(a: number, b: number, op: string): string {
    let result = 0;
    switch (op) {
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      case '*': result = a * b; break;
      case '/': result = b !== 0 ? a / b : 0; break;
    }
    return Math.round(result * 100) / 100 + '';
  }

  calculateSubtotal(): number {
    if (!this.currentOrder?.items) return 0;
    return this.currentOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  calculateTax(): number {
    return this.calculateSubtotal() * 0.18;
  }

  calculateTotal(): number {
    return this.calculateSubtotal() + this.calculateTax();
  }

  getTableName(): string {
    return this.tableName || 'Sin mesa';
  }

  canProcessPayment(): boolean {
    if (!this.currentOrder || this.orderAlreadyPaid) return false;
    if (this.isConfirmDisabled) return false;
    if (!this.isCustomerDataValid()) return false;
    return true;
  }

  async processPayment() {
    if (!this.canProcessPayment() || !this.currentOrder) return;

    this.isProcessing = true;
    this.errorMessage = '';

    try {
      const order = this.currentOrder;
      const total = this.calculateTotal();

      const primaryMethod = this.getPrimaryMethod();

      const batch = writeBatch(db);
      const now = Timestamp.now();

      const payments: PaymentRecord[] = [];

      for (const method of this.paymentMethods) {
        const alloc = this.allocs[method];
        if (!alloc.amount || alloc.amount <= 0) continue;

        const paymentId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const paymentRef = doc(collection(db, 'payments'), paymentId);
        const cashReceived = method === 'cash' ? (alloc.received ?? undefined) : undefined;
        const change = method === 'cash' ? this.getCashChange() : undefined;

        batch.set(paymentRef, {
          orderId: order.id,
          amount: alloc.amount,
          method,
          status: 'completed',
          cashReceived: cashReceived || null,
          change: change || null,
          createdAt: now,
          processedAt: now
        });
        payments.push({
          id: paymentId,
          orderId: order.id,
          amount: alloc.amount,
          method,
          status: 'completed',
          cashReceived,
          change,
          createdAt: now.toDate(),
          processedAt: now.toDate()
        });
      }

      const orderRef = doc(db, 'orders', order.id);
      batch.update(orderRef, {
        paymentMethod: primaryMethod,
        paymentStatus: 'paid',
        updatedAt: new Date()
      });

      const saleItems = (order.items || []).map(item => {
        const itemSubtotal = item.price * item.quantity;
        const itemTax = itemSubtotal * 0.18;
        const itemTotal = itemSubtotal + itemTax;
        return {
          itemId: item.name,
          name: item.name,
          price: item.price,
          qty: item.quantity,
          tax: itemTax,
          total: itemTotal
        };
      });
      const subtotal = this.calculateSubtotal();
      const tax = this.calculateTax();

      const saleId = `SALE_${Date.now()}`;
      const saleRef = doc(collection(db, 'sales'), saleId);
      batch.set(saleRef, {
        orderId: order.id,
        tableId: null,
        customerId: null,
        waiterId: order.waiterId || null,
        waiterName: order.waiterName || null,
        branchId: order.branchId,
        items: saleItems,
        subtotal,
        tax,
        total,
        paymentMethod: primaryMethod,
        paymentStatus: 'completed',
        saleDate: now,
        createdAt: now
      });

      this.addTableReleaseToBatch(batch);

      await this.commitWithRetry(batch);

      const receiptItems = (order.items || []).map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }));

      const firstPayment = payments[0];
      const receipt = this.paymentService.generateReceipt(firstPayment, receiptItems);

      try {
        await this.generateInvoiceAfterPayment(order, primaryMethod, receipt);
      } catch (invErr) {
        console.error('[PAYMENT] Error generando factura (el pago ya fue registrado):', invErr);
      }

      this.paymentResult = { success: true, receipt };
    } catch (error: any) {
      console.error('[PAYMENT] Error:', error);
      this.errorMessage = error?.message || 'Error al procesar el pago. Intente de nuevo.';
    } finally {
      this.isProcessing = false;
      this.cdr.detectChanges();
    }
  }

  private toTableReleaseInfo(t: {
    id: string;
    status: string;
    familyGroupId?: string | null;
    permanentFamily?: boolean;
    reservationId?: string | null;
    reservedUntil?: Date | null;
  }): TableReleaseInfo {
    const hasLiveReservation = !!t.reservationId && !!t.reservedUntil &&
      new Date(t.reservedUntil).getTime() > Date.now();
    return {
      id: t.id,
      status: t.status,
      familyGroupId: t.familyGroupId ?? null,
      permanentFamily: !!t.permanentFamily,
      hasLiveReservation
    };
  }

  /**
   * Libera las mesas DENTRO del mismo batch de pago para que el estado de la
   * mesa se confirme de forma atomica junto con el cobro. Antes la liberacion
   * era un paso aparte post-commit: si la app se cerraba entre ambos, la mesa
   * quedaba 'occupied' con un pedido pagado para siempre (pedido 3wiKdjX2ER4gGDDDgXcK).
   *
   * Mesa individual -> 'maintenance' (limpieza, como antes).
   * Familia permanente -> 'family_merged' (queda visible de nuevo en reservaciones).
   * Familia temporal -> se desmerge y queda 'available'.
   * Con reserva vigente -> 'reserved' (no se pierde la reserva confirmada).
   */
  private addTableReleaseToBatch(batch: import('firebase/firestore').WriteBatch): void {
    for (const info of this.tablesToRelease) {
      const tableRef = doc(db, 'tables', info.id);

      let releaseStatus: string;
      let extraFields: Record<string, unknown> = {};

      if (info.hasLiveReservation && info.status !== 'reserved') {
        releaseStatus = 'reserved';
      } else if (info.familyGroupId) {
        if (info.permanentFamily) {
          releaseStatus = 'family_merged';
        } else {
          releaseStatus = 'available';
          extraFields = { familyGroupId: null, permanentFamily: false };
        }
        // Limpia una reserva ya vencida: isFamilyChildFree excluye a la familia
        // si algun hijo conserva reservationId, asi que un lock obsoleto volveria
        // a esconder el grupo de reservaciones.
        extraFields = { ...extraFields, reservationId: null, reservedUntil: null };
      } else {
        releaseStatus = 'maintenance';
      }

      batch.update(tableRef, {
        status: releaseStatus,
        currentOrderId: null,
        occupiedTime: null,
        ...extraFields
      });
    }
  }

  private async commitWithRetry(batch: import('firebase/firestore').WriteBatch, maxRetries = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await batch.commit();
        return;
      } catch (error) {
        console.error(`[PAYMENT] batch.commit intento ${attempt}/${maxRetries} falló:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  private getPrimaryMethod(): string {
    let maxMethod: PaymentMethod = 'cash';
    let maxAmount = 0;
    for (const method of this.paymentMethods) {
      const amt = this.allocs[method].amount ?? 0;
      if (amt > maxAmount) {
        maxAmount = amt;
        maxMethod = method;
      }
    }
    return maxMethod;
  }

  private async generateInvoiceAfterPayment(order: Order, method: string, receipt: Receipt) {
    if (!receipt) return;

    try {
      const companySnap = await getDoc(doc(db, 'config', 'alliker-main'));
      const company: CompanyData = companySnap.exists()
        ? (companySnap.data() as CompanyData)
        : {
            ruc: '10425772045',
            businessName: 'RESTAURANTE - CHIFA - POLLERÍA',
            commercialName: 'ALLIKER',
            ownerName: 'RONCAL GAMBOA EBER HERMAN',
            address: {
              street: 'Av. Juan Velasco S/N - C.P. Chao',
              district: 'Chao',
              province: 'Virú',
              department: 'La Libertad',
              country: 'PE'
            },
            phone: '922729872 / 912412167',
            email: 'info@alliker.pe',
            accountNumber: '',
            production: false
          };
      const total = this.calculateTotal();

      const customer: CustomerData = this.getCustomerData();

      const docType: SunatDocType = this.useFactura ? '01' : '03';
      const serieNumber = await this.invoiceService.getNextCorrelative(docType);

      const receiptItems = receipt.items;
      const items = receiptItems.map(ri => ({
        name: ri.name,
        quantity: ri.quantity,
        price: ri.price,
        total: ri.total
      }));

      const subtotal = this.calculateSubtotal();
      const igv = this.calculateTax();

      const invoiceData = this.invoiceBuilder.buildInvoiceData({
        orderId: order.id,
        orderNumber: order.orderNumber,
        saleId: `SALE_${Date.now()}`,
        serieNumber,
        documentType: docType,
        company,
        customer,
        items,
        subtotal,
        igv,
        total,
        paymentMethod: method,
        paymentAmount: total
      });

      const xmlContent = this.invoiceBuilder.generateUblXml(invoiceData);
      invoiceData.xmlContent = xmlContent;
      invoiceData.xmlHash = await this.invoiceBuilder.computeXmlHash(xmlContent);
      invoiceData.sunatStatus = 'pending';

      const invoiceId = await this.invoiceService.saveInvoice(invoiceData);
      invoiceData.id = invoiceId;
      this.lastInvoiceData = invoiceData;

      if (docType === '03') {
        try {
          await this.ticketPrint.printThermalTicket(invoiceData);
        } catch (printErr) {
          console.error('[PAYMENT] Error imprimiendo ticket térmico:', printErr);
        }
      }
    } catch (err) {
      console.error('[WAITER PAYMENT] Error generating invoice:', err);
    }
  }

  async printReceipt() {
    try {
      if (!this.paymentResult?.receipt) {
        console.warn('[PAYMENT] No hay recibo para imprimir');
        return;
      }

      if (this.lastInvoiceData) {
        await this.ticketPrint.printThermalTicket(this.lastInvoiceData);
      } else {
        console.warn('[PAYMENT] lastInvoiceData no disponible, imprimiendo recibo simple');
        this.ticketPrint.printSimpleTicket(this.paymentResult.receipt);
      }
    } catch (error) {
      console.error('[PAYMENT] Error al imprimir recibo:', error);
    }
  }

  async downloadPdf() {
    try {
      if (!this.lastInvoiceData) {
        console.warn('[PAYMENT] No hay datos de comprobante para generar el PDF');
        return;
      }
      await this.pdfReceipt.generateReceiptPdf(this.lastInvoiceData);
    } catch (error) {
      console.error('[PAYMENT] Error al descargar PDF:', error);
    }
  }

  newPayment() {
    this.paymentResult = null;
    this.todoActive = false;
    this.todoMethod = null;
    this.currentAssigned = 0;
    this.isConfirmDisabled = true;
    this.resetAllocs();
    this.errorMessage = '';
    this.clienteDocNum = '';
    this.clienteNombre = '';
    this.clienteNombreDisabled = true;
    this.clienteRuc = '';
    this.clienteRazonSocial = '';
    this.clienteDireccion = '';
    this.useFactura = false;
    this.dniLoading = false;
    this.dniError = '';
    this.isVariosClientes = false;
    this.lastInvoiceData = undefined;
  }

  payAnotherOrder(): void {
    try {
      this.router.navigate(['/waiter/orders']);
    } catch (error) {
      console.error('[PAYMENT] Error al navegar a pagar otro pedido:', error);
      this.errorMessage = 'No se pudo acceder a la lista de pedidos.';
    }
  }

  goBack() {
    try {
      this.router.navigate(['/waiter/tables']);
    } catch (error) {
      console.error('[PAYMENT] Error al navegar a mesas:', error);
    }
  }

  onDniInput() {
    const dni = this.clienteDocNum.replace(/\D/g, '');
    this.clienteDocNum = dni;

    if (dni.length === 8 && /^\d{8}$/.test(dni)) {
      this.consultarDni(dni);
    } else {
      if (!this.isVariosClientes && !this.useFactura) {
        this.clienteNombre = '';
        this.clienteNombreDisabled = true;
        this.dniError = '';
      }
    }
  }

  private async consultarDni(dni: string) {
    this.dniLoading = true;
    this.dniError = '';
    this.clienteNombreDisabled = true;

    try {
      const response = await fetch('/.netlify/functions/consultar-dni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Error al consultar DNI');
      }

      this.clienteNombre = data.name;
      this.clienteNombreDisabled = true;
      this.dniError = '';
    } catch (error) {
      console.error('[PAYMENT] Error consultando DNI:', error);
      if (error instanceof Error) {
        console.error('[PAYMENT] Stack:', error.stack);
      }
      this.clienteNombre = '';
      this.clienteNombreDisabled = false;
      this.dniError = 'No se encontraron datos. Ingrese el nombre manualmente.';
    } finally {
      this.dniLoading = false;
    }
  }

  onRucInput() {
    const ruc = this.clienteRuc.replace(/\D/g, '');
    this.clienteRuc = ruc;
  }

  toggleVariosClientes() {
    this.isVariosClientes = !this.isVariosClientes;
    if (this.isVariosClientes) {
      this.clienteDocNum = '';
      this.clienteNombre = '';
      this.clienteNombreDisabled = true;
      this.dniError = '';
      this.clienteRuc = '';
      this.clienteRazonSocial = '';
      this.clienteDireccion = '';
      this.useFactura = false;
    }
  }

  toggleDocType() {
    this.useFactura = !this.useFactura;
    if (this.useFactura) {
      this.isVariosClientes = false;
    } else {
      this.clienteRuc = '';
      this.clienteRazonSocial = '';
      this.clienteDireccion = '';
      if (this.calculateTotal() < 700) {
        this.isVariosClientes = true;
      }
    }
  }

  private getCustomerData(): CustomerData {
    const total = this.calculateTotal();

    if (this.useFactura) {
      return {
        docType: '6',
        docNumber: this.clienteRuc,
        name: this.clienteRazonSocial,
        address: this.clienteDireccion,
      };
    }

    if (this.isVariosClientes || total < 700) {
      return {
        docType: '1',
        docNumber: '12345678',
        name: 'Clientes Varios',
      };
    }

    return {
      docType: '1',
      docNumber: this.clienteDocNum,
      name: this.clienteNombre,
    };
  }

  private shouldRequireCustomerData(): boolean {
    const total = this.calculateTotal();
    if (this.isVariosClientes) return false;
    if (this.useFactura) return true;
    return total >= 700;
  }

  isCustomerDataValid(): boolean {
    if (!this.shouldRequireCustomerData()) return true;

    if (this.useFactura) {
      return (
        this.clienteRuc.length === 11 &&
        this.clienteRazonSocial.trim().length > 0 &&
        this.clienteDireccion.trim().length > 0
      );
    }

    return (
      this.clienteDocNum.length === 8 &&
      this.clienteNombre.trim().length > 0
    );
  }
}
