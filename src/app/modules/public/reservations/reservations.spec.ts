import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Reservations } from './reservations';
import { BranchService } from '../../../services/branch';
import { ReservationsService } from '../../../services/reservations';
import { TableService } from '../../../services/table';
import { of } from 'rxjs';
import { Table } from '../../../models/table';

const now = new Date();
const mockTables: Table[] = [
  { id: 't1', number: 1, name: 'Mesa 1', capacity: 4, branchId: 'b1', status: 'available', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
  { id: 't2', number: 2, name: 'Mesa 2', capacity: 2, branchId: 'b1', status: 'available', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
  { id: 't3', number: 3, name: 'Mesa 3', capacity: 6, branchId: 'b2', status: 'occupied', familyGroupId: null, permanentFamily: false, currentOrderId: 'o1', occupiedTime: new Date(), createdAt: now, updatedAt: now },
];

describe('Reservations Component', () => {
  let component: Reservations;
  let fixture: ComponentFixture<Reservations>;
  let branchServiceSpy: jasmine.SpyObj<BranchService>;
  let reservationsServiceSpy: jasmine.SpyObj<ReservationsService>;
  let tableServiceSpy: jasmine.SpyObj<TableService>;

  beforeEach(async () => {
    branchServiceSpy = jasmine.createSpyObj('BranchService', ['getBranches']);
    reservationsServiceSpy = jasmine.createSpyObj('ReservationsService', ['createReservation']);
    tableServiceSpy = jasmine.createSpyObj('TableService', ['getTables']);

    branchServiceSpy.getBranches.and.returnValue(of([]));
    tableServiceSpy.getTables.and.returnValue(of(mockTables));

    await TestBed.configureTestingModule({
      imports: [Reservations],
      providers: [
        { provide: BranchService, useValue: branchServiceSpy },
        { provide: ReservationsService, useValue: reservationsServiceSpy },
        { provide: TableService, useValue: tableServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Reservations);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with default values', () => {
    expect(component.reservationForm.get('peopleCount')?.value).toBe(1);
    expect(component.reservationForm.get('acceptTerms')?.value).toBeFalse();
  });

  it('should have required fields', () => {
    const form = component.reservationForm;
    expect(form.get('name')?.hasError('required')).toBeTrue();
    expect(form.get('email')?.hasError('required')).toBeTrue();
    expect(form.get('phone')?.hasError('required')).toBeTrue();
    expect(form.get('branchId')?.hasError('required')).toBeTrue();
    expect(form.get('tableId')?.hasError('required')).toBeTrue();
    expect(form.get('date')?.hasError('required')).toBeTrue();
    expect(form.get('time')?.hasError('required')).toBeTrue();
  });

  it('should validate name pattern (letters only)', () => {
    const nameControl = component.reservationForm.get('name');
    nameControl?.setValue('Juan123');
    expect(nameControl?.hasError('pattern')).toBeTrue();
    nameControl?.setValue('Juan Pérez');
    expect(nameControl?.hasError('pattern')).toBeFalse();
  });

  it('should validate email format', () => {
    const emailControl = component.reservationForm.get('email');
    emailControl?.setValue('invalid');
    expect(emailControl?.hasError('email')).toBeTrue();
    emailControl?.setValue('test@example.com');
    expect(emailControl?.hasError('email')).toBeFalse();
  });

  it('should validate phone pattern (digits only, max 9)', () => {
    const phoneControl = component.reservationForm.get('phone');
    phoneControl?.setValue('abc');
    expect(phoneControl?.hasError('pattern')).toBeTrue();
    phoneControl?.setValue('999888777');
    expect(phoneControl?.hasError('pattern')).toBeFalse();
  });

  it('should validate peopleCount min 1', () => {
    const countControl = component.reservationForm.get('peopleCount');
    countControl?.setValue(0);
    expect(countControl?.hasError('min')).toBeTrue();
    countControl?.setValue(1);
    expect(countControl?.hasError('min')).toBeFalse();
  });

  it('should require acceptTerms to be true', () => {
    const termsControl = component.reservationForm.get('acceptTerms');
    expect(termsControl?.hasError('required')).toBeTrue();
    termsControl?.setValue(true);
    expect(termsControl?.hasError('required')).toBeFalse();
  });

  it('should mark form as invalid when incomplete', () => {
    expect(component.reservationForm.valid).toBeFalse();
  });

  it('should update available tables when branch changes', () => {
    component.reservationForm.get('branchId')?.setValue('b1');
    expect(component.availableTables.length).toBe(2);
    expect(component.availableTables.every(t => t.branchId === 'b1')).toBeTrue();
  });

  it('should clear available tables when branch is empty', () => {
    component.updateAvailableTables('');
    expect(component.availableTables.length).toBe(0);
  });

  it('should reset tableId when branch changes', () => {
    component.reservationForm.get('tableId')?.setValue('t1');
    component.reservationForm.get('branchId')?.setValue('b2');
    expect(component.reservationForm.get('tableId')?.value).toBe('');
  });

  it('should reset form on resetForm', () => {
    component.reservationForm.get('name')?.setValue('Test');
    component.resetForm();
    expect(component.reservationForm.get('name')?.value).toBeNull();
  });

  it('should clear time on date change', () => {
    component.reservationForm.get('time')?.setValue('12:00');
    component.onDateChange();
    expect(component.reservationForm.get('time')?.value).toBe('');
  });

  it('should not submit invalid form', async () => {
    await component.onSubmit();
    expect(component.errorMessage).toBe('Completa todos los campos');
    expect(reservationsServiceSpy.createReservation).not.toHaveBeenCalled();
  });

  it('should submit valid form', async () => {
    reservationsServiceSpy.createReservation.and.returnValue(Promise.resolve('res1'));

    component.reservationForm.get('name')?.setValue('Juan Pérez');
    component.reservationForm.get('email')?.setValue('juan@test.com');
    component.reservationForm.get('phone')?.setValue('999888777');
    component.reservationForm.get('branchId')?.setValue('b1');
    component.reservationForm.get('tableId')?.setValue('t1');
    component.reservationForm.get('date')?.setValue('2026-06-01');
    component.reservationForm.get('time')?.setValue('12:00');
    component.reservationForm.get('peopleCount')?.setValue(2);
    component.reservationForm.get('acceptTerms')?.setValue(true);

    await component.onSubmit();

    expect(reservationsServiceSpy.createReservation).toHaveBeenCalled();
  });

  it('should handle submission error', async () => {
    reservationsServiceSpy.createReservation.and.returnValue(Promise.reject('error'));

    component.reservationForm.get('name')?.setValue('Juan Pérez');
    component.reservationForm.get('email')?.setValue('juan@test.com');
    component.reservationForm.get('phone')?.setValue('999888777');
    component.reservationForm.get('branchId')?.setValue('b1');
    component.reservationForm.get('tableId')?.setValue('t1');
    component.reservationForm.get('date')?.setValue('2026-06-01');
    component.reservationForm.get('time')?.setValue('12:00');
    component.reservationForm.get('acceptTerms')?.setValue(true);

    await component.onSubmit();

    expect(component.errorMessage).toBe('Error al crear la reserva');
  });
});
