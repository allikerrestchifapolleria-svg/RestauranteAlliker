import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { take, timeout } from 'rxjs/operators';
import { Sale } from '../../../models/sale';
import { Payment, PaymentMethod } from '../../../services/payment';
import { SalesService } from '../../../services/sales';
import { PaymentService } from '../../../services/payment';
import { OrdersService } from '../../../services/orders';
import { BranchService } from '../../../services/branch';
import { BranchSelectionService } from '../../../services/branch-selection';
import { Branch } from '../../../models/branch';
import { formatLocalDate } from '../../../services/date-utils';

interface VentasRow {
  index: number;
  saleId: string;
  orderId: string;
  orderNumber?: number;
  waiterName: string;
  total: number;
  date: Date;
  branchId: string;
  branchName: string;
  methods: { method: PaymentMethod; amount: number }[];
}

@Component({
  selector: 'app-ventas',
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas.html',
  styleUrl: './ventas.css'
})
export class Ventas implements OnInit, OnDestroy {
  rows: VentasRow[] = [];
  loading = true;
  errorMessage = '';
  searchTerm = '';
  selectedBranchId = '';
  branches: Branch[] = [];
  dateStart: string = '';
  dateEnd: string = '';

  private salesSubscription?: Subscription;
  private subs: Subscription[] = [];

  constructor(
    private salesService: SalesService,
    private paymentService: PaymentService,
    private ordersService: OrdersService,
    private branchService: BranchService,
    private branchSelection: BranchSelectionService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const now = new Date();
    this.dateStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
    this.dateEnd = formatLocalDate(now);

    this.selectedBranchId = this.branchSelection.getSelectedBranchId();
    this.subs.push(
      this.branchService.branches$.subscribe(branches => {
        this.branches = branches;
      })
    );
    this.subs.push(
      this.branchSelection.selectedBranchId$.subscribe(id => {
        this.selectedBranchId = id;
        this.loadData();
      })
    );
    this.loadData();
  }

  private methodLabels: Record<PaymentMethod, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    yape: 'Yape'
  };

  getMethodLabel(m: PaymentMethod): string {
    return this.methodLabels[m] || m;
  }

  getMethodClass(m: PaymentMethod): string {
    if (m === 'cash') return 'pm-cash';
    if (m === 'card') return 'pm-card';
    if (m === 'yape') return 'pm-yape';
    return 'pm-desconocido';
  }

  toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  onDateInput(field: 'start' | 'end', value: string): void {
    if (field === 'start') this.dateStart = value;
    else this.dateEnd = value;
    this.loadData();
  }

  loadData(): void {
    this.salesSubscription?.unsubscribe();

    this.loading = true;
    this.errorMessage = '';

    const [sy, sm, sd] = this.dateStart.split('-').map(Number);
    const [ey, em, ed] = this.dateEnd.split('-').map(Number);
    const startLocal = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const endLocal = new Date(ey, em - 1, ed, 23, 59, 59, 999);

    this.salesSubscription = this.salesService
      .getSales()
      .pipe(
        take(1),
        timeout(10000)
      )
      .subscribe({
        next: async (allSales) => {
          const branchMap = new Map<string, string>();
          this.branches.forEach(b => branchMap.set(b.id, b.name));

          const sales = allSales.filter(s => {
            const d = new Date(s.saleDate);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return dateStr >= this.dateStart && dateStr <= this.dateEnd;
          });

          const orderNumberMap = new Map<string, number>();
          try {
            const orders = await new Promise<any[]>(resolve =>
              this.ordersService.getOrders().pipe(take(1)).subscribe({
                next: o => resolve(o),
                error: () => resolve([])
              })
            );
            orders.forEach(o => {
              if (o.orderNumber) orderNumberMap.set(o.id, o.orderNumber);
            });
          } catch {
            console.warn('[VENTAS] Error al cargar órdenes');
          }

          let payments: Payment[] = [];
          try {
            payments = await this.paymentService.getPaymentsByDateRangeFromFirestore(startLocal, endLocal);
          } catch {
            console.warn('[VENTAS] Error al cargar pagos, usando método directo de venta');
          }

          const payByOrder = new Map<string, { method: PaymentMethod; amount: number }[]>();
          for (const p of payments) {
            if (!payByOrder.has(p.orderId)) payByOrder.set(p.orderId, []);
            payByOrder.get(p.orderId)!.push({ method: p.method, amount: p.amount });
          }

          const rows = sales
            .filter(s => {
              if (this.selectedBranchId) return s.branchId === this.selectedBranchId;
              return true;
            })
            .map((s, i) => ({
              index: i + 1,
              saleId: s.saleId,
              orderId: s.orderId,
              orderNumber: orderNumberMap.get(s.orderId),
              waiterName: s.waiterName || '-',
              total: s.total,
              date: s.saleDate,
              branchId: s.branchId,
              branchName: branchMap.get(s.branchId) || s.branchId,
              methods: payByOrder.get(s.orderId) || [{ method: s.paymentMethod as PaymentMethod, amount: s.total }]
            }));

          this.ngZone.run(() => {
            this.rows = rows;
            this.loading = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          console.error('[VENTAS] Error:', err);
          this.ngZone.run(() => {
            this.errorMessage = 'Error al cargar los datos. Intente nuevamente.';
            this.rows = [];
            this.loading = false;
            this.cdr.detectChanges();
          });
        }
      });
  }

  get filteredRows(): VentasRow[] {
    if (!this.searchTerm) return this.rows;
    const term = this.searchTerm.toLowerCase();
    return this.rows.filter(r =>
      r.orderId.toLowerCase().includes(term) ||
      r.waiterName.toLowerCase().includes(term) ||
      r.branchName.toLowerCase().includes(term)
    );
  }

  get totalVentas(): number {
    return this.filteredRows.reduce((sum, r) => sum + r.total, 0);
  }

  get totalTransactions(): number {
    return this.filteredRows.length;
  }

  get averageTicket(): number {
    if (this.totalTransactions === 0) return 0;
    return this.totalVentas / this.totalTransactions;
  }

  get paymentMethodsCount(): number {
    const methods = new Set<string>();
    for (const row of this.filteredRows) {
      for (const m of row.methods) {
        methods.add(m.method);
      }
    }
    return methods.size;
  }

  get paymentSummary(): { method: PaymentMethod; label: string; total: number; count: number }[] {
    const grouped = new Map<PaymentMethod, { total: number; count: number }>();
    for (const row of this.filteredRows) {
      for (const m of row.methods) {
        if (!grouped.has(m.method)) grouped.set(m.method, { total: 0, count: 0 });
        const entry = grouped.get(m.method)!;
        entry.total += m.amount;
        entry.count++;
      }
    }
    return Array.from(grouped.entries()).map(([method, data]) => ({
      method,
      label: this.methodLabels[method] || method,
      total: data.total,
      count: data.count
    }));
  }

  get paymentGrandTotal(): number {
    return this.paymentSummary.reduce((t, p) => t + p.total, 0);
  }

  trackBySaleId(_: number, row: VentasRow): string {
    return row.saleId;
  }

  ngOnDestroy() {
    this.salesSubscription?.unsubscribe();
    this.subs.forEach(s => s.unsubscribe());
  }
}
