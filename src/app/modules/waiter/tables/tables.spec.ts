import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Tables } from './tables';
import { TableService } from '../../../services/table';
import { OrdersService } from '../../../services/orders';
import { TableMergeService } from '../../../services/table-merge';
import { BranchSelectionService } from '../../../services/branch-selection';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Table } from '../../../models/table';
import { Order } from '../../../models/order';

const now = new Date();
const mockTables: Table[] = [
  { id: 't1', number: 1, name: 'Mesa 1', capacity: 4, branchId: 'b1', status: 'available', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
  { id: 't2', number: 2, name: 'Mesa 2', capacity: 2, branchId: 'b1', status: 'occupied', familyGroupId: null, permanentFamily: false, currentOrderId: 'o1', occupiedTime: new Date(), createdAt: now, updatedAt: now },
  { id: 't3', number: 3, name: 'Mesa 3', capacity: 6, branchId: 'b1', status: 'reserved', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
  { id: 't4', number: 4, name: 'Mesa 4', capacity: 4, branchId: 'b2', status: 'available', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
  { id: 't5', number: 5, name: 'Mesa 5', capacity: 4, branchId: 'b1', status: 'available', familyGroupId: 'fam1', permanentFamily: true, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
  { id: 't6', number: 6, name: 'Mesa 6', capacity: 4, branchId: 'b1', status: 'available', familyGroupId: 'fam1', permanentFamily: true, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
];

const mockOrders: Order[] = [
  { id: 'o1', branchId: 'b1', tableId: '2', customerId: null, type: 'dine_in', status: 'pending', items: [], subtotal: 50, tax: 9, total: 59, paymentMethod: 'cash', paymentStatus: 'pending', createdAt: new Date(), updatedAt: new Date() },
];

describe('Waiter Tables', () => {
  let component: Tables;
  let fixture: ComponentFixture<Tables>;
  let tableServiceSpy: jasmine.SpyObj<TableService>;
  let ordersServiceSpy: jasmine.SpyObj<OrdersService>;
  let tableMergeServiceSpy: jasmine.SpyObj<TableMergeService>;
  let branchSelectionSpy: jasmine.SpyObj<BranchSelectionService>;
  let router: Router;

  beforeEach(async () => {
    tableServiceSpy = jasmine.createSpyObj('TableService', ['getTables', 'updateTable']);
    ordersServiceSpy = jasmine.createSpyObj('OrdersService', ['getOrders', 'updateOrderStatus']);
    tableMergeServiceSpy = jasmine.createSpyObj('TableMergeService', ['mergeTables', 'unmergeTables', 'completeFamilyOrder']);
    branchSelectionSpy = jasmine.createSpyObj('BranchSelectionService', ['selectedBranchId$']);

    tableServiceSpy.getTables.and.returnValue(of(mockTables));
    ordersServiceSpy.getOrders.and.returnValue(of(mockOrders));
    branchSelectionSpy.selectedBranchId$ = of('b1');

    await TestBed.configureTestingModule({
      imports: [Tables],
      providers: [
        { provide: TableService, useValue: tableServiceSpy },
        { provide: OrdersService, useValue: ordersServiceSpy },
        { provide: TableMergeService, useValue: tableMergeServiceSpy },
        { provide: BranchSelectionService, useValue: branchSelectionSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Tables);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load tables on init', () => {
    expect(tableServiceSpy.getTables).toHaveBeenCalled();
  });

  it('should filter tables by branch', () => {
    expect(component.filteredTables().every(t => t.branchId === 'b1')).toBeTrue();
  });

  it('should filter by search term', () => {
    component.searchTerm.set('Mesa 1');
    fixture.detectChanges();
    expect(component.filteredTables().length).toBe(1);
    expect(component.filteredTables()[0].name).toContain('Mesa 1');
  });

  it('should filter by status', () => {
    component.selectedStatus.set('occupied');
    fixture.detectChanges();
    expect(component.filteredTables().every(t => t.status === 'occupied')).toBeTrue();
  });

  it('should compute stats', () => {
    const stats = component.stats();
    expect(stats.length).toBe(4);
    expect(stats[0].label).toBe('Total');
  });

  it('should return status icon', () => {
    expect(component.getStatusIcon('available')).toContain('fa-check');
    expect(component.getStatusIcon('occupied')).toContain('fa-utensils');
  });

  it('should return status bg class', () => {
    expect(component.getStatusBg('available')).toContain('bg-success');
    expect(component.getStatusBg('occupied')).toContain('bg-primary');
  });

  it('should return status badge class', () => {
    const cls = component.getStatusBadgeClass('available');
    expect(cls).toContain('bg-success-subtle');
  });

  it('should return status label', () => {
    expect(component.getStatusLabel('available')).toBe('Libre');
    expect(component.getStatusLabel('occupied')).toBe('Ocupada');
    expect(component.getStatusLabel('family_merged')).toBe('Mesa Familiar');
  });

  it('should find current order for table', () => {
    const table = mockTables[1];
    const order = component.getCurrentOrderForTable(table);
    expect(order?.id).toBe('o1');
  });

  it('should return table name by order id', () => {
    const name = component.getTableNameByOrderId('o1');
    expect(name).toBe('Mesa 2');
  });

  it('should format time diff', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(component.formatTimeDiff(fiveMinAgo)).toBe('5m');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(component.formatTimeDiff(twoHoursAgo)).toContain('h');
  });

  it('should toggle merge mode', () => {
    expect(component.mergeMode()).toBeFalse();
    component.toggleMergeMode();
    expect(component.mergeMode()).toBeTrue();
    component.toggleMergeMode();
    expect(component.mergeMode()).toBeFalse();
  });

  it('should toggle table selection for merge', () => {
    component.toggleTableSelection('t1');
    expect(component.isTableSelected('t1')).toBeTrue();
    component.toggleTableSelection('t1');
    expect(component.isTableSelected('t1')).toBeFalse();
  });

  it('should not confirm merge with fewer than 2 tables', () => {
    component.toggleTableSelection('t1');
    component.confirmMerge();
    expect(tableMergeServiceSpy.mergeTables).not.toHaveBeenCalled();
  });

  it('should confirm merge with 2+ tables', () => {
    tableMergeServiceSpy.mergeTables.and.returnValue(Promise.resolve() as any);
    component.toggleTableSelection('t1');
    component.toggleTableSelection('t2');
    component.confirmMerge();
    expect(tableMergeServiceSpy.mergeTables).toHaveBeenCalled();
  });

  it('should cancel merge', () => {
    component.mergeMode.set(true);
    component.selectedForMerge.set(new Set(['t1']));
    component.cancelMerge();
    expect(component.mergeMode()).toBeFalse();
    expect(component.selectedForMerge().size).toBe(0);
  });

  it('should warn when separating permanent family table', () => {
    spyOn(window, 'alert');
    const famTable = component.familyComposites().find(f => f.familyGroupId === 'fam1')!;
    component.separateTables(famTable);
    expect(window.alert).toHaveBeenCalledWith('Esta mesa familiar es permanente. Solo el administrador puede separarla.');
  });

  it('should get family children', () => {
    const children = component.getFamilyChildren(mockTables[4]);
    expect(children.length).toBe(2);
  });

  it('should get combined capacity', () => {
    expect(component.getCombinedCapacity(mockTables[4])).toBe(8);
  });

  it('should get family display name', () => {
    expect(component.getFamilyDisplayName(mockTables[4])).toContain('Mesa Familiar');
    expect(component.getFamilyDisplayName(mockTables[0])).toBe('Mesa 1');
  });

  it('should navigate to new order', () => {
    const navigateSpy = spyOn(router, 'navigateByUrl');
    component.onNewOrder();
    expect(navigateSpy).toHaveBeenCalledWith('/waiter/orders?create=true');
  });

  it('should open order detail modal', () => {
    component.viewOrder(mockOrders[0]);
    expect(component.selectedOrder()?.id).toBe('o1');
  });

  it('should complete order and redirect to payment', () => {
    ordersServiceSpy.updateOrderStatus.and.returnValue(Promise.resolve());
    const navigateSpy = spyOn(router, 'navigateByUrl');
    component.completeOrder(mockOrders[0]);
    expect(ordersServiceSpy.updateOrderStatus).toHaveBeenCalledWith('o1', 'delivered');
  });

  it('should manage selected table modal', () => {
    component.showActions(mockTables[0]);
    expect(component.selectedTable()?.id).toBe('t1');
    component.closeTableModal();
    expect(component.selectedTable()).toBeNull();
  });

  it('should update single table status', () => {
    tableServiceSpy.updateTable.and.returnValue(Promise.resolve());
    component.selectedTable.set(mockTables[0]);
    component.updateTableStatus('occupied');
    expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t1', { status: 'occupied' });
  });

  it('should free table', () => {
    tableServiceSpy.updateTable.and.returnValue(Promise.resolve());
    component.selectedTable.set(mockTables[0]);
    component.freeTable();
    expect(tableServiceSpy.updateTable).toHaveBeenCalledWith('t1', { status: 'available', currentOrderId: null, occupiedTime: null });
  });
});
