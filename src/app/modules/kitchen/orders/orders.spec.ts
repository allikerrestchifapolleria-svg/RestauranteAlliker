import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Orders } from './orders';
import { OrdersService } from '../../../services/orders';
import { BranchSelectionService } from '../../../services/branch-selection';
import { Auth } from '../../../services/auth';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Order } from '../../../models/order';

const mockOrders: Order[] = [
  { id: 'o1', branchId: 'b1', tableId: '1', customerId: null, type: 'dine_in', status: 'confirmed', items: [{ itemId: 'm1', name: 'Lomo Saltado', price: 28, qty: 2, modifiers: [], notes: '' }], subtotal: 56, tax: 10.08, total: 66.08, paymentMethod: 'cash', paymentStatus: 'pending', createdAt: new Date(), updatedAt: new Date() },
  { id: 'o2', branchId: 'b1', tableId: '2', customerId: null, type: 'delivery', status: 'preparing', items: [{ itemId: 'm2', name: 'Ceviche', price: 32, qty: 1, modifiers: [], notes: '' }, { itemId: 'm3', name: 'Arroz con Mariscos', price: 35, qty: 1, modifiers: [], notes: '' }], subtotal: 67, tax: 12.06, total: 79.06, paymentMethod: 'card', paymentStatus: 'paid', createdAt: new Date(), updatedAt: new Date() },
  { id: 'o3', branchId: 'b2', tableId: '3', customerId: null, type: 'dine_in', status: 'ready', items: [{ itemId: 'm4', name: 'Ají de Gallina', price: 25, qty: 1, modifiers: [], notes: '' }], subtotal: 25, tax: 4.5, total: 29.5, paymentMethod: 'cash', paymentStatus: 'pending', createdAt: new Date(), updatedAt: new Date() },
  { id: 'o4', branchId: 'b1', tableId: null, customerId: null, type: 'takeout', status: 'pending', items: [{ itemId: 'm5', name: 'Pollo a la Brasa', price: 45, qty: 1, modifiers: [], notes: '' }], subtotal: 45, tax: 8.1, total: 53.1, paymentMethod: 'yape', paymentStatus: 'pending', createdAt: new Date(), updatedAt: new Date() },
];

describe('Kitchen Orders', () => {
  let component: Orders;
  let fixture: ComponentFixture<Orders>;
  let ordersServiceSpy: jasmine.SpyObj<OrdersService>;
  let branchSelectionSpy: jasmine.SpyObj<BranchSelectionService>;
  let authSpy: jasmine.SpyObj<Auth>;

  beforeEach(async () => {
    ordersServiceSpy = jasmine.createSpyObj('OrdersService', ['getOrders', 'updateOrderStatus']);
    branchSelectionSpy = jasmine.createSpyObj('BranchSelectionService', ['selectedBranchId$']);
    authSpy = jasmine.createSpyObj('Auth', ['getUserRole']);

    ordersServiceSpy.getOrders.and.returnValue(of(mockOrders));
    branchSelectionSpy.selectedBranchId$ = of('b1');
    authSpy.getUserRole.and.returnValue('cook');

    await TestBed.configureTestingModule({
      imports: [Orders],
      providers: [
        { provide: OrdersService, useValue: ordersServiceSpy },
        { provide: BranchSelectionService, useValue: branchSelectionSpy },
        { provide: Auth, useValue: authSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Orders);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load orders on init', () => {
    expect(ordersServiceSpy.getOrders).toHaveBeenCalled();
  });

  it('should only show kitchen-visible statuses (confirmed, preparing, ready)', () => {
    const kitchenStatuses = component.filteredOrders.map(o => o.status);
    expect(kitchenStatuses.every(s => ['confirmed', 'preparing', 'ready'].includes(s))).toBeTrue();
  });

  it('should filter by branch', () => {
    const allB1 = component.filteredOrders.every(o => o.branchId === 'b1');
    expect(allB1).toBeTrue();
  });

  it('should filter by selected status', () => {
    component.selectedStatus = 'preparing';
    component.applyFilter();
    expect(component.filteredOrders.every(o => o.status === 'preparing')).toBeTrue();
  });

  it('should filter by selected type', () => {
    component.selectedType = 'delivery';
    component.applyFilter();
    expect(component.filteredOrders.every(o => o.type === 'delivery')).toBeTrue();
  });

  it('should update order status', async () => {
    ordersServiceSpy.updateOrderStatus.and.returnValue(Promise.resolve());
    component.updateOrderStatus('o1', 'preparing');
    expect(ordersServiceSpy.updateOrderStatus).toHaveBeenCalledWith('o1', 'preparing');
  });

  it('should not update with invalid status', () => {
    component.updateOrderStatus('o1', 'delivered' as any);
    expect(ordersServiceSpy.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('should return status color', () => {
    expect(component.getStatusColor('confirmed')).toBe('#17a2b8');
    expect(component.getStatusColor('preparing')).toBe('#fd7e14');
    expect(component.getStatusColor('ready')).toBe('#28a745');
    expect(component.getStatusColor('unknown' as any)).toBe('#6c757d');
  });

  it('should return status label', () => {
    expect(component.getStatusLabel('confirmed')).toBe('Confirmada');
    expect(component.getStatusLabel('preparing')).toBe('Preparando');
    expect(component.getStatusLabel('ready')).toBe('Lista');
  });

  it('should return type label', () => {
    expect(component.getTypeLabel('dine_in')).toBe('Comer aquí');
    expect(component.getTypeLabel('takeout')).toBe('Para llevar');
    expect(component.getTypeLabel('delivery')).toBe('Domicilio');
  });

  it('should count orders by status', () => {
    const count = component.getOrdersCount('preparing');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should identify priority orders', () => {
    expect(component.isPriorityOrder(mockOrders[0])).toBeFalse();
    expect(component.isPriorityOrder(mockOrders[1])).toBeTrue();
  });

  it('should identify urgent orders', () => {
    expect(component.isUrgentOrder(mockOrders[0])).toBeFalse();
  });

  it('should return elapsed time for preparing orders', () => {
    expect(component.getElapsedTime(mockOrders[1])).toMatch(/^\d+m$/);
    expect(component.getElapsedTime(mockOrders[0])).toBe('');
  });

  it('should check confirm capability', () => {
    expect(component.canConfirmOrder(mockOrders[3])).toBeTrue();
    expect(component.canConfirmOrder(mockOrders[0])).toBeFalse();
  });

  it('should check start preparing capability', () => {
    expect(component.canStartPreparing(mockOrders[3])).toBeTrue();
    expect(component.canStartPreparing(mockOrders[0])).toBeTrue();
    expect(component.canStartPreparing(mockOrders[1])).toBeFalse();
  });

  it('should check mark ready capability', () => {
    expect(component.canMarkReady(mockOrders[0])).toBeTrue();
    expect(component.canMarkReady(mockOrders[1])).toBeTrue();
    expect(component.canMarkReady(mockOrders[2])).toBeFalse();
  });

  it('should filter by viewOrderId', () => {
    component.viewOrderId = 'o1';
    component.applyFilter();
    expect(component.filteredOrders.length).toBe(1);
    expect(component.filteredOrders[0].id).toBe('o1');
  });
});
