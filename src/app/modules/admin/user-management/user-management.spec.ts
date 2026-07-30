import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserManagement } from './user-management';
import { UserService } from '../../../services/user';
import { BranchService } from '../../../services/branch';
import { of } from 'rxjs';
import { AppUser } from '../../../models/user';
import { Branch } from '../../../models/branch';

const mockUsers: AppUser[] = [
  { id: 'u1', firstName: 'Admin', lastName: 'User', email: 'admin@test.com', role: 'admin', branchId: 'b1', password: '123' } as AppUser,
  { id: 'u2', firstName: 'Waiter', lastName: 'Uno', email: 'waiter@test.com', role: 'waiter', branchId: 'b1', password: '123' } as AppUser,
];

const now = new Date();
const mockBranches: Branch[] = [
  { id: 'b1', name: 'Centro', address: '', phone: '', branchId: 'SUCC001', status: 'open', openingHours: {}, createdAt: now, updatedAt: now },
];

describe('UserManagement', () => {
  let component: UserManagement;
  let fixture: ComponentFixture<UserManagement>;
  let userServiceSpy: jasmine.SpyObj<UserService>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;

  beforeEach(async () => {
    userServiceSpy = jasmine.createSpyObj('UserService', ['getUsers', 'createUser', 'updateUser', 'deleteUser']);
    branchServiceSpy = jasmine.createSpyObj('BranchService', ['getBranches']);

    userServiceSpy.getUsers.and.returnValue(of(mockUsers));
    branchServiceSpy.getBranches.and.returnValue(of(mockBranches));

    await TestBed.configureTestingModule({
      imports: [UserManagement],
      providers: [
        { provide: UserService, useValue: userServiceSpy },
        { provide: BranchService, useValue: branchServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load users and branches on init', () => {
    expect(userServiceSpy.getUsers).toHaveBeenCalled();
    expect(branchServiceSpy.getBranches).toHaveBeenCalled();
  });

  it('should get branch name', () => {
    expect(component.getBranchName('b1')).toBe('Centro');
    expect(component.getBranchName(null)).toBe('N/A');
  });

  it('should not create user with missing fields', () => {
    component.createUser();
    expect(component.errorMessage).toBe('Por favor complete todos los campos requeridos');
    expect(userServiceSpy.createUser).not.toHaveBeenCalled();
  });

  it('should validate name with letters only on create', () => {
    component.nombre = 'Juan123';
    component.apellidos = 'Pérez';
    component.newUser = { email: 'test@test.com', role: 'waiter', branchId: 'b1' };
    component.createUser();
    expect(component.errorMessage).toBe('Nombre y apellidos solo permiten letras y espacios');
    expect(userServiceSpy.createUser).not.toHaveBeenCalled();
  });

  it('should create user with valid data', (done) => {
    userServiceSpy.createUser.and.returnValue(Promise.resolve());

    component.nombre = 'Juan';
    component.apellidos = 'Pérez';
    component.newUser = { email: 'test@test.com', role: 'waiter', branchId: 'b1', password: '' };
    component.createUser();

    setTimeout(() => {
      expect(userServiceSpy.createUser).toHaveBeenCalled();
      expect(component.successMessage).toBe('Usuario creado exitosamente');
      done();
    }, 100);
  });

  it('should generate password', () => {
    const pwd = component.generatePassword();
    expect(pwd.length).toBe(8);
  });

  it('should generate and show password', () => {
    component.generateAndShowPassword();
    expect(component.newUser.password.length).toBe(8);
  });

  it('should edit user', () => {
    component.editUser(mockUsers[0]);
    expect(component.editingUser?.id).toBe('u1');
    expect(component.editingNombre).toBe('Admin');
  });

  it('should validate editing name', () => {
    component.editingUser = { ...mockUsers[0] };
    component.editingNombre = 'Admin123';
    component.updateUser();
    expect(component.errorMessage).toBe('El nombre solo permite letras y espacios');
  });

  it('should update user', (done) => {
    userServiceSpy.updateUser.and.returnValue(Promise.resolve());
    component.editingUser = { ...mockUsers[0] };
    component.editingNombre = 'Admin';
    component.editingApellidos = 'User';
    component.updateUser();

    setTimeout(() => {
      expect(component.editingUser).toBeNull();
      done();
    }, 100);
  });

  it('should cancel edit', () => {
    component.editingUser = mockUsers[0];
    component.cancelEdit();
    expect(component.editingUser).toBeNull();
  });

  it('should get full name', () => {
    expect(component.getFullName(mockUsers[0])).toBe('Admin User');
  });

  it('should get role label', () => {
    expect(component.getRoleLabel('admin')).toBe('Admin');
    expect(component.getRoleLabel('waiter')).toBe('Mozo');
    expect(component.getRoleLabel('cook')).toBe('Cocinero');
    expect(component.getRoleLabel('user')).toBe('Cliente');
  });

  it('should filter nombre input', () => {
    const event = { target: { value: 'Juan123' } } as any;
    component.onNombreInput(event);
    expect(component.nombre).toBe('Juan');
  });

  it('should filter apellidos input', () => {
    const event = { target: { value: 'Pérez123' } } as any;
    component.onApellidosInput(event);
    expect(component.apellidos).toBe('Pérez');
  });
});
