import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { RetellWebClient } from 'retell-client-js-sdk';

import { BranchService } from '../../../services/branch';
import { ReservationsService } from '../../../services/reservations';
import { TableService } from '../../../services/table';
import { VoiceConfirmationService, VoiceConfirmationRequest } from '../../../services/voice-confirmation';

import { Branch } from '../../../models/branch';
import { Table } from '../../../models/table';

const CUSTOMER_NAME_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
// Admite prefijo internacional (+51987654321) o numero local de 9 digitos.
// Sin el prefijo no se puede marcar desde una llamada telefonica de Retell.
const CUSTOMER_PHONE_PATTERN = /^\+?[0-9]{9,15}$/;
const MIN_PEOPLE_COUNT = 1;
const FAMILY_TABLE_ID_PREFIX = 'fam_';
const DEFAULT_TABLE_CAPACITY = 4;
const UNKNOWN_LABEL = 'Desconocida';

interface ReservationFormValue {
  name: string;
  email: string;
  phone: string;
  branchId: string;
  tableId: string;
  date: string;
  time: string;
  peopleCount: number;
  specialRequests: string;
  acceptTerms: boolean;
}

/**
 * `date` y `time` se validan juntos: por separado no se puede saber si el
 * momento de la reserva ya paso.
 */
function reservationMustBeInTheFuture(form: AbstractControl): ValidationErrors | null {
  const date = form.get('date')?.value;
  const time = form.get('time')?.value;

  if (!date || !time) {
    return null;
  }

  return new Date(`${date}T${time}`) > new Date() ? null : { reservationInThePast: true };
}

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reservations.html',
  styleUrls: ['./reservations.css'],
})
export class Reservations implements OnInit {

  reservationForm: FormGroup = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.pattern(CUSTOMER_NAME_PATTERN)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    phone: new FormControl('', [Validators.required, Validators.pattern(CUSTOMER_PHONE_PATTERN)]),
    branchId: new FormControl('', [Validators.required]),
    tableId: new FormControl('', [Validators.required]),
    date: new FormControl('', [Validators.required]),
    time: new FormControl('', [Validators.required]),
    peopleCount: new FormControl(MIN_PEOPLE_COUNT, [Validators.required, Validators.min(MIN_PEOPLE_COUNT)]),
    specialRequests: new FormControl(''),
    acceptTerms: new FormControl(false, [Validators.requiredTrue])
  }, { validators: reservationMustBeInTheFuture });

  isLoading = false;
  isAICalling = false;
  callActive = false;
  successMessage = '';
  errorMessage = '';

  branches: Branch[] = [];
  allTables: Table[] = [];
  availableTables: Table[] = [];
  availableFamilyTables: (Table & { _displayName: string })[] = [];

  private readonly retellWebClient = new RetellWebClient();

  constructor(
    private branchService: BranchService,
    private reservationsService: ReservationsService,
    private tableService: TableService,
    private voiceConfirmationService: VoiceConfirmationService
  ) { }

  ngOnInit() {

    this.branchService.getBranches().subscribe(branches => {
      this.branches = branches;
    });

    this.tableService.getTables().subscribe(tables => {
      this.allTables = tables;
      // Recalcula con datos frescos (ej: otra persona acaba de reservar la mesa mostrada)
      this.updateAvailableTables(this.reservationForm.get('branchId')?.value);
    });

    this.reservationForm.get('branchId')?.valueChanges.subscribe((branchId: string) => {
      this.updateAvailableTables(branchId);
      this.reservationForm.get('tableId')?.setValue('');
    });

    this.setupRetellEvents();
  }

  /** Bloquea ambos botones mientras hay una operacion en curso. */
  get isBusy(): boolean {
    return this.isLoading || this.isAICalling || this.callActive;
  }

  get isReservationInThePast(): boolean {
    return this.reservationForm.hasError('reservationInThePast');
  }

  updateAvailableTables(branchId?: string) {
    if (!branchId) {
      this.availableTables = [];
      this.availableFamilyTables = [];
      return;
    }

    const branchTables = this.allTables.filter(table => table.branchId === branchId);

    this.availableTables = branchTables.filter(
      table => !table.familyGroupId && this.isTableFree(table)
    );
    this.availableFamilyTables = this.buildAvailableFamilyTables(branchTables);
  }

  isTableFree(table: Table): boolean {
    return table.status === 'free' || table.status === 'available';
  }

  isSelectedTableFree(tableId: string, tables: Table[]): boolean {
    if (this.isFamilyTableId(tableId)) {
      return this.isFamilyGroupFree(this.findFamilyChildren(tableId, tables));
    }

    const table = tables.find(candidate => candidate.id === tableId);
    return !!table && this.isTableFree(table);
  }

  async onSubmit() {
    if (!this.hasValidForm('Completa todos los campos')) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const reservationId = await this.createPendingReservation();
      if (!reservationId) {
        return;
      }

      this.successMessage = '¡Reserva realizada con éxito! Recibirás una confirmación por email.';
      this.resetForm();
    } catch (error) {
      console.error('Error al crear la reserva:', error);
      this.errorMessage = 'Error al crear la reserva';
    } finally {
      this.isLoading = false;
    }
  }

  async startAICall() {
    if (this.callActive) {
      this.retellWebClient.stopCall();
      return;
    }

    if (!this.hasValidForm('Completa todos los campos antes de iniciar la llamada')) {
      return;
    }

    this.isAICalling = true;
    this.errorMessage = '';
    this.successMessage = '';

    let reservationId: string | null = null;

    try {
      reservationId = await this.createPendingReservation();
      if (!reservationId) {
        return;
      }

      const accessToken = await this.voiceConfirmationService.requestAccessToken(
        this.buildVoiceConfirmationRequest(reservationId)
      );
      await this.retellWebClient.startCall({ accessToken });
    } catch (error) {
      console.error('Error al iniciar llamada IA:', error);
      this.errorMessage = 'No se pudo iniciar la llamada con el asistente.';
      await this.discardReservation(reservationId);
    } finally {
      this.isAICalling = false;
    }
  }

  resetForm() {
    this.reservationForm.reset({ peopleCount: MIN_PEOPLE_COUNT, acceptTerms: false });
  }

  onDateChange() {
    // Limpia la hora cuando cambia la fecha
    this.reservationForm.get('time')?.setValue('');
  }

  scrollToForm() {
    document.getElementById('reservationForm')?.scrollIntoView({ behavior: 'smooth' });
  }

  private setupRetellEvents() {
    this.retellWebClient.on('call_started', () => {
      this.isAICalling = false;
      this.callActive = true;
      this.successMessage = 'Llamada iniciada correctamente';
    });

    this.retellWebClient.on('call_ended', () => {
      this.callActive = false;
      this.isAICalling = false;
      // Quien decide si la reserva queda confirmada o cancelada es el Workflow 3,
      // disparado por el evento call_analyzed de Retell unos segundos despues.
      // El navegador todavia no conoce el resultado y no debe afirmarlo.
      this.successMessage = 'Llamada finalizada. Tu reserva se actualizará en unos segundos.';
      this.resetForm();
    });

    this.retellWebClient.on('error', (message: string) => {
      console.error('Error en la llamada de voz:', message);
      this.isAICalling = false;
      this.callActive = false;
      this.errorMessage = 'Ocurrió un error con la llamada de voz.';
    });
  }

  private hasValidForm(invalidMessage: string): boolean {
    if (this.reservationForm.valid) {
      return true;
    }

    this.reservationForm.markAllAsTouched();
    this.errorMessage = this.isReservationInThePast
      ? 'La fecha y hora de la reserva deben ser futuras'
      : invalidMessage;
    return false;
  }

  /**
   * Revalida contra Firestore y crea la reserva. Devuelve el id, o null si la
   * mesa dejo de estar disponible (el motivo queda en `errorMessage`).
   */
  private async createPendingReservation(): Promise<string | null> {
    const tables = await firstValueFrom(this.tableService.getTables());
    const availabilityError = this.findAvailabilityError(tables);

    if (availabilityError) {
      this.errorMessage = availabilityError;
      return null;
    }

    return this.reservationsService.createReservation(this.buildReservation());
  }

  private findAvailabilityError(tables: Table[]): string | null {
    const { tableId, peopleCount } = this.formValue;

    if (!this.isSelectedTableFree(tableId, tables)) {
      return 'La mesa seleccionada ya no está disponible. Elige otra.';
    }

    const capacity = this.findTableCapacity(tableId, tables);
    if (capacity !== null && peopleCount > capacity) {
      return `La mesa seleccionada admite hasta ${capacity} personas.`;
    }

    return null;
  }

  /**
   * Borra una reserva que quedo escrita en Firestore pero cuya llamada nunca
   * llego a iniciarse. Sin esto se acumulan documentos 'pending' que ningun
   * proceso limpia: release-expired-reservations solo mira mesas ya reservadas.
   */
  private async discardReservation(reservationId: string | null): Promise<void> {
    if (!reservationId) {
      return;
    }

    try {
      await this.reservationsService.deleteReservation(reservationId);
    } catch (error) {
      console.error('No se pudo descartar la reserva huérfana', reservationId, error);
    }
  }

  private buildReservation() {
    const form = this.formValue;
    const scheduledAt = new Date(`${form.date}T${form.time}`);

    return {
      branchId: form.branchId,
      tableId: form.tableId,
      customerName: form.name,
      customerPhone: form.phone,
      customerEmail: form.email,
      date: scheduledAt,
      time: scheduledAt,
      peopleCount: form.peopleCount,
      notes: form.specialRequests,
      status: 'pending' as const
    };
  }

  private buildVoiceConfirmationRequest(reservationId: string): VoiceConfirmationRequest {
    const form = this.formValue;

    return {
      reservationId,
      branchId: form.branchId,
      branchName: this.findBranchName(form.branchId),
      tableId: form.tableId,
      tableName: this.tableService.getTableDisplayName(form.tableId) || UNKNOWN_LABEL,
      customerName: form.name,
      customerPhone: form.phone,
      customerEmail: form.email,
      date: form.date,
      time: form.time,
      peopleCount: form.peopleCount,
      specialRequests: form.specialRequests
    };
  }

  private buildAvailableFamilyTables(branchTables: Table[]): (Table & { _displayName: string })[] {
    // Las mesas fusionadas en una mesa familiar quedan con status 'family_merged'
    // (no 'free'/'available'), así que su disponibilidad se mide por si tienen
    // pedido o reserva activa, no por `status`.
    const groups = new Map<string, Table[]>();

    branchTables
      .filter(table => table.familyGroupId)
      .forEach(table => {
        const siblings = groups.get(table.familyGroupId!) || [];
        siblings.push(table);
        groups.set(table.familyGroupId!, siblings);
      });

    return Array.from(groups.entries())
      .filter(([, children]) => this.isFamilyGroupFree(children))
      .map(([groupId, children]) => ({
        ...children[0],
        id: FAMILY_TABLE_ID_PREFIX + groupId,
        capacity: this.sumCapacity(children),
        _displayName: 'Mesa Familiar · ' + children.map(child => child.name).join(' + ')
      }));
  }

  private findTableCapacity(tableId: string, tables: Table[]): number | null {
    if (this.isFamilyTableId(tableId)) {
      const children = this.findFamilyChildren(tableId, tables);
      return children.length > 0 ? this.sumCapacity(children) : null;
    }

    return tables.find(table => table.id === tableId)?.capacity ?? null;
  }

  private findFamilyChildren(familyTableId: string, tables: Table[]): Table[] {
    const groupId = familyTableId.slice(FAMILY_TABLE_ID_PREFIX.length);
    return tables.filter(table => table.familyGroupId === groupId);
  }

  private findBranchName(branchId: string): string {
    return this.branches.find(branch => branch.branchId === branchId)?.name || UNKNOWN_LABEL;
  }

  private isFamilyTableId(tableId: string): boolean {
    return tableId.startsWith(FAMILY_TABLE_ID_PREFIX);
  }

  private isFamilyGroupFree(children: Table[]): boolean {
    return children.length > 0 && children.every(child => !child.currentOrderId && !child.reservationId);
  }

  private sumCapacity(tables: Table[]): number {
    return tables.reduce((total, table) => total + (table.capacity || DEFAULT_TABLE_CAPACITY), 0);
  }

  private get formValue(): ReservationFormValue {
    return this.reservationForm.value as ReservationFormValue;
  }
}
