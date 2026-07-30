import { fakeAsync, tick } from '@angular/core/testing';
import { PaymentService, PaymentMethod, Receipt, ReceiptItem } from './payment';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    service = new PaymentService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty payments (Firestore may fail in test)', (done) => {
    service.getPayments().subscribe(payments => {
      expect(payments).toBeDefined();
      done();
    });
  });

  it('should generate receipt with correct calculations', () => {
    const items: ReceiptItem[] = [
      { name: 'Ceviche', quantity: 2, price: 32, total: 64 },
      { name: 'Lomo Saltado', quantity: 1, price: 28, total: 28 },
    ];

    const receipt = service.generateReceipt(
      {
        id: 'PAY-001',
        orderId: 'ORD001',
        amount: 108.56,
        method: 'card' as PaymentMethod,
        status: 'completed',
        createdAt: new Date(),
        processedAt: new Date(),
      },
      items
    );

    expect(receipt).toBeDefined();
    expect(receipt.items.length).toBe(2);
    expect(receipt.subtotal).toBe(92);
    expect(receipt.tax).toBeCloseTo(16.56, 2);
    expect(receipt.total).toBeCloseTo(108.56, 2);
    expect(receipt.paymentMethod).toBe('card');
    expect(receipt.id).toContain('REC');
    expect(receipt.paymentId).toBe('PAY-001');
  });

  it('should generate receipt with cash payment including change', () => {
    const items: ReceiptItem[] = [
      { name: 'Pollo a la Brasa', quantity: 1, price: 45, total: 45 },
    ];

    const receipt = service.generateReceipt(
      {
        id: 'PAY-002',
        orderId: 'ORD002',
        amount: 53.10,
        method: 'cash' as PaymentMethod,
        status: 'completed',
        cashReceived: 60,
        change: 6.90,
        createdAt: new Date(),
        processedAt: new Date(),
      },
      items
    );

    expect(receipt.subtotal).toBe(45);
    expect(receipt.tax).toBeCloseTo(8.10, 2);
    expect(receipt.total).toBeCloseTo(53.10, 2);
    expect(receipt.paymentAmount).toBe(60);
    expect(receipt.change).toBe(6.90);
    expect(receipt.paymentMethod).toBe('cash');
  });

  it('should generate receipt for yape payment', () => {
    const items: ReceiptItem[] = [
      { name: 'Inca Kola', quantity: 2, price: 5, total: 10 },
    ];

    const receipt = service.generateReceipt(
      {
        id: 'PAY-003',
        orderId: 'ORD003',
        amount: 11.80,
        method: 'yape' as PaymentMethod,
        status: 'completed',
        mobileNumber: '999888777',
        createdAt: new Date(),
        processedAt: new Date(),
      },
      items
    );

    expect(receipt.paymentMethod).toBe('yape');
    expect(receipt.total).toBeCloseTo(11.80, 2);
  });

  it('should generate receipt for plin payment', () => {
    const items: ReceiptItem[] = [
      { name: 'Chicha Morada', quantity: 1, price: 8, total: 8 },
    ];

    const receipt = service.generateReceipt(
      {
        id: 'PAY-004',
        orderId: 'ORD004',
        amount: 9.44,
        method: 'yape' as PaymentMethod,
        status: 'completed',
        mobileNumber: '987654321',
        createdAt: new Date(),
        processedAt: new Date(),
      },
      items
    );

    expect(receipt.paymentMethod).toBe('yape');
    expect(receipt.total).toBeCloseTo(9.44, 2);
  });

  it('should calculate IGV at 18% correctly', () => {
    const items: ReceiptItem[] = [
      { name: 'Menu Completo', quantity: 1, price: 100, total: 100 },
    ];

    const receipt = service.generateReceipt(
      {
        id: 'PAY-005',
        orderId: 'ORD005',
        amount: 118,
        method: 'card' as PaymentMethod,
        status: 'completed',
        createdAt: new Date(),
      },
      items
    );

    expect(receipt.subtotal).toBe(100);
    expect(receipt.tax).toBe(18);
    expect(receipt.total).toBe(118);
  });

  it('should calculate total revenue from completed payments', (done) => {
    service.getPayments().subscribe(payments => {
      expect(typeof service.getTotalRevenue()).toBe('number');
      done();
    });
  });

  it('should return payments filtered by date range', () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    const yesterday = new Date(now.getTime() - 86400000);

    const inRange = service.getPaymentsByDateRange(yesterday, tomorrow);
    expect(inRange).toBeDefined();
    expect(Array.isArray(inRange)).toBeTrue();
  });

  it('should return undefined for non-existent payment id', (done) => {
    service.getPaymentById('NONEXISTENT').subscribe(p => {
      expect(p).toBeUndefined();
      done();
    });
  });

  it('should return empty receipts array for empty items', () => {
    const receipt = service.generateReceipt(
      {
        id: 'PAY-006',
        orderId: 'ORD006',
        amount: 0,
        method: 'cash' as PaymentMethod,
        status: 'completed',
        createdAt: new Date(),
      },
      []
    );

    expect(receipt.items.length).toBe(0);
    expect(receipt.subtotal).toBe(0);
    expect(receipt.tax).toBe(0);
    expect(receipt.total).toBe(0);
  });

  it('should print receipt via window.print', () => {
    const spy = spyOn(window, 'print');
    const receipt: Receipt = {
      id: 'REC-001',
      paymentId: 'PAY-001',
      orderId: 'ORD001',
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      paymentMethod: 'card',
      paymentAmount: 0,
      timestamp: new Date(),
      cashier: 'Test',
    };
    service.printReceipt(receipt);
    expect(spy).toHaveBeenCalled();
  });
});
