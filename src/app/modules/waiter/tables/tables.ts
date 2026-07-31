import { Component, OnInit, HostListener, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TableService } from '../../../services/table';
import { OrdersService } from '../../../services/orders';
import { TableMergeService } from '../../../services/table-merge';
import { BranchSelectionService } from '../../../services/branch-selection';

import { Table } from '../../../models/table';
import { Order as OrderModel } from '../../../models/order';

@Component({
  selector: 'app-waiter-tables',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tables.html',
  styleUrl: './tables.css',
})
export class Tables implements OnInit {

  private _tables = signal<Table[]>([]);
  private _orders = signal<OrderModel[]>([]);

  searchTerm = signal('');
  selectedStatus = signal<string>('all');
  draggedTable: Table | null = null;
  selectedTable = signal<Table | null>(null);
  selectedOrder = signal<OrderModel | null>(null);

  currentBranchId: string = '';
  allTables: Table[] = [];
  private notifiedReadyIds = new Set<string>();

  // --- Merge Mode ---
  mergeMode = signal(false);
  selectedForMerge = signal<Set<string>>(new Set());

  constructor(
    private tableService: TableService,
    private ordersService: OrdersService,
    private tableMergeService: TableMergeService,
    private branchSelection: BranchSelectionService,
    private router: Router
  ) {}

  // --- Computed: family group virtual tables ---
  familyComposites = computed<Table[]>(() => {
    const tables = this._tables();
    const groups = new Map<string, Table[]>();

    tables.forEach(t => {
      if (t.familyGroupId) {
        const list = groups.get(t.familyGroupId) || [];
        list.push(t);
        groups.set(t.familyGroupId, list);
      }
    });

    return Array.from(groups.entries()).map(([groupId, children]) => {
      const first = children[0];
      const capacity = children.reduce((sum, c) => sum + (c.capacity || 4), 0);
      const names = children.map(c => c.name).join(' + ');
      return {
        id: 'fam_' + groupId,
        branchId: first.branchId,
        name: first.name,
        number: 0,
        status: 'family_merged',
        currentOrderId: first.currentOrderId,
        capacity,
        familyGroupId: groupId,
        permanentFamily: children.some(c => c.permanentFamily),
        occupiedTime: first.occupiedTime,
        createdAt: first.createdAt,
        updatedAt: first.updatedAt,
        _children: children,
        _displayName: 'Mesa Familiar · ' + names
      } as Table & { _children: Table[]; _displayName: string };
    });
  });

  // Computed: regular (non-family) tables
  regularTables = computed(() => {
    return this._tables().filter(t => !t.familyGroupId);
  });

  // Combined display: regular + family composites
  filteredTables = computed(() => {
    const search = this.searchTerm().toLowerCase();
    const status = this.selectedStatus();
    const regular = this.regularTables();
    const families = this.familyComposites();

    const all = [...regular, ...families];

    return all.filter(t => {
      const branchMatch = !this.currentBranchId || t.branchId === this.currentBranchId;
      const displayName = (t as any)._displayName || t.name;
      const numberStr = String(t.number);
      const matchesSearch = displayName.toLowerCase().includes(search) || numberStr.includes(search);
      const matchesStatus = status === 'all' || t.status === status;
      return branchMatch && matchesSearch && matchesStatus;
    });
  });

  activeOrders = computed(() => {
    return this._orders().filter(o => o.status === 'pending');
  });

  deliveredOrders = computed(() => {
    return this._orders().filter(o => o.status === 'delivered' && o.paymentStatus !== 'paid');
  });

  stats = computed(() => {
    const regular = this.regularTables()
      .filter(t => !this.currentBranchId || t.branchId === this.currentBranchId);
    const families = this.familyComposites()
      .filter(t => !this.currentBranchId || t.branchId === this.currentBranchId);
    return [
      { value: 'all',           label: 'Total',    count: regular.length,                                           icon: '🚀' },
      { value: 'occupied',      label: 'Ocupadas',  count: regular.filter(t => t.status === 'occupied').length,     icon: '🍔' },
      { value: 'available',     label: 'Libres',    count: regular.filter(t => t.status === 'available').length,    icon: '✅' },
      { value: 'family_merged', label: 'Familiares',count: families.length,                                         icon: '👨‍👩‍👧‍👦' },
    ];
  });

  ngOnInit() {
    this.branchSelection.selectedBranchId$.subscribe(branchId => {
      this.currentBranchId = branchId;
    });

    this.tableService.getTables().subscribe(tables => {
      this.allTables = tables;
      this._tables.set(tables);
    });
    this.ordersService.getOrders().subscribe(orders => {
      this._orders.set(orders);

      orders.forEach(order => {
        if (order.status === 'ready' && !this.notifiedReadyIds.has(order.id)) {
          this.notifiedReadyIds.add(order.id);
          this.notifyReadyOrder(order);
        }
      });
    });
  }

  getStatusIcon(status: string) {
    const map: any = {
      available: 'fas fa-check text-emerald-600',
      occupied: 'fas fa-utensils text-indigo-600',
      family_merged: 'fas fa-people-arrows text-amber-600',
      reserved: 'fas fa-calendar-check text-amber-600',
      maintenance: 'fas fa-tools text-rose-600'
    };
    return map[status] || 'fas fa-question';
  }

  getStatusBg(status: string) {
    const map: any = {
      available: 'bg-success bg-opacity-10',
      occupied: 'bg-primary bg-opacity-10',
      family_merged: 'bg-warning bg-opacity-10',
      reserved: 'bg-warning bg-opacity-10',
      maintenance: 'bg-danger bg-opacity-10'
    };
    return map[status] || 'bg-light';
  }

  getStatusBadgeClass(status: string) {
    const map: any = {
      available: 'bg-success-subtle text-success border border-success-subtle',
      occupied: 'bg-primary-subtle text-primary border border-primary-subtle',
      family_merged: 'bg-warning-subtle text-warning border border-warning-subtle',
      reserved: 'bg-warning-subtle text-warning border border-warning-subtle',
      maintenance: 'bg-danger-subtle text-danger border border-danger-subtle'
    };
    return map[status] || 'bg-secondary-subtle text-secondary border border-secondary-subtle';
  }

  getStatusLabel(status: string) {
    const labels: any = {
      available: 'Libre',
      occupied: 'Ocupada',
      family_merged: 'Mesa Familiar',
      reserved: 'Reservada',
      maintenance: 'Limpieza'
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

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      dine_in: 'Comer aquí',
      takeout: 'Para llevar',
    };
    return labels[type] || type;
  }

  getCurrentOrderForTable(table: Table) {
    const order = this.activeOrders().find(o => o.id === table.currentOrderId);
    if (order) return order;

    if (table.familyGroupId) {
      const children = this.getFamilyChildren(table);
      for (const child of children) {
        const childOrder = this.activeOrders().find(o => o.id === child.currentOrderId);
        if (childOrder) return childOrder;
      }
    }
    return null;
  }

  getTableNameByOrderId(orderId: string): string {
    const fc = this.familyComposites().find(f => f.currentOrderId === orderId);
    if (fc) {
      const names = this.getFamilyChildren(fc).map(c => c.name).join(' + ');
      return names || 'Familiar';
    }
    const t = this._tables().find(t => t.currentOrderId === orderId);
    if (t) return t.name;
    return '??';
  }

  formatTimeDiff(start: Date | undefined | null) {
    if (!start) return '';
    const diff = Math.floor((Date.now() - new Date(start).getTime()) / 60000);
    return diff < 60 ? `${diff}m` : `${Math.floor(diff/60)}h ${diff%60}m`;
  }

  private notifyReadyOrder(order: OrderModel) {
    const tableName = this._tables().find(t => t.currentOrderId === order.id)?.name || `Mesa ${order.tableId}`;
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('🍽️ Pedido Listo!', {
          body: `${tableName} — ${order.items.length} items listos para servir`,
          icon: '/favicon.ico',
          tag: `ready-${order.id}`
        });
      } catch {
        console.log('[NOTIFY] Pedido listo:', tableName);
      }
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  // --- Merge Mode ---
  toggleMergeMode() {
    this.mergeMode.set(!this.mergeMode());
    if (!this.mergeMode()) {
      this.selectedForMerge.set(new Set());
    }
  }

  toggleTableSelection(tableId: string) {
    this.selectedForMerge.update(set => {
      const newSet = new Set(set);
      if (newSet.has(tableId)) {
        newSet.delete(tableId);
      } else {
        newSet.add(tableId);
      }
      return newSet;
    });
  }

  isTableSelected(tableId: string): boolean {
    return this.selectedForMerge().has(tableId);
  }

  async confirmMerge() {
    const selected = Array.from(this.selectedForMerge());
    if (selected.length < 2) {
      return;
    }
    try {
      await this.tableMergeService.mergeTables(selected, this.currentBranchId);
      this.mergeMode.set(false);
      this.selectedForMerge.set(new Set());
    } catch (error) {
      console.error('Error merging tables:', error);
    }
  }

  cancelMerge() {
    this.mergeMode.set(false);
    this.selectedForMerge.set(new Set());
  }

  async separateTables(table: Table) {
    if (table.familyGroupId) {
      const children = this.getFamilyChildren(table);
      if (children.some(c => c.permanentFamily)) {
        alert('Esta mesa familiar es permanente. Solo el administrador puede separarla.');
        return;
      }
      try {
        await this.tableMergeService.unmergeTables(table.familyGroupId);
      } catch (error) {
        console.error('Error separating tables:', error);
      }
    }
  }

  getFamilyChildren(table: Table): Table[] {
    if (!table.familyGroupId) return [];
    return this._tables().filter(t => t.familyGroupId === table.familyGroupId);
  }

  getCombinedCapacity(table: Table): number {
    return this.getFamilyChildren(table).reduce((sum, c) => sum + (c.capacity || 4), 0);
  }

  getFamilyDisplayName(table: Table): string {
    if (!table.familyGroupId) return table.name;
    const names = this.getFamilyChildren(table).map(c => c.name).join(' + ');
    return 'Mesa Familiar · ' + names;
  }

  getFamilyTableNames(table: Table): string {
    return this.getFamilyChildren(table).map(c => c.name).join(', ');
  }

  // --- Navigation ---
  goToPayment(table: Table) {
    const order = this.getCurrentOrderForTable(table);
    if (order) {
      const tableId = table.familyGroupId
        ? 'fam_' + table.familyGroupId
        : String(table.number);
      this.router.navigateByUrl(
        `/waiter/payment?orderId=${order.id}&tableId=${tableId}`
      );
    }
  }

  onNewOrder(table?: Table) {
    let url = '/waiter/orders?create=true';
    if (table) {
      if (table.familyGroupId) {
        url += `&tableId=${table.familyGroupId}&family=true`;
      } else {
        url += `&tableId=${table.number}`;
      }
    }
    this.router.navigateByUrl(url);
  }

  viewOrder(param: OrderModel | Table) {
    let order: OrderModel | null = null;
    if ('name' in param && 'number' in param) {
      const table = param as Table;
      order = this.getCurrentOrderForTable(table);
    } else {
      order = param as OrderModel;
    }
    if (order) {
      this.selectedOrder.set(order);
    }
  }

  closeOrderModal() {
    this.selectedOrder.set(null);
  }

  async completeOrder(order: OrderModel) {
    try {
      await this.ordersService.updateOrderStatus(order.id, 'delivered');
      this.router.navigateByUrl(`/waiter/payment?orderId=${order.id}&tableId=${order.tableId}`);
    } catch (error) {
      console.error('Error completing order:', error);
    }
  }

  showActions(table: Table) {
    this.selectedTable.set(table);
  }

  closeTableModal() {
    this.selectedTable.set(null);
  }

  async updateTableStatus(status: string) {
    const table = this.selectedTable();
    if (table) {
      try {
        if (table.familyGroupId) {
          const children = this.getFamilyChildren(table);
          await Promise.all(children.map(c =>
            this.tableService.updateTable(c.id, { status: status as any })
          ));
        } else {
          await this.tableService.updateTable(table.id, { status: status as any });
        }
        this.closeTableModal();
      } catch (error) {
        console.error('Error updating table status:', error);
      }
    }
  }

  async freeTable() {
    const table = this.selectedTable();
    if (table) {
      try {
        if (table.familyGroupId) {
          const children = this.getFamilyChildren(table);
          const isPermanent = children.some(c => c.permanentFamily);

          if (isPermanent) {
            await Promise.all(children.map(c =>
              this.tableService.updateTable(c.id, {
                status: 'available',
                currentOrderId: null,
                occupiedTime: null
              })
            ));
          } else {
            await this.tableMergeService.completeFamilyOrder(table.familyGroupId, table.currentOrderId || '');
          }
        } else {
          await this.tableService.updateTable(table.id, { status: 'available', currentOrderId: null, occupiedTime: null });
        }
        this.closeTableModal();
      } catch (error) {
        console.error('Error freeing table:', error);
      }
    }
  }

  // --- Drag & Drop (for occupied individual tables) ---
  onDragStart(event: DragEvent, table: Table) {
    this.draggedTable = table;
    event.dataTransfer?.setData('text', table.id);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent, target: Table) {
    event.preventDefault();
    if (!this.draggedTable || this.draggedTable.id === target.id) return;

    const originId = this.draggedTable.id;
    const targetId = target.id;

    this._tables.update(prev => {
      const list = [...prev];
      const originIdx = list.findIndex(t => t.id === originId);
      const targetIdx = list.findIndex(t => t.id === targetId);

      const tempOrder = list[originIdx].currentOrderId;
      const tempTime = list[originIdx].occupiedTime;
      const tempStatus = list[originIdx].status;

      list[originIdx] = { ...list[originIdx], currentOrderId: list[targetIdx].currentOrderId, occupiedTime: list[targetIdx].occupiedTime, status: list[targetIdx].status };
      list[targetIdx] = { ...list[targetIdx], currentOrderId: tempOrder, occupiedTime: tempTime, status: tempStatus };

      return list;
    });

    this.draggedTable = null;
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'n') {
      event.preventDefault();
      this.onNewOrder();
    }
  }
}