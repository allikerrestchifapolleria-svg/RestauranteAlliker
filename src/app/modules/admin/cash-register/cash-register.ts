import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, from, of } from 'rxjs';
import { take, timeout, catchError } from 'rxjs/operators';
import { SalesService } from '../../../services/sales';
import { OrdersService } from '../../../services/orders';
import { PaymentService, Payment } from '../../../services/payment';
import { BranchService } from '../../../services/branch';
import { BranchSelectionService } from '../../../services/branch-selection';
import { Sale } from '../../../models/sale';
import { Order } from '../../../models/order';
import { Branch } from '../../../models/branch';
import { startOfDay, endOfDay, parseLocalDate } from '../../../services/date-utils';

interface PaymentSummary {
  method: string;
  label: string;
  total: number;
  count: number;
}

interface WaiterSummary {
  waiterId: string;
  waiterName: string;
  total: number;
  count: number;
}

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash-register.html',
  styleUrls: ['./cash-register.css'],
})
export class CashRegister implements OnInit, OnDestroy {
  selectedBranchId = '';
  selectedDate: string = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();
  sales: Sale[] = [];
  orders: Order[] = [];
  orderNumberMap = new Map<string, string>();
  tableNameMap = new Map<string, string>();
  grandTotal = 0;
  paymentSummary: PaymentSummary[] = [];
  paymentGrandTotal = 0;
  waiterSummary: WaiterSummary[] = [];
  ordersGrandTotal = 0;
  branches: Branch[] = [];
  loading = false;
  errorMessage = '';

  private salesSubscription?: Subscription;
  private ordersSubscription?: Subscription;
  private branchSubscription?: Subscription;

  constructor(
    private salesService: SalesService,
    private paymentService: PaymentService,
    private ordersService: OrdersService,
    private branchService: BranchService,
    private branchSelection: BranchSelectionService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('[CAJA-DEBUG] Componente inicializado');
    this.selectedBranchId = this.branchSelection.getSelectedBranchId() || '';

    this.branchService.branches$.pipe(take(1)).subscribe(b => this.branches = b);

    this.loadSales();

    this.branchSubscription =
      this.branchSelection.selectedBranchId$
        .subscribe(branchId => {
          const newBranchId = branchId || '';
          if (newBranchId === this.selectedBranchId) return;
          this.selectedBranchId = newBranchId;
          this.loadSales();
        });
  }

  loadSales(): void {
    this.salesSubscription?.unsubscribe();

    this.loading = true;
    this.errorMessage = '';

    const baseDate = this.selectedDate ? parseLocalDate(this.selectedDate) : new Date();
    const start = startOfDay(baseDate);
    const end = endOfDay(baseDate);

    this.salesSubscription = this.salesService
      .getSalesByDateRange(start, end)
      .subscribe({
        next: (data) => {
          this.ngZone.run(() => {
            console.log('[CAJA-DEBUG] VENTAS RECIBIDAS:', data);
            this.sales = Array.isArray(data) ? data : [];
            this.grandTotal = this.sales.reduce((t, s) => t + this.toNumber(s.total), 0);
            this.buildWaiterSummaryFromSales();
            this.loading = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            console.error('[CAJA-DEBUG] ERROR ventas:', err);
            this.errorMessage = 'Error al cargar ventas: ' + err.message;
            this.cdr.detectChanges();
          });
        }
      });

    this.ordersSubscription?.unsubscribe();
    this.ordersSubscription = this.ordersService
      .getOrders()
      .subscribe({
        next: (all) => {
          this.ngZone.run(() => {
            console.log('[CAJA-DEBUG] PEDIDOS CARGADOS:', all.length);
            this.orderNumberMap.clear();
            this.tableNameMap.clear();
            for (const o of all) {
              if (o.orderNumber) this.orderNumberMap.set(o.id, String(o.orderNumber));
              if (o.tableName || o.tableId) this.tableNameMap.set(o.id, o.tableName || o.tableId || '');
            }
            const oStart = start;
            const oEnd = end;
            this.orders = all.filter(o => {
              const d = new Date(o.createdAt);
              return d >= oStart && d <= oEnd;
            });
            console.log('[CAJA-DEBUG] PEDIDOS DEL DIA:', this.orders.length);
            // Los pedidos cancelados se muestran en la tabla como referencia, pero no
            // suman al gran total: nunca generaron una venta real en la colección "sales",
            // y sumarlos infla el total comparado con "Ventas del día" / "Resumen por mozo".
            this.ordersGrandTotal = this.orders
              .filter(o => o.status !== 'cancelled')
              .reduce((t, o) => t + this.toNumber(o.total), 0);
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          console.error('[CAJA-DEBUG] ERROR pedidos:', err?.name, err?.message, err);
        }
      });

    from(this.paymentService.getPaymentsByDateRangeFromFirestore(start, end))
      .pipe(
        timeout(10000),
        catchError(err => {
          console.error('[CAJA-DEBUG] ERROR pagos:', err);
          return of([]);
        })
      )
      .subscribe(payments => {
        this.ngZone.run(() => {
          console.log('[CAJA-DEBUG] PAGOS RECIBIDOS:', payments.length);
          this.buildPaymentSummaryFromPayments(payments);
          this.cdr.detectChanges();
        });
      });
  }

  buildPaymentSummaryFromPayments(payments: Payment[]): void {
    const methodLabels: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      yape: 'Yape',
      plin: 'Plin',
      transfer: 'Transferencia'
    };
    const grouped = new Map<string, { total: number; count: number }>();
    for (const p of payments) {
      const m = p.method || 'desconocido';
      if (!grouped.has(m)) grouped.set(m, { total: 0, count: 0 });
      const entry = grouped.get(m)!;
      entry.total += this.toNumber(p.amount);
      entry.count++;
    }
    this.paymentSummary = Array.from(grouped.entries()).map(([method, data]) => ({
      method,
      label: methodLabels[method] || method,
      total: data.total,
      count: data.count
    }));
    this.paymentGrandTotal = this.paymentSummary.reduce((t, p) => t + p.total, 0);
  }

  buildWaiterSummaryFromSales(): void {
    const grouped = new Map<string, { name: string; total: number; count: number }>();
    for (const s of this.sales) {
      const id = s.waiterId || 'sin-asignar';
      const name = s.waiterName || 'Sin mozo';
      if (!grouped.has(id)) grouped.set(id, { name, total: 0, count: 0 });
      const entry = grouped.get(id)!;
      entry.total += this.toNumber(s.total);
      entry.count++;
    }
    this.waiterSummary = Array.from(grouped.entries()).map(([, data]) => ({
      waiterId: data.name,
      waiterName: data.name,
      total: data.total,
      count: data.count
    }));
  }

  getOrderNumber(orderId: string): string {
    return this.orderNumberMap.get(orderId) || orderId?.slice(-6) || 'Sin orden';
  }

  getBranchName(branchId: string): string {
    const branch = this.branches.find(b => b.id === branchId || b.branchId === branchId);
    return branch?.name || branchId || 'Sin sucursal';
  }

  getTableName(sale: Sale): string {
    return this.tableNameMap.get(sale.orderId) || sale.tableId || 'Sin mesa';
  }

  get averageTicket(): number {
    if (this.sales.length === 0) return 0;
    return this.grandTotal / this.sales.length;
  }

  toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  ngOnDestroy(): void {
    this.salesSubscription?.unsubscribe();
    this.ordersSubscription?.unsubscribe();
    this.branchSubscription?.unsubscribe();
  }
}
