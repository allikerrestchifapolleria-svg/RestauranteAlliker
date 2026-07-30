import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { Subscription, combineLatest, debounceTime } from 'rxjs';

import { SalesService } from '../../../services/sales';
import { OrdersService } from '../../../services/orders';
import { TableService } from '../../../services/table';
import { ReservationsService } from '../../../services/reservations';
import { BranchSelectionService } from '../../../services/branch-selection';
import { PaymentService, Payment } from '../../../services/payment';
import { Order } from '../../../models/order';
import { Table } from '../../../models/table';
import { Sale } from '../../../models/sale';
import { Reservation } from '../../../models/reservation';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy, AfterViewInit {
  dateRange: 'today' | 'week' | 'month' = 'today';
  selectedBranchId = '';

  todaySales = 0;
  salesTrend = 0;
  activeOrdersCount = 0;
  occupancyPercent = 0;
  todayReservations = 0;
  reservationsTrend = 0;

  recentOrders: Order[] = [];
  tables: Table[] = [];

  salesLabels: string[] = [];
  salesData: number[] = [];
  paymentLabels: string[] = [];
  paymentData: number[] = [];
  paymentColors: string[] = [];
  statusLabels: string[] = [];
  statusData: number[] = [];
  occupancyLabels: string[] = [];
  occupancyData: number[] = [];
  occupancyColors: string[] = [];

  totalTables = 0;
  occupiedTablesCount = 0;
  freeTablesCount = 0;
  reservedTablesCount = 0;

  loading = true;

  allOrders: Order[] = [];
  allTables: Table[] = [];
  allReservations: Reservation[] = [];
  allSales: Sale[] = [];
  allPayments: Payment[] = [];

  private salesChart?: Chart;
  private paymentChart?: Chart;
  private statusChart?: Chart;
  private occupancyChart?: Chart;
  private subs: Subscription[] = [];
  private viewReady = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private salesService: SalesService,
    private ordersService: OrdersService,
    public tableService: TableService,
    private reservationsService: ReservationsService,
    private branchSelection: BranchSelectionService,
    private paymentService: PaymentService
  ) {}

  ngOnInit() {
    this.selectedBranchId = this.branchSelection.getSelectedBranchId();

    this.subs.push(
      this.branchSelection.selectedBranchId$.subscribe(branchId => {
        this.selectedBranchId = branchId;
        this.processData();
        this.cdr.detectChanges();
        if (this.viewReady) this.renderCharts();
      })
    );

    this.subs.push(
      combineLatest([
        this.ordersService.getOrders(),
        this.tableService.getTables(),
        this.reservationsService.getReservations(),
        this.salesService.getSales(),
        this.paymentService.getPayments(),
      ]).pipe(
        debounceTime(300)
      ).subscribe({
        next: ([orders, tables, reservations, sales, payments]) => {
          this.allOrders = orders;
          this.allTables = tables;
          this.allReservations = reservations;
          this.allSales = sales;
          this.allPayments = payments;
          try {
            this.processData();
          } catch (err) {
            console.error('[DASHBOARD] Error procesando datos:', err);
          } finally {
            this.loading = false;
            this.cdr.detectChanges();
            if (this.viewReady && (orders.length > 0 || tables.length > 0 || sales.length > 0 || payments.length > 0)) {
              this.renderCharts();
            }
          }
        },
        error: (err) => {
          console.error('[DASHBOARD] Error en suscripción en tiempo real:', err);
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  ngAfterViewInit() {
    this.viewReady = true;
    if (!this.loading) {
      this.renderCharts();
    }
  }

  ngOnDestroy() {
    this.subs.forEach(s => s && s.unsubscribe());
    this.destroyCharts();
  }

  setDateRange(range: 'today' | 'week' | 'month') {
    this.dateRange = range;
    this.processData();
    this.cdr.detectChanges();
    if (this.viewReady) this.renderCharts();
  }

  private processData() {
    const bid = this.selectedBranchId;

    const branchOrders = this.allOrders.filter(o => !bid || o.branchId === bid);
    const branchTables = this.allTables.filter(t => !bid || t.branchId === bid);
    const branchReservations = this.allReservations.filter(r => !bid || r.branchId === bid);

    const branchSales = this.allSales.filter(s => !bid || s.branchId === bid);
    const { start, end } = this.getDateRange();
    const filteredSales = branchSales.filter(s => {
      const t = s.saleDate.getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    const yesterdayStart = this.getStartOfDay(new Date(Date.now() - 86400000));
    const yesterdayEnd = this.getEndOfDay(new Date(Date.now() - 86400000));
    const yesterdaySales = branchSales.filter(s => {
      const t = s.saleDate.getTime();
      return t >= yesterdayStart.getTime() && t <= yesterdayEnd.getTime();
    });

    const branchOrderIds = new Set(branchOrders.map(o => o.id));
    const filteredPayments = this.allPayments.filter(p => {
      if (!branchOrderIds.has(p.orderId)) return false;
      const t = p.createdAt.getTime();
      return t >= start.getTime() && t <= end.getTime();
    });

    this.todaySales = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + s.total, 0);
    this.salesTrend = yesterdayTotal > 0 ? ((this.todaySales - yesterdayTotal) / yesterdayTotal) * 100 : 0;

    this.activeOrdersCount = branchOrders.filter(
      o => o.status !== 'completed' && o.status !== 'cancelled'
    ).length;

    this.totalTables = branchTables.length;
    this.occupiedTablesCount = branchTables.filter(t => t.status === 'occupied').length;
    this.freeTablesCount = branchTables.filter(t => t.status === 'free' || t.status === 'available').length;
    this.reservedTablesCount = branchTables.filter(t => t.status === 'reserved').length;
    this.occupancyPercent = this.totalTables > 0
      ? Math.round((this.occupiedTablesCount / this.totalTables) * 100)
      : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    this.todayReservations = branchReservations.filter(r => {
      const rd = new Date(r.date).toISOString().split('T')[0];
      return rd === todayStr;
    }).length;
    const yesterdayReservations = branchReservations.filter(r => {
      const rd = new Date(r.date).toISOString().split('T')[0];
      return rd === yesterdayStr;
    }).length;
    this.reservationsTrend = yesterdayReservations > 0
      ? ((this.todayReservations - yesterdayReservations) / yesterdayReservations) * 100
      : 0;

    this.recentOrders = [...branchOrders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    this.tables = branchTables;

    this.computeSalesChartData(filteredSales);
    this.computePaymentChartData(filteredPayments);
    this.computeOrderStatusChartData(branchOrders);
    this.computeOccupancyChartData(branchTables);
  }

  private computeSalesChartData(sales: Sale[]) {
    if (this.dateRange === 'today') {
      const hourlyTotals = new Array(24).fill(0);
      sales.forEach(s => {
        const hour = s.saleDate.getHours();
        hourlyTotals[hour] += s.total;
      });
      this.salesLabels = hourlyTotals.map((_, i) => `${i.toString().padStart(2, '0')}:00`);
      this.salesData = hourlyTotals;
    } else if (this.dateRange === 'week') {
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dailyTotals = new Array(7).fill(0);
      sales.forEach(s => {
        const day = s.saleDate.getDay();
        dailyTotals[day] += s.total;
      });
      this.salesLabels = dayNames;
      this.salesData = dailyTotals;
    } else {
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const dailyTotals = new Array(daysInMonth).fill(0);
      sales.forEach(s => {
        const day = s.saleDate.getDate() - 1;
        if (day >= 0 && day < daysInMonth) dailyTotals[day] += s.total;
      });
      this.salesLabels = dailyTotals.map((_, i) => `${i + 1}`);
      this.salesData = dailyTotals;
    }
  }

  private computePaymentChartData(payments: Payment[]) {
    const methodMap: { [key: string]: number } = {};
    const methodColors: { [key: string]: string } = {
      cash: '#4fc3f7',
      card: '#66bb6a',
      credit_card: '#ab47bc',
      debit_card: '#ffa726',
      yape: '#ef5350',
      plin: '#26c6da',
      transfer: '#8d6e63',
    };
    payments.forEach(p => {
      const method = p.method || 'Otro';
      methodMap[method] = (methodMap[method] || 0) + p.amount;
    });
    this.paymentLabels = Object.keys(methodMap).map(k => this.getPaymentLabel(k));
    this.paymentData = Object.values(methodMap);
    this.paymentColors = Object.keys(methodMap).map(
      k => methodColors[k.toLowerCase()] || '#78909c'
    );
  }

  private getPaymentLabel(method: string): string {
    const labels: { [key: string]: string } = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      credit_card: 'Tarjeta Crédito',
      debit_card: 'Tarjeta Débito',
      yape: 'Yape',
      plin: 'Plin',
      transfer: 'Transferencia',
    };
    return labels[method.toLowerCase()] || method;
  }

  private computeOrderStatusChartData(orders: Order[]) {
    const statusMap: { [key: string]: number } = {};
    const statusLabels: { [key: string]: string } = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      preparing: 'Preparando',
      ready: 'Listo',
      served: 'Servido',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    orders.forEach(o => {
      const label = statusLabels[o.status] || o.status;
      statusMap[label] = (statusMap[label] || 0) + 1;
    });
    this.statusLabels = Object.keys(statusMap);
    this.statusData = Object.values(statusMap);
  }

  private computeOccupancyChartData(tables: Table[]) {
    this.occupancyLabels = ['Ocupadas', 'Disponibles', 'Reservadas', 'Mantenimiento'];
    const occupied = tables.filter(t => t.status === 'occupied').length;
    const free = tables.filter(t => t.status === 'free' || t.status === 'available').length;
    const reserved = tables.filter(t => t.status === 'reserved').length;
    const maintenance = tables.filter(t =>
      t.status !== 'occupied' && t.status !== 'free' &&
      t.status !== 'available' && t.status !== 'reserved'
    ).length;
    this.occupancyData = [occupied, free, reserved, maintenance];
    this.occupancyColors = ['#ef5350', '#66bb6a', '#ffa726', '#78909c'];
  }

  private renderCharts() {
    console.log('[DASHBOARD] renderCharts START');
    this.destroyCharts();
    this.renderSalesChart();
    this.renderPaymentChart();
    this.renderStatusChart();
    this.renderOccupancyChart();
    console.log('[DASHBOARD] renderCharts COMPLETE');
  }

  private renderSalesChart() {
    console.log('[DASHBOARD] renderSalesChart - labels:', this.salesLabels.length, 'data:', this.salesData.length);
    if (this.salesData.length === 0 || this.salesData.every(v => v === 0)) {
      console.log('[DASHBOARD] renderSalesChart: SKIP - no sales data');
      return;
    }
    const canvas = document.getElementById('salesChart') as HTMLCanvasElement;
    if (!canvas) { console.log('[DASHBOARD] renderSalesChart: canvas NOT FOUND'); return; }
    this.salesChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: this.salesLabels,
        datasets: [{
          label: 'Ventas (S/)',
          data: this.salesData,
          borderColor: '#4fc3f7',
          backgroundColor: 'rgba(79, 195, 247, 0.12)',
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointBackgroundColor: '#4fc3f7',
          pointBorderColor: '#0a0e17',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e2a3a',
            titleColor: '#e0e6ed',
            bodyColor: '#e0e6ed',
            borderColor: '#2a3a4a',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: ctx => 'S/ ' + Number(ctx.parsed.y).toFixed(2),
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#8892a4', maxTicksLimit: 10 },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#8892a4',
              callback: value => 'S/ ' + Number(value).toFixed(2),
            },
            beginAtZero: true,
          },
        },
      },
    });
  }

  private renderPaymentChart() {
    console.log('[DASHBOARD] renderPaymentChart - labels:', this.paymentLabels.length, 'data:', this.paymentData.length);
    if (this.paymentData.length === 0 || this.paymentData.every(v => v === 0)) {
      console.log('[DASHBOARD] renderPaymentChart: SKIP - no payment data');
      return;
    }
    const canvas = document.getElementById('paymentChart') as HTMLCanvasElement;
    if (!canvas) { console.log('[DASHBOARD] renderPaymentChart: canvas NOT FOUND'); return; }
    this.paymentChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: this.paymentLabels,
        datasets: [{
          data: this.paymentData,
          backgroundColor: this.paymentColors.length > 0
            ? this.paymentColors
            : ['#4fc3f7', '#66bb6a', '#ab47bc', '#ffa726'],
          borderColor: '#141b2d',
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#8892a4',
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            backgroundColor: '#1e2a3a',
            titleColor: '#e0e6ed',
            bodyColor: '#e0e6ed',
            borderColor: '#2a3a4a',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: ctx => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const val = Number(ctx.parsed);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: S/ ${val.toFixed(2)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  private renderStatusChart() {
    console.log('[DASHBOARD] renderStatusChart - labels:', this.statusLabels.length, 'data:', this.statusData.length);
    if (this.statusData.length === 0 || this.statusData.every(v => v === 0)) {
      console.log('[DASHBOARD] renderStatusChart: SKIP - no status data');
      return;
    }
    const canvas = document.getElementById('statusChart') as HTMLCanvasElement;
    if (!canvas) { console.log('[DASHBOARD] renderStatusChart: canvas NOT FOUND'); return; }
    const colors = ['#ffa726', '#4fc3f7', '#ab47bc', '#66bb6a', '#26c6da', '#78909c', '#ef5350'];
    this.statusChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: this.statusLabels,
        datasets: [{
          label: 'Pedidos',
          data: this.statusData,
          backgroundColor: this.statusLabels.map((_, i) => colors[i % colors.length]),
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 28,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e2a3a',
            titleColor: '#e0e6ed',
            bodyColor: '#e0e6ed',
            borderColor: '#2a3a4a',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#8892a4', stepSize: 1 },
            beginAtZero: true,
          },
          y: {
            grid: { display: false },
            ticks: { color: '#8892a4', font: { size: 11 } },
          },
        },
      },
    });
  }

  private renderOccupancyChart() {
    console.log('[DASHBOARD] renderOccupancyChart - data:', JSON.stringify(this.occupancyData));
    if (this.occupancyData.length === 0 || this.occupancyData.every(v => v === 0)) {
      console.log('[DASHBOARD] renderOccupancyChart: SKIP - no table data');
      return;
    }
    const canvas = document.getElementById('occupancyChart') as HTMLCanvasElement;
    if (!canvas) { console.log('[DASHBOARD] renderOccupancyChart: canvas NOT FOUND'); return; }
    this.occupancyChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: this.occupancyLabels,
        datasets: [{
          data: this.occupancyData,
          backgroundColor: this.occupancyColors,
          borderColor: '#141b2d',
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#8892a4',
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            backgroundColor: '#1e2a3a',
            titleColor: '#e0e6ed',
            bodyColor: '#e0e6ed',
            borderColor: '#2a3a4a',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: ctx => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const val = Number(ctx.parsed);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${val} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  private destroyCharts() {
    this.salesChart?.destroy();
    this.paymentChart?.destroy();
    this.statusChart?.destroy();
    this.occupancyChart?.destroy();
  }

  private getDateRange(): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    const end = this.getEndOfDay(now);

    if (this.dateRange === 'today') {
      start = this.getStartOfDay(now);
    } else if (this.dateRange === 'week') {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start = this.getStartOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff));
    } else {
      start = this.getStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    }

    return { start, end };
  }

  private getStartOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private getEndOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      preparing: 'Preparando',
      ready: 'Listo',
      served: 'Servido',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  }

  getTableStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      free: 'Disponible',
      available: 'Disponible',
      occupied: 'Ocupada',
      reserved: 'Reservada',
      maintenance: 'Mantenimiento',
    };
    return labels[status] || status;
  }
}
