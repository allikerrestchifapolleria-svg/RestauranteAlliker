import { Component, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderHistoryService, OrderHistoryPage } from '../../../services/order-history';
import { BranchSelectionService } from '../../../services/branch-selection';
import { TableService } from '../../../services/table';
import { Order } from '../../../models/order';

@Component({
  selector: 'app-order-history',
  imports: [CommonModule, FormsModule],
  templateUrl: './order-history.html',
  styleUrl: './order-history.css'
})
export class OrderHistory {
  dateFrom: string = '';
  dateTo: string = '';
  filterStatus: string = 'all';
  searchTerm: string = '';
  orders: Order[] = [];
  isLoading: boolean = false;
  currentPage: number = 1;
  hasMore: boolean = false;
  hasPrev: boolean = false;
  pageHistory: { lastDoc: any; page: number }[] = [];
  currentLastDoc: any = null;

  statusOptions = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'delivered', label: 'Entregado' },
    { value: 'cancelled', label: 'Cancelado' },
    { value: 'paid', label: 'Pagado' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'preparing', label: 'Preparando' },
    { value: 'ready', label: 'Listo' }
  ];

  constructor(
    private orderHistoryService: OrderHistoryService,
    private branchSelection: BranchSelectionService,
    public tableService: TableService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      preparing: 'Preparando',
      ready: 'Listo',
      delivered: 'Entregado',
      cancelled: 'Cancelado'
    };
    return labels[status] || status;
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#06b6d4',
      preparing: '#3b82f6',
      ready: '#22c55e',
      delivered: '#8b5cf6',
      cancelled: '#ef4444'
    };
    return colors[status] || '#6b7280';
  }

  getPaymentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      paid: 'Pagado',
      refunded: 'Reembolsado'
    };
    return labels[status] || status;
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      dine_in: 'Comer aquí',
      takeout: 'Para llevar'
    };
    return labels[type] || type;
  }

  async search() {
    try {
      this.isLoading = true;
      this.currentPage = 1;
      this.pageHistory = [];
      this.currentLastDoc = null;

      const from = this.dateFrom ? new Date(this.dateFrom + 'T00:00:00') : new Date(new Date().setHours(0, 0, 0, 0));
      const to = this.dateTo ? new Date(this.dateTo + 'T23:59:59') : new Date(new Date().setHours(23, 59, 59, 999));
      const branchId = this.branchSelection.getSelectedBranchId() || '';

      const result = await this.orderHistoryService.getOrdersPage(
        from, to, this.filterStatus, this.searchTerm, branchId, 20, null
      );

      this.ngZone.run(() => {
        this.orders = result.orders;
        this.hasMore = result.hasMore;
        this.hasPrev = false;
        this.currentLastDoc = result.lastDoc;
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('[ORDER HISTORY] Error en búsqueda:', error);
      this.ngZone.run(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async nextPage() {
    try {
      if (!this.hasMore || !this.currentLastDoc) return;
      this.isLoading = true;

      this.pageHistory.push({ lastDoc: this.currentLastDoc, page: this.currentPage });

      const from = this.dateFrom ? new Date(this.dateFrom + 'T00:00:00') : new Date(new Date().setHours(0, 0, 0, 0));
      const to = this.dateTo ? new Date(this.dateTo + 'T23:59:59') : new Date(new Date().setHours(23, 59, 59, 999));
      const branchId = this.branchSelection.getSelectedBranchId() || '';

      const result = await this.orderHistoryService.getOrdersPage(
        from, to, this.filterStatus, this.searchTerm, branchId, 20, this.currentLastDoc
      );

      this.ngZone.run(() => {
        this.orders = result.orders;
        this.hasMore = result.hasMore;
        this.currentLastDoc = result.lastDoc;
        this.currentPage++;
        this.hasPrev = true;
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('[ORDER HISTORY] Error en nextPage:', error);
      this.ngZone.run(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async prevPage() {
    try {
      if (this.pageHistory.length === 0) return;
      this.isLoading = true;

      const prev = this.pageHistory.pop()!;
      this.currentPage = prev.page;

      const from = this.dateFrom ? new Date(this.dateFrom + 'T00:00:00') : new Date(new Date().setHours(0, 0, 0, 0));
      const to = this.dateTo ? new Date(this.dateTo + 'T23:59:59') : new Date(new Date().setHours(23, 59, 59, 999));
      const branchId = this.branchSelection.getSelectedBranchId() || '';

      const result = await this.orderHistoryService.getOrdersPage(
        from, to, this.filterStatus, this.searchTerm, branchId, 20, prev.lastDoc
      );

      this.ngZone.run(() => {
        this.orders = result.orders;
        this.hasMore = result.hasMore;
        this.currentLastDoc = result.lastDoc;
        this.hasPrev = this.pageHistory.length > 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('[ORDER HISTORY] Error en prevPage:', error);
      this.ngZone.run(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      });
    }
  }
}
