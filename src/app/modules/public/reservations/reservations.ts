// ============================================================================
// RESERVACIONES DESHABILITADO (posible implementación futura)
// Código comentado línea a línea para conservarlo. Para revertir:
//   - Quitar el prefijo "// " de cada línea.
//   - Restaurar el import y la ruta en public-routing-module.ts.
//   - Restaurar los enlaces de navegación y el botón de reserva del mozo.
// ============================================================================
// import { Component, OnInit, OnDestroy } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { firstValueFrom, Subscription } from 'rxjs';
// import {
//   ReactiveFormsModule,
//   FormGroup,
//   FormControl,
//   Validators,
//   AbstractControl,
//   ValidationErrors
// } from '@angular/forms';
// import { RetellWebClient } from 'retell-client-js-sdk';
// 
// import { BranchService } from '../../../services/branch';
// import { ReservationsService } from '../../../services/reservations';
// import { TableService } from '../../../services/table';
// import {
//   VoiceConfirmationService,
//   VoiceConfirmationRequest,
//   VoiceConfirmationError,
//   TIMEOUT_STATUS
// } from '../../../services/voice-confirmation';
// import { VoiceCallLogger } from '../../../services/voice-call-logger';
// import { AppUpdateService } from '../../../services/app-update';
// import { Auth } from '../../../services/auth';
// import { formatLocalDate } from '../../../services/date-utils';
// 
// import { Branch } from '../../../models/branch';
// import { Table } from '../../../models/table';
// 
// const CUSTOMER_NAME_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
// // Peru: el campo guarda SOLO los 9 digitos del celular; el prefijo +51 se
// // agrega al construir la reserva / pedir la llamada (Retell lo exige).
// const PERU_COUNTRY_CODE = '+51';
// const CUSTOMER_PHONE_PATTERN = /^[0-9]{9}$/;
// const MIN_PEOPLE_COUNT = 1;
// const MAX_PEOPLE_COUNT = 20;
// const FAMILY_TABLE_ID_PREFIX = 'fam_';
// const DEFAULT_TABLE_CAPACITY = 4;
// const UNKNOWN_LABEL = 'Desconocida';
// 
// const DEFAULT_ERROR_TITLE = 'Error en la Reserva';
// /**
//  * Titulo para el unico caso en que un fallo NO significa que el cliente se haya
//  * quedado sin mesa: la reserva ya esta escrita y solo fallo la llamada. Con el
//  * titulo generico el cliente creeria que no tiene reserva y pediria otra.
//  */
// const CALL_FAILED_ERROR_TITLE = 'Reserva registrada, pero sin llamada';
// 
// const RESERVATION_SAVED_MESSAGE =
//   '¡Reserva registrada! Recibirás la confirmación por email. Conectando con el asistente de voz...';
// 
// /**
//  * Tras colgar la llamada, cuantos ms se espera el resultado del Workflow 3
//  * (call_analyzed de Retell -> n8n -> confirm-reservation en Firestore). Si
//  * sigue en 'pending' al vencer, el cliente nunca contesto y se marca la
//  * reserva como cancelada (en Firestore y en la UI).
//  */
// const CALL_OUTCOME_TIMEOUT_MS = 30_000;
// 
// /**
//  * Hard-cap desde que arranca la llamada: si en este plazo el agente no
//  * muestra actividad (call_ready / agent_start_talking / agent_stop_talking),
//  * la llamada quedo colgada sin nadie del otro lado y se cuelga y cancela.
//  * En un web call normal el agente saluda de inmediato y el contador se
//  * desarma; solo dispara en llamadas que nunca llegan a establecerse.
//  */
// const NO_ANSWER_TIMEOUT_MS = 40_000;
// 
// export type ReservationOutcome = 'pending' | 'confirmed' | 'cancelled';
// 
// const CANCELLED_ERROR_TITLE = 'Reserva Cancelada';
// const CONFIRMED_MESSAGE = 'Tu asistencia fue confirmada. ¡Te esperamos!';
// const CANCELLED_MESSAGE =
//   'No se confirmó tu asistencia, por lo que la reserva fue cancelada.';
// 
// /**
//  * Todos los eventos que emite retell-client-js-sdk v2. Solo llevan traza (no
//  * logica propia): el resto de eventos se manejan explicitamente.
//  */
// const RETELL_TRACE_ONLY_EVENTS = [
//   'metadata',
//   'update',
//   'node_transition'
// ] as const;
// 
// interface ReservationFormValue {
//   name: string;
//   email: string;
//   phone: string;
//   branchId: string;
//   tableId: string;
//   date: string;
//   time: string;
//   peopleCount: number;
//   specialRequests: string;
//   acceptTerms: boolean;
// }
// 
// /**
//  * `date` y `time` se validan juntos: por separado no se puede saber si el
//  * momento de la reserva ya paso.
//  */
// function reservationMustBeInTheFuture(form: AbstractControl): ValidationErrors | null {
//   const date = form.get('date')?.value;
//   const time = form.get('time')?.value;
// 
//   if (!date || !time) {
//     return null;
//   }
// 
//   return new Date(`${date}T${time}`) > new Date() ? null : { reservationInThePast: true };
// }
// 
// @Component({
//   selector: 'app-reservations',
//   standalone: true,
//   imports: [CommonModule, ReactiveFormsModule],
//   templateUrl: './reservations.html',
//   styleUrls: ['./reservations.css'],
// })
// export class Reservations implements OnInit, OnDestroy {
// 
//   reservationForm: FormGroup = new FormGroup({
//     name: new FormControl('', [Validators.required, Validators.pattern(CUSTOMER_NAME_PATTERN)]),
//     email: new FormControl('', [Validators.required, Validators.email]),
//     phone: new FormControl('', [Validators.required, Validators.pattern(CUSTOMER_PHONE_PATTERN)]),
//     branchId: new FormControl('', [Validators.required]),
//     tableId: new FormControl('', [Validators.required]),
//     date: new FormControl('', [Validators.required]),
//     time: new FormControl('', [Validators.required]),
//     peopleCount: new FormControl(MIN_PEOPLE_COUNT, [Validators.required, Validators.min(MIN_PEOPLE_COUNT)]),
//     specialRequests: new FormControl(''),
//     acceptTerms: new FormControl(false, [Validators.requiredTrue])
//   }, { validators: reservationMustBeInTheFuture });
// 
//   isLoading = false;
//   isAICalling = false;
//   callActive = false;
//   /** Mensajes neutrales del flujo (reserva registrada, llamada en curso). */
//   infoMessage = '';
//   /** Solo se rellena cuando el resultado de la llamada fue 'confirmed'. */
//   successMessage = '';
//   errorMessage = '';
//   errorTitle = DEFAULT_ERROR_TITLE;
//   /** Resultado real de la llamada de confirmacion, segun Firestore. */
//   outcome: ReservationOutcome = 'pending';
// 
//   readonly peopleCountOptions = Array.from(
//     { length: MAX_PEOPLE_COUNT - MIN_PEOPLE_COUNT + 1 },
//     (_, index) => MIN_PEOPLE_COUNT + index
//   );
// 
//   branches: Branch[] = [];
//   allTables: Table[] = [];
//   availableTables: Table[] = [];
//   availableFamilyTables: (Table & { _displayName: string })[] = [];
// 
//   private readonly retellWebClient = new RetellWebClient();
// 
//   /** Id del intento en curso, para correlacionar las trazas del SDK de Retell. */
//   private currentAttemptId = '';
// 
//   /** Id de la reserva recien creada; es la que se cancela si nadie contesta. */
//   private currentReservationId = '';
// 
//   /** Escucha el estado de la reserva recien creada en Firestore. */
//   private outcomeSubscription: Subscription | null = null;
// 
//   /** A los CALL_OUTCOME_TIMEOUT_MS de colgar, si sigue 'pending' -> cancelada. */
//   private outcomeTimeout: ReturnType<typeof setTimeout> | null = null;
// 
//   /** A los NO_ANSWER_TIMEOUT_MS de arrancar la llamada sin actividad -> colgar y cancelar. */
//   private noAnswerTimeout: ReturnType<typeof setTimeout> | null = null;
// 
//   constructor(
//     private branchService: BranchService,
//     private reservationsService: ReservationsService,
//     private tableService: TableService,
//     private voiceConfirmationService: VoiceConfirmationService,
//     private logger: VoiceCallLogger,
//     private appUpdateService: AppUpdateService,
//     private auth: Auth
//   ) { }
// 
//   ngOnInit() {
// 
//     this.lockEmailToAccount();
// 
//     this.branchService.getBranches().subscribe(branches => {
//       this.branches = branches.filter(branch =>
//         branch.name.toLowerCase().includes('trujillo')
//       );
//     });
// 
//     this.tableService.getTables().subscribe(tables => {
//       this.allTables = tables;
//       // Recalcula con datos frescos (ej: otra persona acaba de reservar la mesa mostrada)
//       this.updateAvailableTables(this.reservationForm.get('branchId')?.value);
//     });
// 
//     this.reservationForm.get('branchId')?.valueChanges.subscribe((branchId: string) => {
//       this.updateAvailableTables(branchId);
//       this.reservationForm.get('tableId')?.setValue('');
//     });
// 
//     this.setupRetellEvents();
//   }
// 
//   ngOnDestroy() {
//     this.stopOutcomeTracking();
//   }
// 
//   /**
//    * Bloquea el boton mientras se procesa. `callActive` queda fuera a proposito:
//    * durante la llamada el boton sigue vivo porque es el que cuelga.
//    */
//   get isBusy(): boolean {
//     return this.isLoading || this.isAICalling;
//   }
// 
//   /**
//    * La reserva queda atada al correo de la cuenta: el campo se rellena solo y
//    * se muestra de solo lectura. La ruta exige sesion iniciada (authGuard), asi
//    * que llegar aqui sin usuario no deberia ocurrir.
//    */
//   private lockEmailToAccount(): void {
//     const accountEmail = this.auth.getCurrentUser()?.email;
//     if (accountEmail) {
//       this.reservationForm.get('email')?.setValue(accountEmail);
//     }
//   }
// 
//   get accountEmail(): string {
//     return this.auth.getCurrentUser()?.email ?? '';
//   }
// 
//   /**
//    * Minimo del selector de fecha: impide elegir dias pasados desde el propio widget.
//    * Se usa `formatLocalDate` (componentes de fecha locales) en lugar de
//    * `toISOString()`, que devuelve la fecha en UTC y en zonas al oeste de UTC
//    * adelanta un dia despues de cierta hora (ej. en Peru a partir de las 19:00
//    * ya es "manana" en UTC).
//    */
//   get today(): string {
//     return formatLocalDate(new Date());
//   }
// 
//   get isReservationInThePast(): boolean {
//     return this.reservationForm.hasError('reservationInThePast');
//   }
// 
//   updateAvailableTables(branchId?: string) {
//     if (!branchId) {
//       this.availableTables = [];
//       this.availableFamilyTables = [];
//       return;
//     }
// 
//     const branchTables = this.allTables.filter(table => table.branchId === branchId);
// 
//     this.availableTables = branchTables.filter(
//       table => !table.familyGroupId && this.isTableFree(table)
//     );
//     this.availableFamilyTables = this.buildAvailableFamilyTables(branchTables);
//   }
// 
//   isTableFree(table: Table): boolean {
//     return table.status === 'free' || table.status === 'available';
//   }
// 
//   isSelectedTableFree(tableId: string, tables: Table[]): boolean {
//     if (this.isFamilyTableId(tableId)) {
//       return this.isFamilyGroupFree(this.findFamilyChildren(tableId, tables));
//     }
// 
//     const table = tables.find(candidate => candidate.id === tableId);
//     return !!table && this.isTableFree(table);
//   }
// 
//   /**
//    * Unica accion de la pagina: registra la reserva y, seguido, arranca la
//    * llamada de confirmacion por voz. Antes esto eran dos botones y cada uno
//    * creaba su propia reserva; ahora se crea una sola vez y la llamada es el
//    * paso siguiente del mismo flujo, no una alternativa.
//    *
//    * `callActive` se atiende antes que nada porque durante la llamada este mismo
//    * boton pasa a ser el de colgar: no debe crear una segunda reserva.
//    */
//   async onSubmit() {
//     if (this.callActive) {
//       this.logger.step(this.currentAttemptId, 'colgar-solicitado-por-el-usuario');
//       this.retellWebClient.stopCall();
//       return;
//     }
// 
//     // Protege del doble click: el boton se deshabilita, pero el submit tambien
//     // llega por Enter desde cualquier campo del formulario.
//     if (this.isBusy) {
//       return;
//     }
// 
//     const attemptId = this.logger.startAttempt();
//     this.currentAttemptId = attemptId;
//     this.errorTitle = DEFAULT_ERROR_TITLE;
// 
//     if (!this.hasValidForm('Completa todos los campos')) {
//       this.logger.endAttempt(attemptId, 'formulario invalido');
//       return;
//     }
// 
//     this.isLoading = true;
//     this.errorMessage = '';
//     this.successMessage = '';
//     this.infoMessage = '';
//     // La recarga por version nueva esperaria a que termine la llamada.
//     this.appUpdateService.holdReload();
// 
//     try {
//       this.logger.step(attemptId, 'formulario-valido', this.formValue);
// 
//       const reservationId = await this.createPendingReservation(attemptId);
//       if (!reservationId) {
//         this.logger.endAttempt(attemptId, 'mesa no disponible');
//         return;
//       }
//       this.currentReservationId = reservationId;
// 
//       // Se anuncia la reserva ANTES de pedir la llamada: el webhook de n8n puede
//       // tardar (su nodo Wait espera hasta la hora de la reserva), y durante esa
//       // espera el cliente debe ver que su mesa ya quedo guardada.
//       this.infoMessage = RESERVATION_SAVED_MESSAGE;
//       this.startOutcomeTracking(reservationId, attemptId);
//       await this.confirmByVoice(reservationId, attemptId);
//     } catch (error) {
//       this.logger.failure(attemptId, 'onSubmit', error);
//       console.error('Error al crear la reserva:', error);
//       this.successMessage = '';
//       this.infoMessage = '';
//       this.errorMessage = 'Error al crear la reserva';
//       this.logger.endAttempt(attemptId, 'error');
//     } finally {
//       this.isLoading = false;
//       this.isAICalling = false;
//       this.appUpdateService.releaseReload();
//     }
//   }
// 
//   /**
//    * Segundo tramo del flujo. Un fallo aqui NO tumba la reserva: cuando la
//    * llamada era un boton aparte, la reserva existia solo para ella y se borraba
//    * al fallar; ahora es la reserva que el cliente pidio y se queda en pie.
//    */
//   private async confirmByVoice(reservationId: string, attemptId: string): Promise<void> {
//     this.isLoading = false;
//     this.isAICalling = true;
// 
//     try {
//       const accessToken = await this.voiceConfirmationService.requestAccessToken(
//         this.buildVoiceConfirmationRequest(reservationId),
//         attemptId
//       );
// 
//       this.logger.step(attemptId, 'retell-startCall');
//       await this.retellWebClient.startCall({ accessToken });
//       this.logger.step(attemptId, 'retell-startCall-resuelto');
//     } catch (error) {
//       this.logger.failure(attemptId, 'confirmar-por-voz', error);
//       this.successMessage = '';
//       this.infoMessage = '';
//       this.errorTitle = CALL_FAILED_ERROR_TITLE;
//       this.errorMessage =
//         `Tu reserva quedó guardada y el restaurante la verá igualmente, pero no se pudo ` +
//         `iniciar la llamada de confirmación. ${this.describeVoiceCallError(error)}`;
//       // La reserva ya esta hecha, asi que se limpia el formulario para que un
//       // segundo intento no cree un duplicado de la misma mesa.
//       this.resetForm();
//       this.logger.endAttempt(attemptId, 'error en la llamada');
//     }
//   }
// 
//   /**
//    * Escucha el estado de la reserva creada. El Workflow 3 la pasa a 'confirmed'
//    * o 'cancelled' unos segundos despues del call_analyzed de Retell.
//    */
//   private startOutcomeTracking(reservationId: string, attemptId: string): void {
//     this.stopOutcomeTracking();
//     this.outcome = 'pending';
//     this.outcomeSubscription = this.reservationsService
//       .watchReservationStatus(reservationId)
//       .subscribe({
//         next: status => this.applyOutcome(status, attemptId),
//         error: error => this.logger.failure(attemptId, 'watch-reservation-status', error)
//       });
//   }
// 
//   private applyOutcome(status: string, attemptId: string): void {
//     this.logger.step(attemptId, 'reserva-estado', { status });
// 
//     if (status === 'confirmed') {
//       this.resolveOutcome('confirmed');
//       return;
//     }
// 
//     if (status === 'cancelled') {
//       this.resolveOutcome('cancelled');
//       return;
//     }
// 
//     // 'pending': aun no hay resultado, se sigue esperando.
//   }
// 
//   private resolveOutcome(outcome: ReservationOutcome): void {
//     this.outcome = outcome;
//     this.disarmOutcomeTimeout();
//     this.disarmNoAnswerTimeout();
//     this.outcomeSubscription?.unsubscribe();
//     this.outcomeSubscription = null;
// 
//     if (outcome === 'confirmed') {
//       this.infoMessage = '';
//       this.errorMessage = '';
//       this.errorTitle = DEFAULT_ERROR_TITLE;
//       this.successMessage = CONFIRMED_MESSAGE;
//       return;
//     }
// 
//     if (outcome === 'cancelled') {
//       this.infoMessage = '';
//       this.successMessage = '';
//       this.errorTitle = CANCELLED_ERROR_TITLE;
//       this.errorMessage = CANCELLED_MESSAGE;
//     }
//   }
// 
//   /**
//    * La reserva quedo en 'pending' sin resolucion (nadie contesto o el workflow
//    * la dejo ahi): se marca 'cancelled' en Firestore y se actualiza la UI.
//    * El write es best-effort: si falla (reglas/red) al menos la UI lo refleja.
//    */
//   private cancelPendingReservation(motivo: string): void {
//     if (this.outcome !== 'pending') {
//       return;
//     }
//     this.logger.step(this.currentAttemptId, motivo);
//     this.reservationsService
//       .updateReservationStatus(this.currentReservationId, 'cancelled')
//       .catch(error => this.logger.failure(this.currentAttemptId, 'marcar-cancelada', error));
//     this.resolveOutcome('cancelled');
//   }
// 
//   /** Al vencer el plazo sin que el estado salga de 'pending', se cancela. */
//   private armOutcomeTimeout(): void {
//     this.disarmOutcomeTimeout();
//     this.outcomeTimeout = setTimeout(() => {
//       this.outcomeTimeout = null;
//       this.cancelPendingReservation('sin-respuesta-timeout');
//     }, CALL_OUTCOME_TIMEOUT_MS);
//   }
// 
//   private disarmOutcomeTimeout(): void {
//     if (this.outcomeTimeout) {
//       clearTimeout(this.outcomeTimeout);
//       this.outcomeTimeout = null;
//     }
//   }
// 
//   /**
//    * Si pasan NO_ANSWER_TIMEOUT_MS sin que el agente muestre actividad, la
//    * llamada quedo sin respuesta y se cuelga y cancela la reserva. La actividad
//    * del agente (call_ready / agent_start_talking / agent_stop_talking) REINICIA
//    * la ventana: asi se garantiza que el cierre ocurra tras 40 s de silencio,
//    * aunque el saludo inicial de Daniela ocurra a los pocos segundos.
//    */
//   private armNoAnswerTimeout(): void {
//     this.disarmNoAnswerTimeout();
//     this.noAnswerTimeout = setTimeout(() => {
//       this.noAnswerTimeout = null;
//       this.logger.step(this.currentAttemptId, 'no-respuesta-40s');
//       this.cancelPendingReservation('no-respuesta-40s');
//       this.retellWebClient.stopCall();
//     }, NO_ANSWER_TIMEOUT_MS);
//   }
// 
//   private disarmNoAnswerTimeout(): void {
//     if (this.noAnswerTimeout) {
//       clearTimeout(this.noAnswerTimeout);
//       this.noAnswerTimeout = null;
//     }
//   }
// 
//   private stopOutcomeTracking(): void {
//     this.disarmOutcomeTimeout();
//     this.disarmNoAnswerTimeout();
//     this.outcomeSubscription?.unsubscribe();
//     this.outcomeSubscription = null;
//   }
// 
//   resetForm() {
//     this.reservationForm.reset({ peopleCount: MIN_PEOPLE_COUNT, acceptTerms: false });
//     this.lockEmailToAccount();
//   }
// 
//   onDateChange() {
//     // Limpia la hora cuando cambia la fecha
//     this.reservationForm.get('time')?.setValue('');
//   }
// 
//   scrollToForm() {
//     document.getElementById('reservationForm')?.scrollIntoView({ behavior: 'smooth' });
//   }
// 
//   private setupRetellEvents() {
//     this.retellWebClient.on('call_started', () => {
//       this.logger.step(this.currentAttemptId, 'retell:call_started');
//       this.isAICalling = false;
//       this.callActive = true;
//       this.infoMessage = 'Llamada iniciada correctamente. Esperando tu confirmación...';
//       // Nadie contesto aun: si en 40 s el agente no muestra actividad, se
//       // cuelga y se cancela la reserva.
//       this.armNoAnswerTimeout();
//     });
// 
//     this.retellWebClient.on('call_ready', () => {
//       this.logger.step(this.currentAttemptId, 'retell:call_ready');
//       this.armNoAnswerTimeout();
//     });
// 
//     this.retellWebClient.on('agent_start_talking', () => {
//       this.logger.step(this.currentAttemptId, 'retell:agent_start_talking');
//       this.armNoAnswerTimeout();
//     });
// 
//     this.retellWebClient.on('agent_stop_talking', () => {
//       this.logger.step(this.currentAttemptId, 'retell:agent_stop_talking');
//       this.armNoAnswerTimeout();
//     });
// 
//     this.retellWebClient.on('call_ended', () => {
//       this.logger.step(this.currentAttemptId, 'retell:call_ended');
//       this.callActive = false;
//       this.isAICalling = false;
//       this.disarmNoAnswerTimeout();
//       this.resetForm();
//       this.logger.endAttempt(this.currentAttemptId, 'llamada completada');
// 
//       // Si el outcome ya se resolvio (watchdog de no-respuesta o el watcher de
//       // Firestore), no pisar el mensaje de 'Reserva Cancelada'.
//       if (this.outcome !== 'pending') {
//         return;
//       }
// 
//       // Quien decide si la reserva queda confirmada o cancelada es el Workflow 3,
//       // disparado por el evento call_analyzed de Retell unos segundos despues.
//       // El navegador todavia no conoce el resultado y no debe afirmarlo.
//       this.infoMessage = 'Llamada finalizada. Esperando la confirmación del restaurante...';
//       // Red de seguridad: si el cliente no contesto, el workflow deja la reserva
//       // en 'pending' para siempre. Al vencer este plazo se cancela en Firestore.
//       this.armOutcomeTimeout();
//     });
// 
//     this.retellWebClient.on('error', (message: string) => {
//       this.logger.failure(this.currentAttemptId, 'retell:error', message);
//       this.isAICalling = false;
//       this.callActive = false;
//       // Igual que en confirmByVoice: la reserva sigue guardada, solo cayo la voz.
//       this.errorTitle = CALL_FAILED_ERROR_TITLE;
//       this.errorMessage = `Ocurrió un error con la llamada de voz: ${message}`;
//     });
// 
//     RETELL_TRACE_ONLY_EVENTS.forEach(eventName => {
//       this.retellWebClient.on(eventName, (payload: unknown) => {
//         this.logger.step(this.currentAttemptId, `retell:${eventName}`, payload);
//       });
//     });
//   }
// 
//   /**
//    * Traduce el fallo a algo accionable. El codigo HTTP identifica en que punto
//    * de la cadena se rompio, que es justo lo que el mensaje generico ocultaba.
//    */
//   private describeVoiceCallError(error: unknown): string {
//     if (!(error instanceof VoiceConfirmationError)) {
//       return 'No se pudo iniciar la llamada con el asistente.';
//     }
// 
//     switch (error.status) {
//       case 504:
//         return 'El workflow de n8n tardó demasiado en responder (504). La espera del nodo Wait supera el límite: revisa fecha_alerta y la hora de la reserva.';
//       case 404:
//         return 'El webhook de n8n no existe o el workflow está inactivo (404).';
//       case 401:
//       case 403:
//         return `n8n rechazó la petición (${error.status}). Revisa las credenciales del workflow.`;
//       case TIMEOUT_STATUS:
//         return 'El webhook de n8n no respondió a tiempo. Revisa si el workflow quedó esperando.';
//       case null:
//         return `No se pudo contactar con el webhook de n8n. ${error.message}`;
//       default:
//         return `El webhook de n8n respondió ${error.status}.`;
//     }
//   }
// 
//   private hasValidForm(invalidMessage: string): boolean {
//     if (this.reservationForm.valid) {
//       return true;
//     }
// 
//     this.reservationForm.markAllAsTouched();
//     this.errorMessage = this.isReservationInThePast
//       ? 'La fecha y hora de la reserva deben ser futuras'
//       : invalidMessage;
//     return false;
//   }
// 
//   /**
//    * Revalida contra Firestore y crea la reserva. Devuelve el id, o null si la
//    * mesa dejo de estar disponible (el motivo queda en `errorMessage`).
//    */
//   private async createPendingReservation(attemptId?: string): Promise<string | null> {
//     const tables = await firstValueFrom(this.tableService.getTables());
//     this.traceIfTracked(attemptId, 'mesas-leidas', { total: tables.length });
// 
//     const availabilityError = this.findAvailabilityError(tables);
//     if (availabilityError) {
//       this.errorMessage = availabilityError;
//       this.traceIfTracked(attemptId, 'mesa-no-disponible', { motivo: availabilityError });
//       return null;
//     }
// 
//     const reservationId = await this.reservationsService.createReservation(this.buildReservation());
//     this.traceIfTracked(attemptId, 'reserva-creada', { reservationId });
//     return reservationId;
//   }
// 
//   private findAvailabilityError(tables: Table[]): string | null {
//     const { tableId, peopleCount } = this.formValue;
// 
//     if (!this.isSelectedTableFree(tableId, tables)) {
//       return 'La mesa seleccionada ya no está disponible. Elige otra.';
//     }
// 
//     const capacity = this.findTableCapacity(tableId, tables);
//     if (capacity !== null && peopleCount > capacity) {
//       return `La mesa seleccionada admite hasta ${capacity} personas.`;
//     }
// 
//     return null;
//   }
// 
//   /** `attemptId` es opcional por historico; hoy onSubmit siempre abre un intento. */
//   private traceIfTracked(attemptId: string | undefined, phase: string, data?: unknown): void {
//     if (attemptId) {
//       this.logger.step(attemptId, phase, data);
//     }
//   }
// 
//   private buildReservation() {
//     const form = this.formValue;
//     const scheduledAt = new Date(`${form.date}T${form.time}`);
// 
//     return {
//       customerId: this.auth.getCurrentUser()?.uid || undefined,
//       branchId: form.branchId,
//       tableId: form.tableId,
//       customerName: form.name,
//       customerPhone: PERU_COUNTRY_CODE + form.phone,
//       customerEmail: form.email,
//       date: scheduledAt,
//       time: scheduledAt,
//       peopleCount: form.peopleCount,
//       notes: form.specialRequests,
//       status: 'pending' as const
//     };
//   }
// 
//   private buildVoiceConfirmationRequest(reservationId: string): VoiceConfirmationRequest {
//     const form = this.formValue;
// 
//     return {
//       reservationId,
//       branchId: form.branchId,
//       branchName: this.findBranchName(form.branchId),
//       tableId: form.tableId,
//       tableName: this.tableService.getTableDisplayName(form.tableId) || UNKNOWN_LABEL,
//       customerName: form.name,
//       customerPhone: PERU_COUNTRY_CODE + form.phone,
//       customerEmail: form.email,
//       date: form.date,
//       time: form.time,
//       peopleCount: form.peopleCount,
//       specialRequests: form.specialRequests
//     };
//   }
// 
//   private buildAvailableFamilyTables(branchTables: Table[]): (Table & { _displayName: string })[] {
//     // Las mesas fusionadas en una mesa familiar quedan con status 'family_merged'
//     // (no 'free'/'available'), así que su disponibilidad se mide por si tienen
//     // pedido o reserva activa, no por `status`.
//     const groups = new Map<string, Table[]>();
// 
//     branchTables
//       .filter(table => table.familyGroupId)
//       .forEach(table => {
//         const siblings = groups.get(table.familyGroupId!) || [];
//         siblings.push(table);
//         groups.set(table.familyGroupId!, siblings);
//       });
// 
//     console.info('[MESAS-FAMILIARES] grupos encontrados en la sucursal:', groups.size);
//     groups.forEach((children, groupId) => {
//       console.info(
//         `[MESAS-FAMILIARES] ${groupId} (${children.map(c => c.name).join(' + ')}) -> ` +
//         this.explainFamilyGroupExclusion(children)
//       );
//     });
// 
//     return Array.from(groups.entries())
//       .filter(([, children]) => this.isFamilyGroupFree(children))
//       .map(([groupId, children]) => ({
//         ...children[0],
//         id: FAMILY_TABLE_ID_PREFIX + groupId,
//         capacity: this.sumCapacity(children),
//         _displayName: 'Mesa Familiar · ' + children.map(child => child.name).join(' + ')
//       }));
//   }
// 
//   private findTableCapacity(tableId: string, tables: Table[]): number | null {
//     if (this.isFamilyTableId(tableId)) {
//       const children = this.findFamilyChildren(tableId, tables);
//       return children.length > 0 ? this.sumCapacity(children) : null;
//     }
// 
//     return tables.find(table => table.id === tableId)?.capacity ?? null;
//   }
// 
//   private findFamilyChildren(familyTableId: string, tables: Table[]): Table[] {
//     const groupId = familyTableId.slice(FAMILY_TABLE_ID_PREFIX.length);
//     return tables.filter(table => table.familyGroupId === groupId);
//   }
// 
//   private findBranchName(branchId: string): string {
//     return this.branches.find(branch => branch.branchId === branchId)?.name || UNKNOWN_LABEL;
//   }
// 
//   private isFamilyTableId(tableId: string): boolean {
//     return tableId.startsWith(FAMILY_TABLE_ID_PREFIX);
//   }
// 
//   /**
//    * 'family_merged' es el estado de reposo de una mesa fusionada, no significa
//    * ocupada. Se acepta junto a los libres, igual que hace confirm-reservation.ts
//    * al comprobar si puede bloquear la mesa.
//    */
//   private isFamilyChildFree(child: Table): boolean {
//     const restingStates = ['free', 'available', 'family_merged'];
//     return restingStates.includes(child.status)
//       && !child.currentOrderId
//       && !child.reservationId;
//   }
// 
//   private isFamilyGroupFree(children: Table[]): boolean {
//     return children.length > 0 && children.every(child => this.isFamilyChildFree(child));
//   }
// 
//   /**
//    * Explica por que un grupo familiar no aparece en el desplegable. Sin esto,
//    * un grupo con datos residuales (un reservationId de una prueba vieja, por
//    * ejemplo) desaparece en silencio y parece que la funcionalidad no existe.
//    */
//   private explainFamilyGroupExclusion(children: Table[]): string {
//     const blocked = children.find(child => !this.isFamilyChildFree(child));
//     if (!blocked) {
//       return 'disponible';
//     }
//     if (blocked.currentOrderId) {
//       return `${blocked.name}: tiene el pedido ${blocked.currentOrderId}`;
//     }
//     if (blocked.reservationId) {
//       return `${blocked.name}: reservada por ${blocked.reservationId}`;
//     }
//     return `${blocked.name}: status '${blocked.status}'`;
//   }
// 
//   private sumCapacity(tables: Table[]): number {
//     return tables.reduce((total, table) => total + (table.capacity || DEFAULT_TABLE_CAPACITY), 0);
//   }
// 
//   private get formValue(): ReservationFormValue {
//     return this.reservationForm.value as ReservationFormValue;
//   }
// }
// 
