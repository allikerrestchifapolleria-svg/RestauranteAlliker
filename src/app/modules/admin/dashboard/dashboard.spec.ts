import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Dashboard } from './dashboard';
import { SalesService } from '../../../services/sales';
import { OrdersService } from '../../../services/orders';
import { TableService } from '../../../services/table';
import { ReservationsService } from '../../../services/reservations';
import { BranchSelectionService } from '../../../services/branch-selection';
import { PaymentService } from '../../../services/payment';
import { of } from 'rxjs';
import { Sale } from '../../../models/sale';
import { Order } from '../../../models/order';
import { Table } from '../../../models/table';
import { Reservation } from '../../../models/reservation';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let salesServiceSpy: jasmine.SpyObj<SalesService>;
  let ordersServiceSpy: jasmine.SpyObj<OrdersService>;
  let tableServiceSpy: jasmine.SpyObj<TableService>;
  let reservationsServiceSpy: jasmine.SpyObj<ReservationsService>;
  let branchSelectionSpy: jasmine.SpyObj<BranchSelectionService>;
  let paymentServiceSpy: jasmine.SpyObj<PaymentService>;

  const now = new Date();
  const mockOrders: Order[] = [
    { id: 'o1', branchId: 'b1', tableId: '1', customerId: null, type: 'dine_in', status: 'pending', items: [], subtotal: 50, tax: 9, total: 59, paymentMethod: 'cash', paymentStatus: 'pending', createdAt: now, updatedAt: now },
    { id: 'o2', branchId: 'b1', tableId: '2', customerId: null, type: 'delivery', status: 'completed', items: [], subtotal: 30, tax: 5.4, total: 35.4, paymentMethod: 'card', paymentStatus: 'paid', createdAt: now, updatedAt: now },
  ];
  const mockTables: Table[] = [
    { id: 't1', number: 1, name: 'Mesa 1', capacity: 4, branchId: 'b1', status: 'occupied', familyGroupId: null, permanentFamily: false, currentOrderId: 'o1', occupiedTime: new Date(), createdAt: now, updatedAt: now },
    { id: 't2', number: 2, name: 'Mesa 2', capacity: 2, branchId: 'b1', status: 'free', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
    { id: 't3', number: 3, name: 'Mesa 3', capacity: 6, branchId: 'b2', status: 'occupied', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
  ];
  const mockReservations: Reservation[] = [
    { id: 'r1', branchId: 'b1', tableId: 't3', customerName: 'Juan', customerPhone: '999888777', customerEmail: 'j@test.com', date: new Date(), time: '12:00', peopleCount: 2, notes: '', status: 'confirmed', createdAt: new Date() },
  ];
  const mockSales: Sale[] = [
    { saleId: 's1', orderId: 'o1', tableId: '1', customerId: null, branchId: 'b1', items: [], subtotal: 50, tax: 9, total: 59, paymentMethod: 'cash', paymentStatus: 'completed', saleDate: now, createdAt: now },
    { saleId: 's2', orderId: 'o2', tableId: null, customerId: null, branchId: 'b2', items: [], subtotal: 30, tax: 5.4, total: 35.4, paymentMethod: 'card', paymentStatus: 'completed', saleDate: now, createdAt: now },
  ];

  beforeEach(fakeAsync(() => {
    salesServiceSpy = jasmine.createSpyObj('SalesService', ['getSales']);
    ordersServiceSpy = jasmine.createSpyObj('OrdersService', ['getOrders']);
    tableServiceSpy = jasmine.createSpyObj('TableService', ['getTables', 'getTableDisplayName']);
    reservationsServiceSpy = jasmine.createSpyObj('ReservationsService', ['getReservations']);
    branchSelectionSpy = jasmine.createSpyObj('BranchSelectionService', ['selectedBranchId$', 'getSelectedBranchId']);
    paymentServiceSpy = jasmine.createSpyObj('PaymentService', ['getPayments']);

    salesServiceSpy.getSales.and.returnValue(of(mockSales));
    ordersServiceSpy.getOrders.and.returnValue(of(mockOrders));
    tableServiceSpy.getTables.and.returnValue(of(mockTables));
    tableServiceSpy.getTableDisplayName.and.returnValue('Mesa 1');
    reservationsServiceSpy.getReservations.and.returnValue(of(mockReservations));
    paymentServiceSpy.getPayments.and.returnValue(of([]));
    branchSelectionSpy.selectedBranchId$ = of('b1');
    branchSelectionSpy.getSelectedBranchId.and.returnValue('b1');

    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: SalesService, useValue: salesServiceSpy },
        { provide: OrdersService, useValue: ordersServiceSpy },
        { provide: TableService, useValue: tableServiceSpy },
        { provide: ReservationsService, useValue: reservationsServiceSpy },
        { provide: BranchSelectionService, useValue: branchSelectionSpy },
        { provide: PaymentService, useValue: paymentServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick(301);
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load data on init', () => {
    expect(ordersServiceSpy.getOrders).toHaveBeenCalled();
    expect(tableServiceSpy.getTables).toHaveBeenCalled();
    expect(reservationsServiceSpy.getReservations).toHaveBeenCalled();
    expect(salesServiceSpy.getSales).toHaveBeenCalled();
  });

  it('should compute todaySales', () => {
    expect(component.todaySales).toBe(59);
  });

  it('should compute activeOrdersCount', () => {
    expect(component.activeOrdersCount).toBe(1);
  });

  it('should compute table counts', () => {
    expect(component.totalTables).toBe(2);
    expect(component.occupiedTablesCount).toBe(1);
    expect(component.freeTablesCount).toBe(1);
  });

  it('should compute occupancyPercent', () => {
    expect(component.occupancyPercent).toBe(50);
  });

  it('should set dateRange and reload', () => {
    const loadSpy = spyOn(component as any, 'processData');
    component.setDateRange('week');
    expect(component.dateRange).toBe('week');
    expect(loadSpy).toHaveBeenCalled();
  });

  it('should return status label', () => {
    expect(component.getStatusLabel('pending')).toBe('Pendiente');
    expect(component.getStatusLabel('completed')).toBe('Completado');
  });

  it('should return table status label', () => {
    expect(component.getTableStatusLabel('free')).toBe('Disponible');
    expect(component.getTableStatusLabel('available')).toBe('Disponible');
    expect(component.getTableStatusLabel('occupied')).toBe('Ocupada');
  });
});
