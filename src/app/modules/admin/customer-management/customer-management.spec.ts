import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerManagement } from './customer-management';
import { CustomerService } from '../../../services/customer';
import { of } from 'rxjs';
import { Customer } from '../../../models/customer';

const now = new Date();
const mockCustomers: Customer[] = [
  { id: 'c1', name: 'Juan Pérez', email: 'juan@test.com', phone: '999888777', totalOrders: 3, favoriteItems: ['Ceviche', 'Lomo Saltado'], lastOrderAt: null, createdAt: now },
  { id: 'c2', name: 'María García', email: 'maria@test.com', phone: '999888666', totalOrders: 1, favoriteItems: ['Ají de Gallina'], lastOrderAt: null, createdAt: now },
];

describe('CustomerManagement', () => {
  let component: CustomerManagement;
  let fixture: ComponentFixture<CustomerManagement>;
  let customerServiceSpy: jasmine.SpyObj<CustomerService>;

  beforeEach(async () => {
    customerServiceSpy = jasmine.createSpyObj('CustomerService', ['getCustomers', 'registerCustomer', 'updateCustomer', 'deleteCustomer']);
    customerServiceSpy.getCustomers.and.returnValue(of(mockCustomers));

    await TestBed.configureTestingModule({
      imports: [CustomerManagement],
      providers: [
        { provide: CustomerService, useValue: customerServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CustomerManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load customers on init', () => {
    expect(customerServiceSpy.getCustomers).toHaveBeenCalled();
  });

  it('should filter customers by search', () => {
    component.searchTerm = 'Juan';
    component.onSearch();
    expect(component.filteredCustomers$).toBeTruthy();
  });

  it('should open add form', () => {
    component.addNewCustomer();
    expect(component.showAddForm).toBeTrue();
    expect(component.editingCustomer).toBeNull();
  });

  it('should edit customer', () => {
    component.editCustomer(mockCustomers[0]);
    expect(component.showAddForm).toBeTrue();
    expect(component.editingCustomer?.id).toBe('c1');
    expect(component.favoriteItemsString).toBe('Ceviche, Lomo Saltado');
  });

  it('should validate name on save', async () => {
    spyOn(window, 'alert');
    component.newCustomer.name = 'Juan123';
    await component.saveCustomer();
    expect(component.nameError).toBe('Solo se permiten letras y espacios');
  });

  it('should validate phone on save', async () => {
    component.newCustomer.name = 'Juan';
    component.newCustomer.phone = 'abc123';
    await component.saveCustomer();
    expect(component.phoneError).toBe('Solo se permiten números (máximo 9 dígitos)');
  });

  it('should update existing customer', async () => {
    customerServiceSpy.updateCustomer.and.returnValue(Promise.resolve());
    component.editingCustomer = mockCustomers[0];
    component.newCustomer = { ...mockCustomers[0] };
    component.favoriteItemsString = 'Ceviche, Lomo Saltado';
    await component.saveCustomer();
    expect(customerServiceSpy.updateCustomer).toHaveBeenCalled();
  });

  it('should register new customer', async () => {
    customerServiceSpy.registerCustomer.and.returnValue(Promise.resolve({ success: true }));
    component.newCustomer.name = 'Nuevo Cliente';
    component.newCustomer.email = 'nuevo@test.com';
    component.newCustomer.phone = '999888555';
    await component.saveCustomer();
    expect(customerServiceSpy.registerCustomer).toHaveBeenCalledWith('Nuevo Cliente', 'nuevo@test.com', '999888555');
  });

  it('should cancel edit and reset form', () => {
    component.showAddForm = true;
    component.editingCustomer = mockCustomers[0];
    component.cancelEdit();
    expect(component.showAddForm).toBeFalse();
    expect(component.editingCustomer).toBeNull();
  });

  it('should filter name input', () => {
    const event = { target: { value: 'Juan123' } } as any;
    component.onNameInput(event);
    expect(component.newCustomer.name).toBe('Juan');
  });

  it('should filter phone input', () => {
    const event = { target: { value: '999888777abc' } } as any;
    component.onPhoneInput(event);
    expect(component.newCustomer.phone).toBe('999888777');
  });
});
