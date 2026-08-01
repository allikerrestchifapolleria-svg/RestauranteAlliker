// ============================================================================
// RESERVACIONES DESHABILITADO (posible implementación futura)
// Código comentado línea a línea para conservarlo. Para revertir:
//   - Quitar el prefijo "// " de cada línea.
//   - Restaurar el import y la ruta en public-routing-module.ts.
//   - Restaurar los enlaces de navegación y el botón de reserva del mozo.
// ============================================================================
// import { ComponentFixture, TestBed } from '@angular/core/testing';
// import { Reservations } from './reservations';
// import { BranchService } from '../../../services/branch';
// import { ReservationsService } from '../../../services/reservations';
// import { TableService } from '../../../services/table';
// import { of, Subject } from 'rxjs';
// import { SwUpdate } from '@angular/service-worker';
// import { provideRouter } from '@angular/router';
// import { Table } from '../../../models/table';
// import { Branch } from '../../../models/branch';
// import { VoiceConfirmationService, VoiceConfirmationError } from '../../../services/voice-confirmation';
// 
// const now = new Date();
// const mockTables: Table[] = [
//   { id: 't1', number: 1, name: 'Mesa 1', capacity: 4, branchId: 'b1', status: 'available', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
//   { id: 't2', number: 2, name: 'Mesa 2', capacity: 2, branchId: 'b1', status: 'available', familyGroupId: null, permanentFamily: false, currentOrderId: null, occupiedTime: null, createdAt: now, updatedAt: now },
//   { id: 't3', number: 3, name: 'Mesa 3', capacity: 6, branchId: 'b2', status: 'occupied', familyGroupId: null, permanentFamily: false, currentOrderId: 'o1', occupiedTime: new Date(), createdAt: now, updatedAt: now },
// ];
// 
// const mockBranches: Branch[] = [
//   { id: 'b1', name: 'Trujillo', address: 'Av. España 123', phone: '999888777', branchId: 'SUCC001', status: 'open', openingHours: {}, createdAt: now, updatedAt: now },
//   { id: 'b2', name: 'Sucursal Chao', address: 'Av. Chao 456', phone: '999888666', branchId: 'SUCC002', status: 'open', openingHours: {}, createdAt: now, updatedAt: now },
// ];
// 
// const futureDate = (() => {
//   const d = new Date(Date.now() + 2 * 86400000);
//   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// })();
// 
// describe('Reservations Component', () => {
//   let component: Reservations;
//   let fixture: ComponentFixture<Reservations>;
//   let branchServiceSpy: jasmine.SpyObj<BranchService>;
//   let reservationsServiceSpy: jasmine.SpyObj<ReservationsService>;
//   let tableServiceSpy: jasmine.SpyObj<TableService>;
//   let voiceConfirmationServiceSpy: jasmine.SpyObj<VoiceConfirmationService>;
// 
//   beforeEach(async () => {
//     branchServiceSpy = jasmine.createSpyObj('BranchService', ['getBranches']);
//     reservationsServiceSpy = jasmine.createSpyObj('ReservationsService', ['createReservation', 'watchReservationStatus', 'updateReservationStatus']);
//     tableServiceSpy = jasmine.createSpyObj('TableService', ['getTables', 'getTableDisplayName']);
//     voiceConfirmationServiceSpy = jasmine.createSpyObj('VoiceConfirmationService', ['requestAccessToken']);
// 
//     branchServiceSpy.getBranches.and.returnValue(of([]));
//     tableServiceSpy.getTables.and.returnValue(of(mockTables));
//     tableServiceSpy.getTableDisplayName.and.returnValue('Mesa 1');
//     reservationsServiceSpy.watchReservationStatus.and.returnValue(of('pending'));
//     reservationsServiceSpy.updateReservationStatus.and.resolveTo();
//     voiceConfirmationServiceSpy.requestAccessToken.and.rejectWith(new VoiceConfirmationError('no', null));
// 
//     await TestBed.configureTestingModule({
//       imports: [Reservations],
//       providers: [
//         provideRouter([]),
//         { provide: BranchService, useValue: branchServiceSpy },
//         { provide: ReservationsService, useValue: reservationsServiceSpy },
//         { provide: TableService, useValue: tableServiceSpy },
//         { provide: VoiceConfirmationService, useValue: voiceConfirmationServiceSpy },
//         { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: of() } },
//       ]
//     }).compileComponents();
// 
//     fixture = TestBed.createComponent(Reservations);
//     component = fixture.componentInstance;
//     fixture.detectChanges();
//   });
// 
//   it('should create', () => {
//     expect(component).toBeTruthy();
//   });
// 
//   it('should use the local date for the min date selector, not UTC', () => {
//     const now = new Date();
//     const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
//     expect(component.today).toBe(local);
//   });
// 
//   it('should only show the Trujillo branch', () => {
//     branchServiceSpy.getBranches.and.returnValue(of(mockBranches));
//     fixture = TestBed.createComponent(Reservations);
//     component = fixture.componentInstance;
//     fixture.detectChanges();
//     expect(component.branches.length).toBe(1);
//     expect(component.branches[0].name.toLowerCase()).toContain('trujillo');
//     expect(component.branches[0].name).not.toContain('Chao');
//   });
// 
//   it('should initialize form with default values', () => {
//     expect(component.reservationForm.get('peopleCount')?.value).toBe(1);
//     expect(component.reservationForm.get('acceptTerms')?.value).toBeFalse();
//   });
// 
//   it('should have required fields', () => {
//     const form = component.reservationForm;
//     expect(form.get('name')?.hasError('required')).toBeTrue();
//     expect(form.get('email')?.hasError('required')).toBeTrue();
//     expect(form.get('phone')?.hasError('required')).toBeTrue();
//     expect(form.get('branchId')?.hasError('required')).toBeTrue();
//     expect(form.get('tableId')?.hasError('required')).toBeTrue();
//     expect(form.get('date')?.hasError('required')).toBeTrue();
//     expect(form.get('time')?.hasError('required')).toBeTrue();
//   });
// 
//   it('should validate name pattern (letters only)', () => {
//     const nameControl = component.reservationForm.get('name');
//     nameControl?.setValue('Juan123');
//     expect(nameControl?.hasError('pattern')).toBeTrue();
//     nameControl?.setValue('Juan Pérez');
//     expect(nameControl?.hasError('pattern')).toBeFalse();
//   });
// 
//   it('should validate email format', () => {
//     const emailControl = component.reservationForm.get('email');
//     emailControl?.setValue('invalid');
//     expect(emailControl?.hasError('email')).toBeTrue();
//     emailControl?.setValue('test@example.com');
//     expect(emailControl?.hasError('email')).toBeFalse();
//   });
// 
//   it('should validate phone pattern (digits only, max 9)', () => {
//     const phoneControl = component.reservationForm.get('phone');
//     phoneControl?.setValue('abc');
//     expect(phoneControl?.hasError('pattern')).toBeTrue();
//     phoneControl?.setValue('999888777');
//     expect(phoneControl?.hasError('pattern')).toBeFalse();
//   });
// 
//   it('should validate peopleCount min 1', () => {
//     const countControl = component.reservationForm.get('peopleCount');
//     countControl?.setValue(0);
//     expect(countControl?.hasError('min')).toBeTrue();
//     countControl?.setValue(1);
//     expect(countControl?.hasError('min')).toBeFalse();
//   });
// 
//   it('should require acceptTerms to be true', () => {
//     const termsControl = component.reservationForm.get('acceptTerms');
//     expect(termsControl?.hasError('required')).toBeTrue();
//     termsControl?.setValue(true);
//     expect(termsControl?.hasError('required')).toBeFalse();
//   });
// 
//   it('should mark form as invalid when incomplete', () => {
//     expect(component.reservationForm.valid).toBeFalse();
//   });
// 
//   it('should update available tables when branch changes', () => {
//     component.reservationForm.get('branchId')?.setValue('b1');
//     expect(component.availableTables.length).toBe(2);
//     expect(component.availableTables.every(t => t.branchId === 'b1')).toBeTrue();
//   });
// 
//   it('should clear available tables when branch is empty', () => {
//     component.updateAvailableTables('');
//     expect(component.availableTables.length).toBe(0);
//   });
// 
//   it('should reset tableId when branch changes', () => {
//     component.reservationForm.get('tableId')?.setValue('t1');
//     component.reservationForm.get('branchId')?.setValue('b2');
//     expect(component.reservationForm.get('tableId')?.value).toBe('');
//   });
// 
//   it('should reset form on resetForm', () => {
//     component.reservationForm.get('name')?.setValue('Test');
//     component.resetForm();
//     expect(component.reservationForm.get('name')?.value).toBeNull();
//   });
// 
//   it('should clear time on date change', () => {
//     component.reservationForm.get('time')?.setValue('12:00');
//     component.onDateChange();
//     expect(component.reservationForm.get('time')?.value).toBe('');
//   });
// 
//   it('should not submit invalid form', async () => {
//     await component.onSubmit();
//     expect(component.errorMessage).toBe('Completa todos los campos');
//     expect(reservationsServiceSpy.createReservation).not.toHaveBeenCalled();
//   });
// 
//   it('should submit valid form', async () => {
//     reservationsServiceSpy.createReservation.and.returnValue(Promise.resolve('res1'));
// 
//     component.reservationForm.get('name')?.setValue('Juan Pérez');
//     component.reservationForm.get('email')?.setValue('juan@test.com');
//     component.reservationForm.get('phone')?.setValue('999888777');
//     component.reservationForm.get('branchId')?.setValue('b1');
//     component.reservationForm.get('tableId')?.setValue('t1');
//     component.reservationForm.get('date')?.setValue(futureDate);
//     component.reservationForm.get('time')?.setValue('12:00');
//     component.reservationForm.get('peopleCount')?.setValue(2);
//     component.reservationForm.get('acceptTerms')?.setValue(true);
// 
//     await component.onSubmit();
// 
//     expect(reservationsServiceSpy.createReservation).toHaveBeenCalled();
//   });
// 
//   it('should handle submission error', async () => {
//     reservationsServiceSpy.createReservation.and.returnValue(Promise.reject('error'));
// 
//     component.reservationForm.get('name')?.setValue('Juan Pérez');
//     component.reservationForm.get('email')?.setValue('juan@test.com');
//     component.reservationForm.get('phone')?.setValue('999888777');
//     component.reservationForm.get('branchId')?.setValue('b1');
//     component.reservationForm.get('tableId')?.setValue('t1');
//     component.reservationForm.get('date')?.setValue(futureDate);
//     component.reservationForm.get('time')?.setValue('12:00');
//     component.reservationForm.get('acceptTerms')?.setValue(true);
// 
//     await component.onSubmit();
// 
//     expect(component.errorMessage).toBe('Error al crear la reserva');
//   });
// 
//   it('should show neutral info message while waiting for the outcome', async () => {
//     const status$ = new Subject<string>();
//     reservationsServiceSpy.watchReservationStatus.and.returnValue(status$);
//     reservationsServiceSpy.createReservation.and.returnValue(Promise.resolve('res1'));
//     voiceConfirmationServiceSpy.requestAccessToken.and.resolveTo('token');
//     (component as any).retellWebClient.startCall = jasmine.createSpy().and.resolveTo();
// 
//     fillValidForm(component);
//     await component.onSubmit();
// 
//     expect(component.successMessage).toBe('');
//     expect(component.outcome).toBe('pending');
//     expect(component.infoMessage.length).toBeGreaterThan(0);
//   });
// 
//   it('should show green confirmation when the outcome is confirmed', async () => {
//     const status$ = new Subject<string>();
//     reservationsServiceSpy.watchReservationStatus.and.returnValue(status$);
//     reservationsServiceSpy.createReservation.and.returnValue(Promise.resolve('res1'));
//     voiceConfirmationServiceSpy.requestAccessToken.and.resolveTo('token');
//     (component as any).retellWebClient.startCall = jasmine.createSpy().and.resolveTo();
// 
//     fillValidForm(component);
//     await component.onSubmit();
// 
//     status$.next('confirmed');
// 
//     expect(component.outcome).toBe('confirmed');
//     expect(component.successMessage).toContain('confirmada');
//     expect(component.errorMessage).toBe('');
//   });
// 
//   it('should show cancelled message when the outcome is cancelled', async () => {
//     const status$ = new Subject<string>();
//     reservationsServiceSpy.watchReservationStatus.and.returnValue(status$);
//     reservationsServiceSpy.createReservation.and.returnValue(Promise.resolve('res1'));
//     voiceConfirmationServiceSpy.requestAccessToken.and.resolveTo('token');
//     (component as any).retellWebClient.startCall = jasmine.createSpy().and.resolveTo();
// 
//     fillValidForm(component);
//     await component.onSubmit();
// 
//     status$.next('cancelled');
// 
//     expect(component.outcome).toBe('cancelled');
//     expect(component.errorTitle).toBe('Reserva Cancelada');
//     expect(component.errorMessage).toContain('cancelada');
//     expect(component.successMessage).toBe('');
//   });
// 
//   it('should show cancelled message after timeout when no one answers', async () => {
//     jasmine.clock().install();
//     const status$ = new Subject<string>();
//     reservationsServiceSpy.watchReservationStatus.and.returnValue(status$);
//     reservationsServiceSpy.createReservation.and.returnValue(Promise.resolve('res1'));
//     voiceConfirmationServiceSpy.requestAccessToken.and.resolveTo('token');
//     (component as any).retellWebClient.startCall = jasmine.createSpy().and.resolveTo();
// 
//     fillValidForm(component);
//     try {
//       await component.onSubmit();
// 
//       (component as any).retellWebClient.emit('call_ended');
// 
//       expect(component.outcome).toBe('pending');
// 
//       jasmine.clock().tick(30_000);
// 
//       expect(component.outcome).toBe('cancelled');
//       expect(reservationsServiceSpy.updateReservationStatus).toHaveBeenCalledWith('res1', 'cancelled');
//       expect(component.errorTitle).toBe('Reserva Cancelada');
//       expect(component.successMessage).toBe('');
//     } finally {
//       jasmine.clock().uninstall();
//     }
//   });
// 
//   it('should not show cancelled after timeout when outcome is already confirmed', async () => {
//     jasmine.clock().install();
//     const status$ = new Subject<string>();
//     reservationsServiceSpy.watchReservationStatus.and.returnValue(status$);
//     reservationsServiceSpy.createReservation.and.returnValue(Promise.resolve('res1'));
//     voiceConfirmationServiceSpy.requestAccessToken.and.resolveTo('token');
//     (component as any).retellWebClient.startCall = jasmine.createSpy().and.resolveTo();
// 
//     fillValidForm(component);
//     try {
//       await component.onSubmit();
// 
//       status$.next('confirmed');
//       (component as any).retellWebClient.emit('call_ended');
//       jasmine.clock().tick(30_000);
// 
//       expect(component.outcome).toBe('confirmed');
//       expect(reservationsServiceSpy.updateReservationStatus).not.toHaveBeenCalled();
//       expect(component.successMessage).toContain('confirmada');
//     } finally {
//       jasmine.clock().uninstall();
//     }
//   });
// 
//   it('should cancel the reservation when nobody answers within 40 seconds', async () => {
//     jasmine.clock().install();
//     const status$ = new Subject<string>();
//     reservationsServiceSpy.watchReservationStatus.and.returnValue(status$);
//     reservationsServiceSpy.createReservation.and.returnValue(Promise.resolve('res1'));
//     voiceConfirmationServiceSpy.requestAccessToken.and.resolveTo('token');
//     (component as any).retellWebClient.startCall = jasmine.createSpy().and.resolveTo();
// 
//     fillValidForm(component);
//     try {
//       await component.onSubmit();
// 
//       (component as any).retellWebClient.emit('call_started');
//       expect(component.callActive).toBeTrue();
// 
//       jasmine.clock().tick(40_000);
// 
//       expect(reservationsServiceSpy.updateReservationStatus).toHaveBeenCalledWith('res1', 'cancelled');
//       expect(component.outcome).toBe('cancelled');
//       expect(component.errorTitle).toBe('Reserva Cancelada');
//     } finally {
//       jasmine.clock().uninstall();
//     }
//   });
// 
//   it('should reset the no-answer window when the agent engages and cancel after 40s of silence', async () => {
//     jasmine.clock().install();
//     const status$ = new Subject<string>();
//     reservationsServiceSpy.watchReservationStatus.and.returnValue(status$);
//     reservationsServiceSpy.createReservation.and.returnValue(Promise.resolve('res1'));
//     voiceConfirmationServiceSpy.requestAccessToken.and.resolveTo('token');
//     (component as any).retellWebClient.startCall = jasmine.createSpy().and.resolveTo();
// 
//     fillValidForm(component);
//     try {
//       await component.onSubmit();
// 
//       (component as any).retellWebClient.emit('call_started');
//       jasmine.clock().tick(20_000);
//       (component as any).retellWebClient.emit('agent_start_talking');
// 
//       // Solo 39 s desde la actividad del agente: no debe cancelar aun.
//       jasmine.clock().tick(39_000);
//       expect(reservationsServiceSpy.updateReservationStatus).not.toHaveBeenCalled();
//       expect(component.outcome).toBe('pending');
// 
//       // 40 s desde la ultima actividad (silencio): se cuelga y se cancela.
//       jasmine.clock().tick(2_000);
//       expect(reservationsServiceSpy.updateReservationStatus).toHaveBeenCalledWith('res1', 'cancelled');
//       expect(component.outcome).toBe('cancelled');
//     } finally {
//       jasmine.clock().uninstall();
//     }
//   });
// });
// 
// function fillValidForm(component: Reservations): void {
//   component.reservationForm.get('name')?.setValue('Juan Pérez');
//   component.reservationForm.get('email')?.setValue('juan@test.com');
//   component.reservationForm.get('phone')?.setValue('999888777');
//   component.reservationForm.get('branchId')?.setValue('b1');
//   component.reservationForm.get('tableId')?.setValue('t1');
//   component.reservationForm.get('date')?.setValue(futureDate);
//   component.reservationForm.get('time')?.setValue('12:00');
//   component.reservationForm.get('peopleCount')?.setValue(2);
//   component.reservationForm.get('acceptTerms')?.setValue(true);
// }
// 
