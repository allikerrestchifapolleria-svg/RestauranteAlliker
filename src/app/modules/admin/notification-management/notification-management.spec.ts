import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationManagement } from './notification-management';
import { NotificationService } from '../../../services/notification';
import { BranchService } from '../../../services/branch';
import { of } from 'rxjs';
import { Notification } from '../../../models/notification';
import { Branch } from '../../../models/branch';

const now = new Date();
const mockNotifications: Notification[] = [
  { id: 'n1', title: 'Bienvenido', message: 'Sistema listo', type: 'info', read: false, targetRole: null, branchId: null, userId: null, createdAt: now },
  { id: 'n2', title: 'Nuevo Pedido', message: 'Orden #123 creada', type: 'success', read: true, targetRole: ['waiter'], branchId: 'b1', userId: null, createdAt: now },
];

const mockBranches: Branch[] = [
  { id: 'b1', name: 'Centro', address: '', phone: '', branchId: 'SUCC001', status: 'open', openingHours: {}, createdAt: now, updatedAt: now },
];

describe('NotificationManagement', () => {
  let component: NotificationManagement;
  let fixture: ComponentFixture<NotificationManagement>;
  let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;

  beforeEach(async () => {
    notificationServiceSpy = jasmine.createSpyObj('NotificationService', ['getNotifications', 'createNotification', 'updateNotification', 'deleteNotification', 'markAsRead', 'markAsUnread']);
    branchServiceSpy = jasmine.createSpyObj('BranchService', ['getBranches']);

    notificationServiceSpy.getNotifications.and.returnValue(of(mockNotifications));
    branchServiceSpy.getBranches.and.returnValue(of(mockBranches));

    await TestBed.configureTestingModule({
      imports: [NotificationManagement],
      providers: [
        { provide: NotificationService, useValue: notificationServiceSpy },
        { provide: BranchService, useValue: branchServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load notifications on init', () => {
    expect(notificationServiceSpy.getNotifications).toHaveBeenCalled();
  });

  it('should load branches on init', () => {
    expect(branchServiceSpy.getBranches).toHaveBeenCalled();
    expect(component.branches.length).toBe(1);
  });

  it('should filter notifications by search', () => {
    component.searchTerm = 'Bienvenido';
    component.onSearch();
    expect(component.filteredNotifications$).toBeTruthy();
  });

  it('should open add form', () => {
    component.addNewNotification();
    expect(component.showAddForm).toBeTrue();
    expect(component.editingNotification).toBeNull();
  });

  it('should edit notification', () => {
    component.editNotification(mockNotifications[0]);
    expect(component.showAddForm).toBeTrue();
    expect(component.editingNotification?.id).toBe('n1');
  });

  it('should check role selection', () => {
    component.newNotification.targetRole = ['waiter', 'admin'];
    expect(component.isRoleSelected('waiter')).toBeTrue();
    expect(component.isRoleSelected('cook')).toBeFalse();
  });

  it('should identify general notification', () => {
    component.newNotification.targetRole = null;
    expect(component.isGeneral()).toBeTrue();
    component.newNotification.targetRole = ['waiter'];
    expect(component.isGeneral()).toBeFalse();
  });

  it('should set general notification', () => {
    component.newNotification.targetRole = ['waiter'];
    component.setGeneralNotification();
    expect(component.newNotification.targetRole).toBeNull();
  });

  it('should toggle role selection', () => {
    component.newNotification.targetRole = null;
    component.toggleRole('waiter');
    expect(component.newNotification.targetRole).toEqual(['waiter']);

    component.toggleRole('admin');
    expect(component.newNotification.targetRole).toEqual(['waiter', 'admin']);

    component.toggleRole('waiter');
    expect(component.newNotification.targetRole).toEqual(['admin']);

    component.toggleRole('admin');
    expect(component.newNotification.targetRole).toBeNull();
  });

  it('should create new notification', async () => {
    notificationServiceSpy.createNotification.and.returnValue(Promise.resolve());
    component.newNotification.type = 'info';
    component.newNotification.title = 'Test';
    component.newNotification.message = 'Message';
    await component.saveNotification();
    expect(notificationServiceSpy.createNotification).toHaveBeenCalled();
  });

  it('should update existing notification', async () => {
    notificationServiceSpy.updateNotification.and.returnValue(Promise.resolve());
    component.editingNotification = mockNotifications[0];
    component.newNotification = { ...mockNotifications[0] };
    await component.saveNotification();
    expect(notificationServiceSpy.updateNotification).toHaveBeenCalled();
  });

  it('should cancel edit', () => {
    component.showAddForm = true;
    component.editingNotification = mockNotifications[0];
    component.cancelEdit();
    expect(component.showAddForm).toBeFalse();
    expect(component.editingNotification).toBeNull();
  });

  it('should get branch name', () => {
    expect(component.getBranchName('b1')).toBe('Centro');
    expect(component.getBranchName(null)).toBe('Todas las sucursales');
  });

  it('should get target role labels', () => {
    expect(component.getTargetRoleLabels(null)).toBe('General (todos)');
    expect(component.getTargetRoleLabels(['waiter'])).toBe('Mozos');
    expect(component.getTargetRoleLabels(['waiter', 'cook'])).toBe('Mozos, Cocineros');
  });
});
