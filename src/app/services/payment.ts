import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, writeBatch, where, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.config';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  culqiChargeId?: string;
  cardLastFour?: string;
  cardBrand?: string;
  mobileNumber?: string;
  cashReceived?: number;
  change?: number;
  createdAt: Date;
  processedAt?: Date;
}

export type PaymentMethod = 'card' | 'yape' | 'cash';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface PaymentResult {
  success: boolean;
  payment?: Payment;
  message?: string;
  receipt?: Receipt;
}

export interface Receipt {
  id: string;
  paymentId: string;
  orderId: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentAmount: number;
  change?: number;
  timestamp: Date;
  cashier: string;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface PaymentAllocation {
  method: PaymentMethod;
  amount: number;
  cashReceived?: number;
  change?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private paymentsSubject = new BehaviorSubject<Payment[]>([]);
  public payments$ = this.paymentsSubject.asObservable();
  private unsubscribeSnapshot: (() => void) | null = null;

  constructor(private ngZone: NgZone) {
    this.listenPayments();
  }

  private listenPayments() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
    }
    const paymentsCollection = collection(db, 'payments');
    this.unsubscribeSnapshot = onSnapshot(query(paymentsCollection, orderBy('createdAt', 'desc')), (snapshot) => {
      this.ngZone.run(() => {
        const payments: Payment[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          payments.push({
            id: doc.id,
            orderId: data['orderId'] || '',
            amount: Number(data['amount']) || 0,
            method: data['method'] || 'cash',
            status: data['status'] || 'completed',
            culqiChargeId: data['culqiChargeId'] || undefined,
            cardLastFour: data['cardLastFour'] || undefined,
            cardBrand: data['cardBrand'] || undefined,
            mobileNumber: data['mobileNumber'] || undefined,
            cashReceived: Number(data['cashReceived']) || undefined,
            change: Number(data['change']) || undefined,
            createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
            processedAt: data['processedAt']?.toDate ? data['processedAt'].toDate() : new Date(data['processedAt'])
          });
        });
        this.paymentsSubject.next(payments);
      });
    }, (error) => {
      console.error('[PAYMENT] Error en listener en tiempo real:', error);
    });
  }

  async recordPayment(
    orderId: string,
    amount: number,
    method: PaymentMethod,
    paymentData: {
      culqiChargeId?: string;
      cardLastFour?: string;
      cardBrand?: string;
      mobileNumber?: string;
      yapeCode?: string;
      cashReceived?: number;
      change?: number;
    } = {}
  ): Promise<Payment> {
    try {
      const paymentsCollection = collection(db, 'payments');
      const paymentDoc = {
        orderId,
        amount,
        method,
        status: 'completed',
        culqiChargeId: paymentData.culqiChargeId || null,
        cardLastFour: paymentData.cardLastFour || null,
        cardBrand: paymentData.cardBrand || null,
        mobileNumber: paymentData.mobileNumber || null,
        cashReceived: paymentData.cashReceived || null,
        change: paymentData.change || null,
        createdAt: Timestamp.now(),
        processedAt: Timestamp.now()
      };

      const docRef = await addDoc(paymentsCollection, paymentDoc);

      const payment: Payment = {
        id: docRef.id,
        orderId,
        amount,
        method,
        status: 'completed',
        culqiChargeId: paymentData.culqiChargeId,
        cardLastFour: paymentData.cardLastFour,
        cardBrand: paymentData.cardBrand,
        mobileNumber: paymentData.mobileNumber,
        cashReceived: paymentData.cashReceived,
        change: paymentData.change,
        createdAt: new Date(),
        processedAt: new Date()
      };

      const current = this.paymentsSubject.value;
      this.paymentsSubject.next([payment, ...current]);

      return payment;
    } catch (error) {
      console.error('[PAYMENT] Error registrando pago:', error);
      throw error;
    }
  }

  async createPaymentsBatch(
    orderId: string,
    allocations: PaymentAllocation[],
    orderTotal: number
  ): Promise<Payment[]> {
    const batch = writeBatch(db);
    const now = Timestamp.now();
    const payments: Payment[] = [];

    for (const alloc of allocations) {
      if (!alloc.amount || alloc.amount <= 0) continue;

      const paymentId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const paymentRef = doc(collection(db, 'payments'), paymentId);

      batch.set(paymentRef, {
        orderId,
        amount: alloc.amount,
        method: alloc.method,
        status: 'completed',
        cashReceived: alloc.cashReceived || null,
        change: alloc.change || null,
        createdAt: now,
        processedAt: now
      });

      payments.push({
        id: paymentId,
        orderId,
        amount: alloc.amount,
        method: alloc.method,
        status: 'completed',
        cashReceived: alloc.cashReceived,
        change: alloc.change,
        createdAt: now.toDate(),
        processedAt: now.toDate()
      });
    }

    await batch.commit();

    const current = this.paymentsSubject.value;
    this.paymentsSubject.next([...payments, ...current]);

    return payments;
  }

  async getPaymentsByDateRangeFromFirestore(startDate: Date, endDate: Date): Promise<Payment[]> {
    // getDocs() resuelve fuera de la Angular Zone (igual que onSnapshot en listenPayments),
    // por lo que el resultado debe procesarse dentro de ngZone.run para que Angular detecte
    // el cambio de estado y renderice sin esperar un evento adicional (p. ej. un click).
    return this.ngZone.run(async () => {
      try {
        const paymentsCollection = collection(db, 'payments');
        const q = query(
          paymentsCollection,
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          where('createdAt', '<=', Timestamp.fromDate(endDate)),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        if (snapshot.docs.length === 0) {
          console.warn('[PAYMENT] getPaymentsByDateRangeFromFirestore returned 0 docs — createdAt field may be stored as string instead of Timestamp');
        } else {
          const sample = snapshot.docs[0].data();
          console.log('[PAYMENT] createdAt type:', typeof sample['createdAt'], sample['createdAt']?.constructor?.name);
        }
        const payments: Payment[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          payments.push({
            id: doc.id,
            orderId: data['orderId'] || '',
            amount: Number(data['amount']) || 0,
            method: data['method'] || 'cash',
            status: data['status'] || 'completed',
            culqiChargeId: data['culqiChargeId'] || undefined,
            cardLastFour: data['cardLastFour'] || undefined,
            cardBrand: data['cardBrand'] || undefined,
            mobileNumber: data['mobileNumber'] || undefined,
            cashReceived: data['cashReceived'] != null ? Number(data['cashReceived']) : undefined,
            change: data['change'] != null ? Number(data['change']) : undefined,
            createdAt: data['createdAt']?.toDate ? data['createdAt'].toDate() : new Date(data['createdAt']),
            processedAt: data['processedAt']?.toDate ? data['processedAt'].toDate() : new Date(data['processedAt'])
          });
        });
        return payments;
      } catch (error) {
        console.error('[PAYMENT] Error cargando pagos por fecha:', error);
        return [];
      }
    });
  }

  generateReceipt(payment: Payment, items: ReceiptItem[]): Receipt {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    return {
      id: `REC${Date.now()}`,
      paymentId: payment.id,
      orderId: payment.orderId,
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      })),
      subtotal,
      tax,
      total,
      paymentMethod: payment.method,
      paymentAmount: payment.cashReceived || payment.amount,
      change: payment.change,
      timestamp: new Date(),
      cashier: 'Alliker POS'
    };
  }

  getPayments(): Observable<Payment[]> {
    return this.payments$;
  }

  getPaymentById(id: string): Observable<Payment | undefined> {
    return new Observable(observer => {
      const payments = this.paymentsSubject.value;
      const payment = payments.find(p => p.id === id);
      observer.next(payment);
      observer.complete();
    });
  }

  getTotalRevenue(): number {
    return this.paymentsSubject.value
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  getPaymentsByDateRange(startDate: Date, endDate: Date): Payment[] {
    return this.paymentsSubject.value.filter(p =>
      p.createdAt >= startDate && p.createdAt <= endDate
    );
  }

  printReceipt(receipt: Receipt): void {
    console.error('[PAYMENT] printReceipt() no debe usarse directamente. Use TicketPrintService en su lugar.');
  }
}
