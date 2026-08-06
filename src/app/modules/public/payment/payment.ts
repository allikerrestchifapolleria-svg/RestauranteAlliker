import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { writeBatch, doc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase.config';
import { CartService, CartItem } from '../../../services/cart';
import { OrdersService } from '../../../services/orders';
import { PaymentMethod } from '../../../services/payment';
// MODO VITRINA: metodo de pago publico (Culqi) deshabilitado. Este componente NO
// esta rutado (ver public-routing-module.ts). Al reactivar el checkout, el pago
// debe procesarse SIEMPRE via funcion backend que cobre el token con la secret
// key de Culqi y valide montos contra el catalogo, porque las reglas de Firestore
// ya no permiten que un cliente escriba payments/sales directamente.
// import { CulqiService } from '../../../services/culqi';
import { Auth } from '../../../services/auth';
import { CompanyService } from '../../../services/company.service';
import { InvoiceService } from '../../../services/invoice.service';
import { InvoiceBuilderService } from '../../../services/invoice-builder.service';
import { PdfReceiptService } from '../../../services/pdf-receipt.service';
import { TicketPrintService } from '../../../services/ticket-print.service';
import { OrderItem } from '../../../models/order';
import { SunatDocType, CustomerData, InvoiceData } from '../../../models/invoice';
import { BranchService } from '../../../services/branch';

@Component({
  selector: 'app-payment',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './payment.html',
  styleUrl: './payment.css',
})
export class Payment implements OnInit {
  cartItems: CartItem[] = [];
  createdOrderId: string | null = null;
  createdOrderNumber: number | null = null;
  branchName: string = '';

  selectedMethod: PaymentMethod | null = null;
  isProcessing: boolean = false;
  paymentResult: { success: boolean; message?: string } | null = null;
  errorMessage: string = '';
  fieldErrors: Record<string, string> = {};

  mobileNumber: string = '';
  yapeCode: string = '';

  cashReceived: number | null = null;
  cashChange: number = 0;

  cardPaymentProcessed: boolean = false;

  useFactura: boolean = false;
  clienteRuc: string = '';
  clienteRazonSocial: string = '';
  clienteDireccion: string = '';
  lastInvoiceData: InvoiceData | null = null;

  paymentMethods: PaymentMethod[] = ['card', 'yape', 'cash'];

  methodLabels: Record<PaymentMethod, string> = {
    card: 'Tarjeta (Culqi)',
    yape: 'Yape',
    cash: 'Efectivo'
  };

  constructor(
    private cartService: CartService,
    private ordersService: OrdersService,
    // MODO VITRINA: Culqi deshabilitado.
    // private culqiService: CulqiService,
    private auth: Auth,
    private companyService: CompanyService,
    private invoiceService: InvoiceService,
    private invoiceBuilder: InvoiceBuilderService,
    private pdfReceipt: PdfReceiptService,
    private ticketPrint: TicketPrintService,
    private router: Router,
    private branchService: BranchService
  ) {}

  ngOnInit() {
    this.cartItems = this.cartService.getCartItems();
    if (this.cartItems.length === 0) {
      this.router.navigate(['/menu']);
      return;
    }
    const branchId = this.cartService.branchId;
    if (!branchId) {
      this.router.navigate(['/cart']);
      return;
    }
    this.branchService.getBranchById(branchId).subscribe(branch => {
      this.branchName = branch?.name || branchId;
    });
  }

  selectPaymentMethod(method: PaymentMethod) {
    this.selectedMethod = method;
    this.errorMessage = '';
    this.cardPaymentProcessed = false;
    this.resetPaymentData();
  }

  resetPaymentData() {
    this.yapeCode = '';
    this.cashReceived = null;
    this.cashChange = 0;
  }

  calculateSubtotal(): number {
    return this.cartItems.reduce((sum, ci) => sum + this.cartService.getItemSubtotal(ci), 0);
  }

  calculateTax(): number {
    return this.calculateSubtotal() * 0.18;
  }

  calculateTotal(): number {
    return this.calculateSubtotal() + this.calculateTax();
  }

  getItemCount(): number {
    return this.cartItems.reduce((sum, ci) => sum + ci.quantity, 0);
  }

  getItemPrice(ci: CartItem): number {
    return this.cartService.getItemPrice(ci);
  }

  getItemSubtotal(ci: CartItem): number {
    return this.cartService.getItemSubtotal(ci);
  }

  onCashReceivedInput() {
    if (this.cashReceived === null) {
      this.cashChange = 0;
      return;
    }
    const total = this.calculateTotal();
    this.cashChange = Math.max(0, this.cashReceived - total);
  }

  canProcessPayment(): boolean {
    if (!this.selectedMethod || this.cartItems.length === 0) return false;
    if (!this.isCustomerDataValid()) return false;

    switch (this.selectedMethod) {
      case 'card':
        return true;
      case 'yape':
        return true;
      case 'cash':
        return this.cashReceived !== null && this.cashReceived >= this.calculateTotal();
      default:
        return false;
    }
  }

  toggleDocType() {
    this.useFactura = !this.useFactura;
    if (!this.useFactura) {
      this.clienteRuc = '';
      this.clienteRazonSocial = '';
      this.clienteDireccion = '';
    }
  }

  onRucInput() {
    this.clienteRuc = this.clienteRuc.replace(/\D/g, '');
  }

  isCustomerDataValid(): boolean {
    if (!this.useFactura) return true;
    return (
      this.clienteRuc.length === 11 &&
      this.clienteRazonSocial.trim().length > 0 &&
      this.clienteDireccion.trim().length > 0
    );
  }

  private getCustomerData(): CustomerData {
    const user = this.auth.getCurrentUser();

    if (this.useFactura) {
      return {
        docType: '6',
        docNumber: this.clienteRuc,
        name: this.clienteRazonSocial,
        address: this.clienteDireccion,
        email: user?.email || ''
      };
    }

    return {
      docType: '1',
      docNumber: '00000000',
      name: user?.email?.split('@')[0] || 'Cliente',
      email: user?.email || ''
    };
  }

  // MODO VITRINA: checkout de Culqi deshabilitado. Descomentar cuando exista la
  // funcion backend de cobro (CULQI_SECRET_KEY) que procese el token en servidor.
  // private openCulqiCheckout(total: number, orderId: string): Promise<{ id: string; cardLastFour: string; cardBrand: string } | null> {
  //   return new Promise((resolve) => {
  //     this.culqiService.openCheckout({
  //       amount: total,
  //       email: 'cliente@alliker.pe',
  //       title: 'Alliker - Pago de Pedido',
  //       description: 'Pedido ' + orderId,
  //       metadata: { orderId }
  //     }).then(result => {
  //       if (result.success && result.charge) {
  //         const charge = result.charge;
  //         resolve({
  //           id: charge.id,
  //           cardLastFour: (charge.card_number || '').slice(-4),
  //           cardBrand: charge.card_brand || charge.source_type || 'card'
  //         });
  //       } else {
  //         if (result.error) {
  //           this.errorMessage = result.error;
  //         }
  //         resolve(null);
  //       }
  //     });
  //   });
  // }

  private async createOrderFromCart(): Promise<{ id: string; orderNumber: number }> {
    const items: any[] = this.cartItems.map(ci => {
      const item: any = {
        itemId: ci.item.id,
        name: ci.item.name,
        price: this.cartService.getItemPrice(ci),
        qty: ci.quantity,
        modifiers: (ci.selectedModifiers && ci.selectedModifiers.length > 0)
          ? ci.selectedModifiers.map(m => ({ name: m.name, price: m.price || 0 }))
          : (ci.item.modifiers || []),
        notes: ''
      };
      if (ci.selectedVariant) {
        item.variant = { name: ci.selectedVariant.name, price: ci.selectedVariant.price };
      }
      return item;
    });

    const subtotal = this.calculateSubtotal();
    const tax = this.calculateTax();
    const total = this.calculateTotal();

    const branchId = this.cartService.branchId;
    if (!branchId) {
      throw new Error('Debe seleccionar una sucursal para recoger el pedido');
    }

    const orderData = {
      branchId,
      tableId: null,
      customerId: this.auth.getCurrentUser()?.email || '',
      waiterId: this.auth.getCurrentUser()?.email || '',
      waiterName: '',
      type: 'takeout',
      status: 'confirmed' as const,
      items,
      subtotal,
      tax,
      total,
      paymentMethod: this.selectedMethod || 'cash',
      paymentStatus: 'pending' as const,
      notes: ''
    };

    return await this.ordersService.createOrder(orderData);
  }

  private async generateInvoiceAfterPayment(orderId: string, total: number, method: string, saleId: string) {
    try {
      const company = await this.companyService.getCompanyOnce();
      const customer: CustomerData = this.getCustomerData();

      const docType: SunatDocType = this.useFactura ? '01' : '03';
      const serieNumber = await this.invoiceService.getNextCorrelative(docType);

      const items = this.cartItems.map(ci => ({
        name: ci.item.name,
        quantity: ci.quantity,
        price: this.cartService.getItemPrice(ci),
        total: this.cartService.getItemSubtotal(ci)
      }));

      const invoiceData = this.invoiceBuilder.buildInvoiceData({
        orderId,
        orderNumber: this.createdOrderNumber || undefined,
        saleId,
        serieNumber,
        documentType: docType,
        company,
        customer,
        items,
        subtotal: this.calculateSubtotal(),
        igv: this.calculateTax(),
        total: this.calculateTotal(),
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
          console.error('[PUBLIC PAYMENT] Error imprimiendo boleta térmica:', printErr);
        }
      }
    } catch (err) {
      console.error('[PUBLIC PAYMENT] Error generating invoice:', err);
    }
  }

  async downloadPdf() {
    try {
      if (!this.lastInvoiceData) {
        console.warn('[PUBLIC PAYMENT] No hay datos de comprobante para generar el PDF');
        return;
      }
      await this.pdfReceipt.generateReceiptPdf(this.lastInvoiceData);
    } catch (error) {
      console.error('[PUBLIC PAYMENT] Error al descargar PDF:', error);
    }
  }

  async reimprimirBoleta() {
    try {
      if (!this.lastInvoiceData) return;
      await this.ticketPrint.printThermalTicket(this.lastInvoiceData);
    } catch (error) {
      console.error('[PUBLIC PAYMENT] Error al reimprimir boleta:', error);
    }
  }

  async processPayment() {
    this.fieldErrors = {};
    this.errorMessage = '';

    if (this.useFactura) {
      if (!this.clienteRuc || this.clienteRuc.length !== 11) {
        this.fieldErrors['clienteRuc'] = 'El RUC debe tener 11 dígitos';
      }
      if (!this.clienteRazonSocial?.trim()) {
        this.fieldErrors['clienteRazonSocial'] = 'La Razón Social es obligatoria';
      }
      if (!this.clienteDireccion?.trim()) {
        this.fieldErrors['clienteDireccion'] = 'La Dirección es obligatoria';
      }
    }

    if (Object.keys(this.fieldErrors).length > 0) {
      return;
    }

    if (!this.canProcessPayment() || !this.selectedMethod) return;

    this.isProcessing = true;

    const total = this.calculateTotal();

    try {
      const { id: realOrderId, orderNumber } = await this.createOrderFromCart();
      this.createdOrderId = realOrderId;
      this.createdOrderNumber = orderNumber;

      let paymentExtra: Record<string, unknown> = {};

      // MODO VITRINA: el cobro por tarjeta (Culqi) esta deshabilitado. Cuando se
      // reactive el checkout, el token de Culqi debe enviarse a una funcion backend
      // (/api/process-payment) que lo cobre con la secret key y escriba order+payment
      // +sale; el cliente ya no puede escribir estos documentos directamente.
      // if (this.selectedMethod === 'card') {
      //   const culqiCharge = await this.openCulqiCheckout(total, realOrderId);
      //   if (!culqiCharge) {
      //     return;
      //   }
      //
      //   this.cardPaymentProcessed = true;
      //   paymentExtra = {
      //     culqiChargeId: culqiCharge.id,
      //     cardLastFour: culqiCharge.cardLastFour,
      //     cardBrand: culqiCharge.cardBrand
      //   };
      // } else {
      //   await new Promise(resolve => setTimeout(resolve, 500));
      //   paymentExtra = { yapeCode: this.yapeCode || '' };
      // }
      await new Promise(resolve => setTimeout(resolve, 500));
      paymentExtra = { yapeCode: this.yapeCode || '' };

      // NOTA MODO VITRINA: este batch directo quedara bloqueado por las reglas de
      // Firestore (payments/sales create: solo staff). Al reactivar el checkout,
      // reemplazar TODO este bloque por la llamada a la funcion backend process-payment.

      // El pago, la actualizacion del pedido y la venta se escriben juntos en un solo
      // batch atomico: si algo interrumpe el flujo (se cierra la pestana, se corta la
      // conexion), no puede quedar el pago grabado pero el pedido pegado en "Pendiente".
      const saleItems = this.cartItems.map(ci => ({
        itemId: ci.item.id,
        name: ci.item.name,
        price: this.cartService.getItemPrice(ci),
        qty: ci.quantity,
        tax: this.cartService.getItemSubtotal(ci) * 0.18,
        total: this.cartService.getItemSubtotal(ci)
      }));

      const batch = writeBatch(db);
      const now = Timestamp.now();

      const paymentId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const paymentRef = doc(collection(db, 'payments'), paymentId);
      batch.set(paymentRef, {
        orderId: realOrderId,
        amount: total,
        method: this.selectedMethod,
        status: 'completed',
        culqiChargeId: (paymentExtra['culqiChargeId'] as string) || null,
        cardLastFour: (paymentExtra['cardLastFour'] as string) || null,
        cardBrand: (paymentExtra['cardBrand'] as string) || null,
        mobileNumber: (paymentExtra['mobileNumber'] as string) || null,
        cashReceived: null,
        change: null,
        createdAt: now,
        processedAt: now
      });

      const orderRef = doc(db, 'orders', realOrderId);
      batch.update(orderRef, {
        paymentMethod: this.selectedMethod,
        paymentStatus: 'paid',
        updatedAt: new Date()
      });

      const saleId = `SALE_${Date.now()}`;
      const saleRef = doc(collection(db, 'sales'), saleId);
      batch.set(saleRef, {
        orderId: realOrderId,
        tableId: null,
        customerId: null,
        waiterId: this.auth.getCurrentUser()?.email || '',
        waiterName: '',
        branchId: this.cartService.branchId,
        items: saleItems,
        subtotal: this.calculateSubtotal(),
        tax: this.calculateTax(),
        total: this.calculateTotal(),
        paymentMethod: this.selectedMethod,
        paymentStatus: 'paid',
        saleDate: now,
        createdAt: now
      });

      await batch.commit();

      this.cartService.clearCart();

      await this.generateInvoiceAfterPayment(realOrderId, total, this.selectedMethod, saleId);

      this.paymentResult = {
        success: true,
        message: `Pedido #${this.createdOrderNumber || realOrderId.slice(-6)} — Pago exitoso.`
      };

      if (!this.useFactura) {
        setTimeout(() => this.router.navigate(['/order-tracking', realOrderId]), 2500);
      }
    } catch (error) {
      console.error('[PUBLIC PAYMENT] Error:', error);
      this.errorMessage = 'Error de conexion. Intentelo de nuevo.';
    } finally {
      this.isProcessing = false;
    }
  }

  goBack() {
    this.router.navigate(['/cart']);
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
