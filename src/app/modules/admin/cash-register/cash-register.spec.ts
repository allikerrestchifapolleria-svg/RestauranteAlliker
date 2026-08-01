import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CashRegister } from './cash-register';
import { SalesService } from '../../../services/sales';
import { OrdersService } from '../../../services/orders';
import { PaymentService } from '../../../services/payment';
import { BranchService } from '../../../services/branch';
import { BranchSelectionService } from '../../../services/branch-selection';
import { Branch } from '../../../models/branch';

describe('CashRegister', () => {
  let component: CashRegister;
  let fixture: ComponentFixture<CashRegister>;
  let salesServiceSpy: jasmine.SpyObj<SalesService>;
  let ordersServiceSpy: jasmine.SpyObj<OrdersService>;
  let paymentServiceSpy: jasmine.SpyObj<PaymentService>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;
  let branchSelectionSpy: jasmine.SpyObj<BranchSelectionService>;

  const branches: Branch[] = [
    {
      id: 'b1',
      branchId: 'b1',
      name: 'Trujillo',
      address: '',
      phone: '',
      openingHours: {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(async () => {
    salesServiceSpy = jasmine.createSpyObj('SalesService', ['getSalesByDateRange']);
    ordersServiceSpy = jasmine.createSpyObj('OrdersService', ['getOrders']);
    paymentServiceSpy = jasmine.createSpyObj('PaymentService', ['getPaymentsByDateRangeFromFirestore']);
    branchServiceSpy = jasmine.createSpyObj('BranchService', ['branches$']);
    branchSelectionSpy = jasmine.createSpyObj('BranchSelectionService', ['selectedBranchId$', 'getSelectedBranchId']);

    salesServiceSpy.getSalesByDateRange.and.returnValue(of([]));
    ordersServiceSpy.getOrders.and.returnValue(of([]));
    paymentServiceSpy.getPaymentsByDateRangeFromFirestore.and.returnValue(Promise.resolve([]));
    branchServiceSpy.branches$ = of(branches);
    branchSelectionSpy.selectedBranchId$ = of('b1');
    branchSelectionSpy.getSelectedBranchId.and.returnValue('b1');

    await TestBed.configureTestingModule({
      imports: [CashRegister],
      providers: [
        { provide: SalesService, useValue: salesServiceSpy },
        { provide: OrdersService, useValue: ordersServiceSpy },
        { provide: PaymentService, useValue: paymentServiceSpy },
        { provide: BranchService, useValue: branchServiceSpy },
        { provide: BranchSelectionService, useValue: branchSelectionSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CashRegister);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should query the local day boundaries for the selected date', () => {
    component.selectedDate = '2026-07-31';
    component.loadSales();

    const args = salesServiceSpy.getSalesByDateRange.calls.mostRecent().args as [Date, Date];
    const start = args[0];
    const end = args[1];

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(31);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(6);
    expect(end.getDate()).toBe(31);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);

    // Una venta hecha el 31 local a las 23:56 UTC (18:56 en UTC-5) cae dentro del rango.
    const saleLocal31 = new Date('2026-07-31T23:56:05.256Z');
    expect(saleLocal31 >= start && saleLocal31 <= end).toBeTrue();
    // Una venta del 30 local queda fuera del rango del 31.
    const saleLocal30 = new Date('2026-07-30T23:56:05.256Z');
    expect(saleLocal30 >= start && saleLocal30 <= end).toBeFalse();
  });
});
