import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Orders } from './orders';
import { OrdersService } from '../../../services/orders';
import { TableService } from '../../../services/table';
import { BranchSelectionService } from '../../../services/branch-selection';
import { Auth } from '../../../services/auth';
import { MenuService } from '../../../services/menu';
import { MenuAvailabilityService } from '../../../services/menu-availability';
import { UserService } from '../../../services/user';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Order } from '../../../models/order';
import { Table } from '../../../models/table';

const mockOrders: Order[] = [
  { id: 'o1', branchId: 'b1', tableId: '1', customerId: null, type: 'dine_in', status: 'pending', items: [{ itemId: 'm1', name: 'Item1', price: 10, qty: 1, modifiers: [], notes: '' }], subtotal: 10, tax: 1.8, total: 11.8, paymentMethod: 'cash', paymentStatus: 'pending', createdAt: new Date(), updatedAt: new Date() },
  { id: 'o2', branchId: 'b1', tableId: null, customerId: null, type: 'takeout', status: 'confirmed', items: [{ itemId: 'm2', name: 'Item2', price: 20, qty: 2, modifiers: [], notes: '' }], subtotal: 40, tax: 7.2, total: 47.2, paymentMethod: 'yape', paymentStatus: 'pending', createdAt: new Date(), updatedAt: new Date() },
];

const now = new Date();
const mockTables: Table[] = [
  { id: 't1', number: 1, name: 'Mesa 1', capacity: 4, branchId: 'b1', status: 'free', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
];

describe('Waiter Orders', () => {
  let component: Orders;
  let fixture: ComponentFixture<Orders>;
  let ordersServiceSpy: jasmine.SpyObj<OrdersService>;
  let tableServiceSpy: jasmine.SpyObj<TableService>;
  let branchSelectionSpy: jasmine.SpyObj<BranchSelectionService>;
  let authSpy: jasmine.SpyObj<Auth>;
  let menuServiceSpy: jasmine.SpyObj<MenuService>;
  let availabilityServiceSpy: jasmine.SpyObj<MenuAvailabilityService>;

  beforeEach(async () => {
    ordersServiceSpy = jasmine.createSpyObj('OrdersService', ['getOrders', 'updateOrderStatus', 'createOrder', 'loadOrdersFromFirestore']);
    tableServiceSpy = jasmine.createSpyObj('TableService', ['getTables', 'updateTable']);
    branchSelectionSpy = jasmine.createSpyObj('BranchSelectionService', ['selectedBranchId$']);
    authSpy = jasmine.createSpyObj('Auth', ['getUserRole', 'isLoggedIn', 'getCurrentUser']);
    menuServiceSpy = jasmine.createSpyObj('MenuService', ['getMenuItems', 'getMenuCategories']);
    availabilityServiceSpy = jasmine.createSpyObj('MenuAvailabilityService', ['startClock', 'getPeriods', 'getSchedule', 'isItemAvailable', 'getItemPeriodLabel']);
    const userServiceSpy = jasmine.createSpyObj('UserService', ['getUsers']);

    ordersServiceSpy.getOrders.and.returnValue(of(mockOrders));
    tableServiceSpy.getTables.and.returnValue(of(mockTables));
    branchSelectionSpy.selectedBranchId$ = of('b1');
    authSpy.getUserRole.and.returnValue('waiter');
    authSpy.isLoggedIn.and.returnValue(true);
    authSpy.getCurrentUser.and.returnValue({ email: 'test@alliker.pe' } as any);
    menuServiceSpy.getMenuItems.and.returnValue(of([]));
    menuServiceSpy.getMenuCategories.and.returnValue(of([]));
    userServiceSpy.getUsers.and.returnValue(of([]));
    availabilityServiceSpy.getPeriods.and.returnValue(of([]));
    availabilityServiceSpy.getSchedule.and.returnValue(of({ closedDays: [], closedDates: [], closedMessage: '' }));
    availabilityServiceSpy.now$ = of(new Date()) as any;
    availabilityServiceSpy.isItemAvailable.and.returnValue(true);
    availabilityServiceSpy.getItemPeriodLabel.and.returnValue('');

    mockOrders[0].status = 'pending';

    await TestBed.configureTestingModule({
      imports: [Orders],
      providers: [
        { provide: OrdersService, useValue: ordersServiceSpy },
        { provide: TableService, useValue: tableServiceSpy },
        { provide: BranchSelectionService, useValue: branchSelectionSpy },
        { provide: Auth, useValue: authSpy },
        { provide: MenuService, useValue: menuServiceSpy },
        { provide: MenuAvailabilityService, useValue: availabilityServiceSpy },
        { provide: UserService, useValue: userServiceSpy },
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

  it('should filter by status', () => {
    component.selectedStatus = 'pending';
    component.applyFilter();
    expect(component.filteredOrders.every(o => o.status === 'pending')).toBeTrue();
  });

  it('should filter by type', () => {
    component.selectedType = 'takeout';
    component.applyFilter();
    expect(component.filteredOrders.every(o => o.type === 'takeout')).toBeTrue();
  });

  it('should filter by branch', () => {
    expect(component.filteredOrders.every(o => o.branchId === 'b1')).toBeTrue();
  });

  it('should update order status', () => {
    ordersServiceSpy.updateOrderStatus.and.returnValue(Promise.resolve());
    component.updateOrderStatus('o1', 'confirmed');
    expect(ordersServiceSpy.updateOrderStatus).toHaveBeenCalledWith('o1', 'confirmed');
  });

  it('should not update with invalid status', () => {
    component.updateOrderStatus('o1', 'nonexistent' as any);
    expect(ordersServiceSpy.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('should return status color', () => {
    expect(component.getStatusColor('pending')).toBe('#ffc107');
    expect(component.getStatusColor('confirmed')).toBe('#17a2b8');
    expect(component.getStatusColor('cancelled')).toBe('#dc3545');
  });

  it('should return status label', () => {
    expect(component.getStatusLabel('pending')).toBe('Pendiente');
    expect(component.getStatusLabel('delivered')).toBe('Entregada');
  });

  it('should return type label', () => {
    expect(component.getTypeLabel('dine_in')).toBe('Comer aquí');
  });

  it('should count orders by status', () => {
    expect(component.getOrdersCount('pending')).toBe(1);
    expect(component.getOrdersCount('confirmed')).toBe(1);
  });

  it('should identify priority order', () => {
    expect(component.isPriorityOrder(mockOrders[0])).toBeFalse();
  });

  it('should check confirm capability', () => {
    expect(component.canConfirmOrder(mockOrders[0])).toBeTrue();
    expect(component.canConfirmOrder(mockOrders[1])).toBeFalse();
  });

  it('should check deliver capability', () => {
    expect(component.canDeliver(mockOrders[0])).toBeFalse();
    mockOrders[0].status = 'ready';
    expect(component.canDeliver(mockOrders[0])).toBeTrue();
  });

  it('should add and remove order items', () => {
    component.addItem();
    expect(component.orderItems.length).toBe(1);
    component.removeItem(0);
    expect(component.orderItems.length).toBe(0);
  });

  it('should calculate total correctly', () => {
    component.addItem();
    component.orderItems[0] = { menuItemId: 'm1', name: 'Test', qty: 2, price: 15, notes: '' };
    expect(component.calculateTotal()).toBe(30);
  });

  it('should not create order with no items', async () => {
    await component.createOrder();
    expect(ordersServiceSpy.createOrder).not.toHaveBeenCalled();
  });

  it('should not create order with no branch', async () => {
    component.currentBranchId = '';
    component.addItem();
    component.orderItems[0] = { menuItemId: 'm1', name: 'Test', qty: 1, price: 10, notes: '' };
    await component.createOrder();
    expect(ordersServiceSpy.createOrder).not.toHaveBeenCalled();
  });

  it('should check getPaymentMethodLabel', () => {
    expect(component.getPaymentMethodLabel('cash')).toBe('Efectivo');
    expect(component.getPaymentMethodLabel('card')).toBe('Tarjeta');
    expect(component.getPaymentMethodLabel('yape')).toBe('Yape');
  });

  it('should check getPaymentStatusLabel', () => {
    expect(component.getPaymentStatusLabel('pending')).toBe('Pendiente');
    expect(component.getPaymentStatusLabel('paid')).toBe('Pagado');
  });

  it('should evaluate current availability of an item', () => {
    const item = { id: 'm1', categoryId: 'cat1', isAvailable: true } as any;
    component.menuCategories = [{ id: 'cat1', name: 'Cat1', active: true } as any];
    availabilityServiceSpy.isItemAvailable.and.returnValue(false);
    expect(component.isItemCurrentlyAvailable(item)).toBeFalse();
    availabilityServiceSpy.isItemAvailable.and.returnValue(true);
    expect(component.isItemCurrentlyAvailable(item)).toBeTrue();
  });

  it('should return the sale period label of an item', () => {
    const item = { id: 'm1', categoryId: 'cat1' } as any;
    component.menuCategories = [{ id: 'cat1', name: 'Cat1', active: true } as any];
    availabilityServiceSpy.getItemPeriodLabel.and.returnValue('Noche 17:00-01:00');
    expect(component.getItemPeriodLabel(item)).toBe('Noche 17:00-01:00');
  });

  it('should not select an item outside its sale window', () => {
    const item = { id: 'm1', categoryId: 'cat1', name: 'Lomo', price: 10 } as any;
    component.addItem();
    availabilityServiceSpy.isItemAvailable.and.returnValue(false);
    component.selectItem(0, item);
    expect(component.orderItems[0].name).not.toBe('Lomo');
    availabilityServiceSpy.isItemAvailable.and.returnValue(true);
    component.selectItem(0, item);
    expect(component.orderItems[0].name).toBe('Lomo');
  });
});
