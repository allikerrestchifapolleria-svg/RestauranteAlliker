import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { OrdersService } from '../../../services/orders';
import { BranchSelectionService } from '../../../services/branch-selection';
import { TableService } from '../../../services/table';
import { Order, OrderItem } from '../../../models/order';
import { Auth } from '../../../services/auth';

interface KanbanColumn {
  id: string;
  label: string;
  icon: string;
  color: string;
  orders: Order[];
}

@Component({
  selector: 'app-kitchen-orders',
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class Orders implements OnInit, OnDestroy {
  orders$: Observable<Order[]> = new Observable<Order[]>();
  orders: Order[] = [];
  viewOrderId: string | null = null;
  currentBranchId: string = '';

  kanbanColumns: KanbanColumn[] = [
    { id: 'pending',    label: 'Pendientes',        icon: 'fa-clock',        color: '#f59e0b', orders: [] },
    { id: 'confirmed',  label: 'Confirmadas',       icon: 'fa-check-circle', color: '#06b6d4', orders: [] },
    { id: 'preparing',  label: 'En Preparación',    icon: 'fa-fire',         color: '#fb7185', orders: [] },
  ];

  expandedCards: Set<string> = new Set();

  /** Which kanban column is shown on the mobile single-column view. */
  activeKanbanColumn: string = 'pending';

  setActiveKanbanColumn(id: string) {
    this.activeKanbanColumn = id;
  }

  private ordersSub: Subscription | null = null;
  private branchSub: Subscription | null = null;
  private queryParamsSub: Subscription | null = null;

  constructor(
    private ordersService: OrdersService,
    private branchSelection: BranchSelectionService,
    public tableService: TableService,
    private auth: Auth,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log('[KITCHEN ORDERS] Inicializando componente de cocina...');

    this.branchSub = this.branchSelection.selectedBranchId$.subscribe(branchId => {
      console.log('[KITCHEN ORDERS] Branch seleccionada cambió:', branchId);
      this.currentBranchId = branchId;
      this.groupIntoColumns();
    });

    this.orders$ = this.ordersService.getOrders();
    this.ordersSub = this.orders$.subscribe({
      next: (orders) => {
        console.log('[KITCHEN ORDERS] Órdenes cargadas:', orders.length);
        this.orders = orders;
        this.groupIntoColumns();
        this.cdr.markForCheck();
      },
      error: (error) => console.error('[KITCHEN ORDERS] Error recibiendo órdenes:', error)
    });

    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      if (params['orderId']) {
        this.viewOrderId = params['orderId'];
        this.groupIntoColumns();
      }
    });
  }

  ngOnDestroy() {
    this.ordersSub?.unsubscribe();
    this.branchSub?.unsubscribe();
    this.queryParamsSub?.unsubscribe();
  }

  private groupIntoColumns() {
    try {
      for (const col of this.kanbanColumns) {
        col.orders = this.orders.filter(o =>
          o.status === col.id &&
          (!this.currentBranchId || o.branchId === this.currentBranchId)
        );
      }
    } catch (error) {
      console.error('[KITCHEN KANBAN] Error agrupando columnas:', error);
    }
  }

  toggleCard(orderId: string) {
    if (this.expandedCards.has(orderId)) {
      this.expandedCards.delete(orderId);
    } else {
      this.expandedCards.add(orderId);
    }
  }

  updateOrderStatus(orderId: string, newStatus: Order['status']) {
    if (!orderId) return;
    const validStatuses: Order['status'][] = ['confirmed', 'preparing', 'ready'];
    if (!validStatuses.includes(newStatus)) return;

    this.ordersService.updateOrderStatus(orderId, newStatus).then(() => {
      console.log('[KITCHEN ORDERS] Estado actualizado');
    }).catch(error => {
      console.error('[KITCHEN ORDERS] Error actualizando estado:', error);
    });
  }

  getStatusColor(status: Order['status']): string {
    const colors = {
      pending: '#ffc107',
      confirmed: '#17a2b8',
      preparing: '#fd7e14',
      ready: '#28a745',
      delivered: '#6f42c1',
      cancelled: '#dc3545'
    };
    return colors[status as keyof typeof colors] || '#6c757d';
  }

  getStatusLabel(status: Order['status']): string {
    const labels = {
      pending: 'Pendiente',
      confirmed: 'Confirmada',
      preparing: 'Preparando',
      ready: 'Lista',
      delivered: 'Entregada',
      cancelled: 'Cancelada'
    };
    return labels[status as keyof typeof labels] || status;
  }

  getTypeLabel(type: Order['type']): string {
    const labels = {
      dine_in: 'Comer aquí',
      takeout: 'Para llevar',
      delivery: 'Domicilio'
    };
    return labels[type as keyof typeof labels] || type;
  }

  getTypeClass(type: Order['type']): string {
    const classes: Record<string, string> = {
      dine_in: 'order-type-badge-dinein',
      takeout: 'order-type-badge-takeout',
      delivery: 'order-type-badge-delivery',
    };
    return classes[type] || 'order-type-badge-dinein';
  }

  getStatusBgColor(status: string): string {
    const colors: Record<string, string> = {
      pending: '#fff8e1',
      confirmed: '#e0f7fa',
      preparing: '#fff3e0',
      ready: '#e8f5e9'
    };
    return colors[status] || 'transparent';
  }

  getOrdersCount(status: Order['status']): number {
    return this.orders.filter(order => order.status === status).length;
  }

  /** Los recipientes para llevar se cobran, pero no se cocinan. */
  getCookableItems(order: Order): OrderItem[] {
    return order.items.filter(item => !item.isContainer);
  }

  getContainerItems(order: Order): OrderItem[] {
    return order.items.filter(item => item.isContainer);
  }

  isPriorityOrder(order: Order): boolean {
    return order.type === 'delivery' || this.getCookableItems(order).length > 5;
  }

  isUrgentOrder(order: Order): boolean {
    if (order.status === 'preparing') {
      const elapsed = Date.now() - new Date(order.updatedAt).getTime();
      return elapsed > 15 * 60 * 1000;
    }
    return false;
  }

  getElapsedTime(order: Order): string {
    if (order.status !== 'preparing') return '';
    const elapsed = Date.now() - new Date(order.updatedAt).getTime();
    const minutes = Math.floor(elapsed / (1000 * 60));
    return `${minutes}m`;
  }

  canConfirmOrder(order: Order): boolean {
    return false;
  }

  canStartPreparing(order: Order): boolean {
    return order.status === 'confirmed';
  }

  canMarkReady(order: Order): boolean {
    return order.status === 'preparing';
  }

  trackByOrderId(index: number, order: Order): string {
    return order.id;
  }
}
