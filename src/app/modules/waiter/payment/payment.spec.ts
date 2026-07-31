import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Payment } from './payment';
import { PaymentService } from '../../../services/payment';
import { OrdersService } from '../../../services/orders';
import { TableService } from '../../../services/table';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';

describe('Waiter Payment', () => {
  let component: Payment;
  let fixture: ComponentFixture<Payment>;

  beforeEach(async () => {
    const paymentServiceSpy = jasmine.createSpyObj('PaymentService', [
      'createPaymentsBatch', 'printReceipt', 'generateReceipt'
    ]);
    const ordersServiceSpy = jasmine.createSpyObj('OrdersService', [
      'getOrderById', 'updateOrderPaymentStatus'
    ]);
    const tableServiceSpy = jasmine.createSpyObj('TableService', ['getTables']);

    ordersServiceSpy.getOrderById.and.returnValue({
      subscribe: (fn: any) => fn(undefined)
    } as any);
    paymentServiceSpy.generateReceipt.and.returnValue({
      id: 'REC1', paymentId: 'p1', orderId: 'o1',
      items: [], subtotal: 0, tax: 0, total: 0,
      paymentMethod: 'card', paymentAmount: 0,
      timestamp: new Date(), cashier: 'test'
    });
    tableServiceSpy.getTables.and.returnValue({
      subscribe: (fn: any) => fn([])
    } as any);

    await TestBed.configureTestingModule({
      imports: [Payment],
      providers: [
        { provide: PaymentService, useValue: paymentServiceSpy },
        { provide: OrdersService, useValue: ordersServiceSpy },
        { provide: TableService, useValue: tableServiceSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Payment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 3 payment methods', () => {
    expect(component.paymentMethods.length).toBe(3);
    expect(component.paymentMethods).toContain('card');
    expect(component.paymentMethods).toContain('yape');
    expect(component.paymentMethods).toContain('cash');
  });

  it('should show error when no orderId provided', async () => {
    component = TestBed.createComponent(Payment).componentInstance;
    await component.ngOnInit();
    expect(component.errorMessage).toContain('No se ha especificado una orden');
  });

  it('should calculate subtotal', () => {
    component.currentOrder = {
      id: 'ORD001',
      branchId: 'b1',
      items: [
        { name: 'Lomo Saltado', quantity: 2, price: 28.00 },
        { name: 'Ceviche', quantity: 1, price: 32.00 },
        { name: 'Inca Kola', quantity: 3, price: 2.50 }
      ],
      total: 95.50
    };
    expect(component.calculateSubtotal()).toBeCloseTo(95.50, 2);
  });

  it('should calculate tax', () => {
    component.currentOrder = {
      id: 'ORD001',
      branchId: 'b1',
      items: [{ name: 'Item', quantity: 1, price: 100 }],
      total: 118
    };
    expect(component.calculateTax()).toBeCloseTo(18, 2);
  });

  it('should calculate total', () => {
    component.currentOrder = {
      id: 'ORD001',
      branchId: 'b1',
      items: [{ name: 'Item', quantity: 1, price: 100 }],
      total: 118
    };
    expect(component.calculateTotal()).toBeCloseTo(118, 2);
  });

  it('should return total allocated', () => {
    component.allocs.cash.amount = 30;
    component.allocs.yape.amount = 70;
    expect(component.getTotalAllocated()).toBe(100);
  });

  it('should return remaining', () => {
    component.currentOrder = {
      id: 'ORD001',
      branchId: 'b1',
      items: [{ name: 'Item', quantity: 1, price: 100 }],
      total: 118
    };
    component.allocs.cash.amount = 50;
    expect(component.getRemaining()).toBeCloseTo(68, 2);
  });

  it('should calculate cash change', () => {
    component.allocs.cash.amount = 30;
    component.allocs.cash.received = 50;
    expect(component.getCashChange()).toBe(20);
  });

  it('should return 0 change when no cash amount', () => {
    expect(component.getCashChange()).toBe(0);
  });

  it('should return table name from state', () => {
    expect(component.getTableName()).toBe('Sin mesa');
  });

  it('should validate payment when total matches', () => {
    component.currentOrder = {
      id: 'ORD001', branchId: 'b1', items: [{ name: 'Item', quantity: 1, price: 100 }], total: 118
    };
    component.allocs.cash.amount = 118;
    component.allocs.cash.received = 118;
    component.isConfirmDisabled = false;
    expect(component.canProcessPayment()).toBeTrue();
  });

  it('should reject when total does not match', () => {
    component.currentOrder = {
      id: 'ORD001', branchId: 'b1', items: [{ name: 'Item', quantity: 1, price: 100 }], total: 118
    };
    component.allocs.cash.amount = 50;
    expect(component.canProcessPayment()).toBeFalse();
  });

  it('should reject when no amount assigned', () => {
    component.currentOrder = {
      id: 'ORD001', branchId: 'b1', items: [{ name: 'Item', quantity: 1, price: 100 }], total: 118
    };
    expect(component.canProcessPayment()).toBeFalse();
  });

  it('should reject when cash received < cash amount', () => {
    component.currentOrder = {
      id: 'ORD001', branchId: 'b1', items: [{ name: 'Item', quantity: 1, price: 100 }], total: 118
    };
    component.allocs.cash.amount = 118;
    component.allocs.cash.received = 100;
    expect(component.canProcessPayment()).toBeFalse();
  });

  it('should reset for new payment', () => {
    component.paymentResult = { success: true } as any;
    component.allocs.cash.amount = 50;
    component.newPayment();
    expect(component.paymentResult).toBeNull();
    expect(component.allocs.cash.amount).toBeNull();
  });

  it('should go back to tables', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    component.goBack();
    expect(navigateSpy).toHaveBeenCalledWith(['/waiter/tables']);
  });

  it('should have method labels for all methods', () => {
    expect(component.methodLabels['cash']).toBe('Efectivo');
    expect(component.methodLabels['card']).toBe('Tarjeta');
    expect(component.methodLabels['yape']).toBe('Yape');
  });

  it('should block payment when order is already paid', () => {
    component.currentOrder = {
      id: 'ORD001', branchId: 'b1', items: [{ name: 'Item', quantity: 1, price: 100 }], total: 118
    };
    component.allocs.cash.amount = 118;
    component.allocs.cash.received = 118;
    component.orderAlreadyPaid = true;
    expect(component.canProcessPayment()).toBeFalse();
  });

  it('should handle split payments', () => {
    component.currentOrder = {
      id: 'ORD001', branchId: 'b1', items: [{ name: 'Item', quantity: 1, price: 100 }], total: 118
    };
    component.allocs.cash.amount = 50;
    component.allocs.cash.received = 50;
    component.allocs.yape.amount = 68;
    component.isConfirmDisabled = false;
    expect(component.canProcessPayment()).toBeTrue();
    expect(component.getTotalAllocated()).toBe(118);
  });
});
