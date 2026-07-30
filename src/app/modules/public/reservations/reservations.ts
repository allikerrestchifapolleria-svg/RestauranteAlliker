import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { RetellWebClient } from 'retell-client-js-sdk';

import { BranchService } from '../../../services/branch';
import { ReservationsService } from '../../../services/reservations';
import { TableService } from '../../../services/table';

import { Branch } from '../../../models/branch';
import { Table } from '../../../models/table';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reservations.html',
  styleUrls: ['./reservations.css'],
})
export class Reservations implements OnInit {

  reservationForm: FormGroup = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    phone: new FormControl('', [Validators.required, Validators.pattern(/^[0-9]{1,9}$/)]),
    branchId: new FormControl('', [Validators.required]),
    tableId: new FormControl('', [Validators.required]),
    date: new FormControl('', [Validators.required]),
    time: new FormControl('', [Validators.required]),
    peopleCount: new FormControl(1, [Validators.required, Validators.min(1)]),
    specialRequests: new FormControl(''),
    acceptTerms: new FormControl(false, [Validators.requiredTrue])
  });

  isLoading = false;
  isAICalling = false;
  callActive = false;
  successMessage = '';
  errorMessage = '';

  private retellWebClient = new RetellWebClient();

  branches: Branch[] = [];
  allTables: Table[] = [];
  availableTables: Table[] = [];
  availableFamilyTables: (Table & { _displayName: string })[] = [];

  constructor(
    private branchService: BranchService,
    private reservationsService: ReservationsService,
    private tableService: TableService
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

  // 🔥 FILTRAR MESAS (individuales y familiares) de la sucursal elegida
  updateAvailableTables(branchId?: string) {
    if (!branchId) {
      this.availableTables = [];
      this.availableFamilyTables = [];
      return;
    }

    const branchTables = this.allTables.filter(t => t.branchId === branchId);

    this.availableTables = branchTables.filter(t => !t.familyGroupId && this.isTableFree(t));

    // Las mesas fusionadas en una mesa familiar quedan con status 'family_merged'
    // (no 'free'/'available'), así que su disponibilidad se mide por si tienen
    // pedido u reserva activa, no por `status`.
    const groups = new Map<string, Table[]>();
    branchTables
      .filter(t => t.familyGroupId)
      .forEach(t => {
        const list = groups.get(t.familyGroupId!) || [];
        list.push(t);
        groups.set(t.familyGroupId!, list);
      });

    this.availableFamilyTables = Array.from(groups.entries())
      .filter(([, children]) => children.every(c => !c.currentOrderId && !c.reservationId))
      .map(([groupId, children]) => ({
        ...children[0],
        id: 'fam_' + groupId,
        capacity: children.reduce((sum, c) => sum + (c.capacity || 4), 0),
        _displayName: 'Mesa Familiar · ' + children.map(c => c.name).join(' + ')
      }));
  }

  // 🔥 VALIDAR MESA LIBRE (soporta ids de mesa individual y 'fam_<groupId>')
  isTableFree(table: Table): boolean {
    return table.status === 'free' || table.status === 'available';
  }

  isSelectedTableFree(tableId: string, tables: Table[]): boolean {
    if (tableId.startsWith('fam_')) {
      const groupId = tableId.slice(4);
      const children = tables.filter(t => t.familyGroupId === groupId);
      return children.length > 0 && children.every(c => !c.currentOrderId && !c.reservationId);
    }
    const table = tables.find(t => t.id === tableId);
    return !!table && this.isTableFree(table);
  }

  // 🔥 EVENTOS DE RETELL
  setupRetellEvents() {

    this.retellWebClient.on('conversationStarted', () => {
      this.isAICalling = false;
      this.callActive = true;
      this.successMessage = 'Llamada iniciada correctamente';
    });

    this.retellWebClient.on('conversationEnded', async ({ code }) => {

      this.callActive = false;
      this.isAICalling = false;

      const asistencia = code === 0;
      this.successMessage = asistencia
        ? '¡Reserva confirmada por voz!'
        : 'La reserva no fue confirmada.';

      try {
        const status = asistencia ? 'Confirmada' : 'Cancelada';

        // 🔥 ENVIO A N8N
        await fetch('https://elanderyours.app.n8n.cloud/webhook/c74b22c2-7cc7-40de-b60f-629afc42052e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebaseId: this.lastReservationId,
            status: status
          })
        });

      } catch (err) {
        console.error(err);
      }

      // Limpiar formulario al terminar la llamada
      this.resetForm();

    });

    this.retellWebClient.on('error', (error: any) => {
      console.error('Error en la llamada:', error);
      this.isAICalling = false;
      this.callActive = false;
      this.errorMessage = 'Ocurrió un error con la llamada de voz.';
    });
  }

  private lastReservationId = '';

  // 🔥 SUBMIT NORMAL
  async onSubmit() {

    if (this.reservationForm.invalid) {
      this.reservationForm.markAllAsTouched();
      this.errorMessage = 'Completa todos los campos';
      return;
    }

    this.isLoading = true;

    const form = this.reservationForm.value;

    try {

      // 🔥 VERIFICAR QUE LA MESA SIGA LIBRE
      const tables = await firstValueFrom(this.tableService.getTables());
      if (!this.isSelectedTableFree(form.tableId, tables)) {
        this.errorMessage = 'La mesa seleccionada ya no está disponible. Elige otra.';
        this.isLoading = false;
        return;
      }

      const newReservation = {
        branchId: form.branchId,
        tableId: form.tableId,
        customerName: form.name,
        customerPhone: form.phone,
        customerEmail: form.email,
        date: new Date(form.date + 'T' + form.time),
        time: new Date(form.date + 'T' + form.time),
        peopleCount: form.peopleCount,
        notes: form.specialRequests,
        status: 'pending'
      };

      // 🔥 GUARDAR EN FIREBASE
      await this.reservationsService.createReservation(newReservation);

      this.successMessage = '¡Reserva realizada con éxito! Recibirás una confirmación por email.';
      this.resetForm();

    } catch (error) {
      console.error(error);
      this.errorMessage = 'Error al crear la reserva';
    }

    this.isLoading = false;
  }

  // 🔥 INICIAR LLAMADA IA
  async startAICall() {
    if (this.reservationForm.invalid) {
      this.reservationForm.markAllAsTouched();
      this.errorMessage = 'Completa todos los campos antes de iniciar la llamada';
      return;
    }

    if (this.callActive) {
      (this.retellWebClient as any).stopConversation();
      return;
    }

    this.isAICalling = true;
    this.errorMessage = '';
    this.successMessage = '';

    const form = this.reservationForm.value;

    try {

      // 🔥 VERIFICAR QUE LA MESA SIGA LIBRE
      const tables = await firstValueFrom(this.tableService.getTables());
      if (!this.isSelectedTableFree(form.tableId, tables)) {
        this.errorMessage = 'La mesa seleccionada ya no está disponible. Elige otra.';
        this.isAICalling = false;
        return;
      }

      const newReservation = {
        branchId: form.branchId,
        tableId: form.tableId,
        customerName: form.name,
        customerPhone: form.phone,
        customerEmail: form.email,
        date: new Date(form.date + 'T' + form.time),
        time: new Date(form.date + 'T' + form.time),
        peopleCount: form.peopleCount,
        notes: form.specialRequests,
        status: 'pending'
      };

      // 🔥 GUARDAR EN FIREBASE PARA OBTENER ID
      const reservationId = await this.reservationsService.createReservation(newReservation);
      this.lastReservationId = reservationId;

      // 🔥 ARMAR PAYLOAD PARA N8N (Formato completo que necesita el flujo)
      const payload = {
        id: reservationId,
        branchId: form.branchId,
        tableId: form.tableId,
        customerName: form.name,
        customerPhone: form.phone,
        customerEmail: form.email,
        date: form.date, // Formato original string YYYY-MM-DD
        time: form.time, // Formato original string HH:MM
        peopleCount: form.peopleCount,
        notes: form.specialRequests,
        status: 'pending',
        createdAt: new Date().toISOString(),
        branchName: this.branches.find(b => b.branchId === form.branchId)?.name || 'Desconocida',
        tableName: this.tableService.getTableDisplayName(form.tableId) || 'Desconocida',
        ...form
      };

      // 🔥 LLAMAR A N8N PARA TOKEN
      const response = await fetch('https://elanderyours.app.n8n.cloud/webhook/c74b22c2-7cc7-40de-b60f-629afc42052e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('El webhook no devolvió un access_token válido');
      }

      // 🔥 INICIAR LLAMADA
      (this.retellWebClient as any).startCall({
        accessToken: data.access_token
      });

    } catch (error) {
      console.error('Error al iniciar llamada IA:', error);
      this.errorMessage = 'No se pudo iniciar la llamada con el asistente.';
      this.isAICalling = false;
    }
  }

  resetForm() {
    this.reservationForm.reset();
  }

  onDateChange() {
    // Limpia la hora cuando cambia la fecha
    this.reservationForm.get('time')?.setValue('');
  }



  scrollToForm() {
    document.getElementById('reservationForm')?.scrollIntoView({ behavior: 'smooth' });
  }
}