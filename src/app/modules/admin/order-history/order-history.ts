import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import {
  ORDER_HISTORY_ANY_STATUS,
  OrderHistoryCursor,
  OrderHistoryService
} from '../../../services/order-history';
import { BranchSelectionService } from '../../../services/branch-selection';
import { TableService } from '../../../services/table';
import { Order } from '../../../models/order';

interface StatusOption {
  value: string;
  label: string;
}

const PAGE_SIZE = 20;
const EMPTY_VALUE = '—';

/** Etiquetas alineadas con cocina, mozo y dashboard para no mostrar dos nombres del mismo estado. */
const ORDER_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  preparing: 'Preparando',
  ready: 'Lista',
  served: 'Servida',
  delivered: 'Entregada',
  completed: 'Completada',
  cancelled: 'Cancelada'
};

const ORDER_STATUS_COLORS: Readonly<Record<string, string>> = {
  pending: '#f59e0b',
  confirmed: '#06b6d4',
  preparing: '#3b82f6',
  ready: '#22c55e',
  served: '#14b8a6',
  delivered: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#ef4444'
};

const DEFAULT_STATUS_COLOR = '#6b7280';

/** `completed` lo escribe el flujo de pago del mozo; equivale a pagado. */
const PAYMENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  completed: 'Pagado',
  refunded: 'Reembolsado'
};

const PAID_PAYMENT_STATUSES: readonly string[] = ['paid', 'completed'];

const ORDER_TYPE_LABELS: Readonly<Record<string, string>> = {
  dine_in: 'Comer aquí',
  takeout: 'Para llevar',
  delivery: 'Delivery'
};

@Component({
  selector: 'app-order-history',
  imports: [CommonModule, FormsModule],
  templateUrl: './order-history.html',
  styleUrl: './order-history.css'
})
export class OrderHistory implements OnInit, OnDestroy {
  /** El estado "Todos" mas la lista real de estados que escribe la aplicacion. */
  readonly statusOptions: StatusOption[] = [
    { value: ORDER_HISTORY_ANY_STATUS, label: 'Todos los estados' },
    ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }))
  ];

  dateFrom = '';
  dateTo = '';
  filterStatus = ORDER_HISTORY_ANY_STATUS;
  searchTerm = '';

  orders: Order[] = [];
  isLoading = false;
  errorMessage = '';
  currentPage = 1;
  hasMore = false;

  private selectedBranchId = '';
  /** `pageCursors[n]` es el cursor con el que se pide la pagina n + 1 (el de la pagina 1 es null). */
  private pageCursors: OrderHistoryCursor[] = [null];
  private activeRequestId = 0;
  private isDestroyed = false;
  private readonly subscriptions = new Subscription();

  constructor(
    private orderHistoryService: OrderHistoryService,
    private branchSelection: BranchSelectionService,
    private tableService: TableService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeDateRange();
    this.selectedBranchId = this.branchSelection.getSelectedBranchId() || '';

    this.subscriptions.add(
      this.branchSelection.selectedBranchId$.subscribe(branchId => {
        const nextBranchId = branchId || '';
        if (nextBranchId === this.selectedBranchId) return;
        this.selectedBranchId = nextBranchId;
        this.search();
      })
    );

    // Las mesas se cargan en segundo plano: cuando llegan hay que repintar sus nombres.
    this.subscriptions.add(
      this.tableService.tables$.pipe(skip(1)).subscribe(() => this.refreshView())
    );

    this.search();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.subscriptions.unsubscribe();
  }

  get hasPrev(): boolean {
    return this.currentPage > 1;
  }

  /** Filtro de texto sobre la pagina cargada; Firestore no soporta busqueda parcial. */
  get filteredOrders(): Order[] {
    const term = this.normalizeSearchTerm(this.searchTerm);
    if (!term) return this.orders;
    return this.orders.filter(order => this.matchesSearch(order, term));
  }

  search(): void {
    void this.loadPage(1);
  }

  nextPage(): void {
    if (!this.hasMore) return;
    void this.loadPage(this.currentPage + 1);
  }

  prevPage(): void {
    if (!this.hasPrev) return;
    void this.loadPage(this.currentPage - 1);
  }

  getOrderNumber(order: Order): string {
    if (order.orderNumber) return `#${order.orderNumber}`;
    return order.id ? `#${order.id.slice(-6)}` : EMPTY_VALUE;
  }

  getTableName(order: Order): string {
    return order.tableName?.trim()
      || this.tableService.getTableDisplayName(order.tableId)
      || order.tableId
      || EMPTY_VALUE;
  }

  getWaiterName(order: Order): string {
    return order.waiterName?.trim() || EMPTY_VALUE;
  }

  getItemsCount(order: Order): number {
    return order.items?.length ?? 0;
  }

  getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status] ?? status;
  }

  getStatusColor(status: string): string {
    return ORDER_STATUS_COLORS[status] ?? DEFAULT_STATUS_COLOR;
  }

  getPaymentStatusLabel(status: string): string {
    return PAYMENT_STATUS_LABELS[status] ?? status;
  }

  isPaid(order: Order): boolean {
    return PAID_PAYMENT_STATUSES.includes(order.paymentStatus);
  }

  getTypeLabel(type: string): string {
    return ORDER_TYPE_LABELS[type] ?? type;
  }

  trackByOrderId(_index: number, order: Order): string {
    return order.id;
  }

  private async loadPage(page: number): Promise<void> {
    const from = this.startOfDay(this.dateFrom);
    const to = this.endOfDay(this.dateTo);

    if (from.getTime() > to.getTime()) {
      this.showEmptyResult('La fecha "Desde" no puede ser posterior a la fecha "Hasta".');
      return;
    }

    if (page === 1) {
      this.pageCursors = [null];
    }

    const cursor = this.pageCursors[page - 1] ?? null;
    if (page > 1 && !cursor) {
      this.showEmptyResult('Se perdio la paginacion. Vuelva a buscar.');
      return;
    }

    const requestId = ++this.activeRequestId;
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const result = await this.orderHistoryService.getOrdersPage({
        from,
        to,
        status: this.filterStatus,
        branchId: this.selectedBranchId,
        pageSize: PAGE_SIZE,
        cursor
      });

      if (this.isStaleRequest(requestId)) return;

      this.refreshView(() => {
        this.orders = result.orders;
        this.hasMore = result.hasMore;
        this.currentPage = page;
        this.pageCursors[page] = result.nextCursor;
        this.isLoading = false;
      });
    } catch (error) {
      console.error('[ORDER HISTORY] Error consultando el historial:', error);
      if (this.isStaleRequest(requestId)) return;
      this.showEmptyResult(this.describeError(error));
    }
  }

  private matchesSearch(order: Order, term: string): boolean {
    return this.getOrderNumber(order).toLowerCase().includes(term)
      || this.getTableName(order).toLowerCase().includes(term)
      || this.getWaiterName(order).toLowerCase().includes(term);
  }

  private normalizeSearchTerm(value: string): string {
    return value.trim().replace(/^#/, '').toLowerCase();
  }

  private initializeDateRange(): void {
    const today = new Date();
    this.dateFrom = this.toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1));
    this.dateTo = this.toDateInputValue(today);
  }

  /** `yyyy-MM-dd` en hora local: `toISOString()` adelanta un dia en zonas UTC negativas. */
  private toDateInputValue(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private startOfDay(value: string): Date {
    const { year, month, day } = this.parseDateInput(value);
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  private endOfDay(value: string): Date {
    const { year, month, day } = this.parseDateInput(value);
    return new Date(year, month, day, 23, 59, 59, 999);
  }

  /** Interpreta `yyyy-MM-dd` como fecha local; si el input esta vacio cae en el dia de hoy. */
  private parseDateInput(value: string): { year: number; month: number; day: number } {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      const today = new Date();
      return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };
    }
    return { year, month: month - 1, day };
  }

  private showEmptyResult(message: string): void {
    this.refreshView(() => {
      this.orders = [];
      this.hasMore = false;
      this.errorMessage = message;
      this.isLoading = false;
    });
  }

  private describeError(error: unknown): string {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'failed-precondition') {
      return 'La consulta necesita un indice compuesto de Firestore que aun no existe. Revise la consola del navegador para crearlo.';
    }
    if (code === 'permission-denied') {
      return 'No tiene permisos para consultar el historial de ordenes.';
    }
    return 'No se pudo cargar el historial. Intente nuevamente.';
  }

  /** Descarta la respuesta de una consulta que ya fue reemplazada por otra mas reciente. */
  private isStaleRequest(requestId: number): boolean {
    return this.isDestroyed || requestId !== this.activeRequestId;
  }

  private refreshView(mutate?: () => void): void {
    if (this.isDestroyed) return;
    this.ngZone.run(() => {
      mutate?.();
      this.cdr.detectChanges();
    });
  }
}
