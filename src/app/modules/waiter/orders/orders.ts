import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { OrdersService } from '../../../services/orders';
import { TableService } from '../../../services/table';
import { BranchSelectionService } from '../../../services/branch-selection';
import { UserService } from '../../../services/user';
import { Order, OrderItem } from '../../../models/order';
import { NotificationService } from '../../../services/notification';
import { Notification } from '../../../models/notification';
import { Auth, UserRole } from '../../../services/auth';
import { MenuService } from '../../../services/menu';
import { MenuAvailabilityService } from '../../../services/menu-availability';
import { MenuItem } from '../../../models/menu-item';
import { MenuCategory } from '../../../models/menu-category';
import { Table } from '../../../models/table';

interface KanbanColumn {
  id: string;
  label: string;
  icon: string;
  color: string;
  orders: Order[];
}

@Component({
  selector: 'app-waiter-orders',
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class Orders implements OnInit, OnDestroy {
  orders$: Observable<Order[]> = new Observable<Order[]>();
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  selectedStatus: string = 'all';
  selectedPaymentFilter: string = 'all';
  selectedType: string = 'all';
  showCreateOrderForm: boolean = false;
  closingOrderForm: boolean = false;
  private readonly ORDER_FORM_CLOSE_ANIMATION_MS = 220;
  viewOrderId: string | null = null;
  toasts: { id: string; title: string; message: string }[] = [];
  private notificationSub: Subscription | null = null;
  private knownNotificationIds: Set<string> = new Set();
  private notifInitialized = false;
  isSubmitting: boolean = false;

  kanbanColumns: KanbanColumn[] = [
    { id: 'pending',    label: 'Pendientes',        icon: 'fa-clock',        color: '#f59e0b', orders: [] },
    { id: 'confirmed',  label: 'Confirmadas',       icon: 'fa-check-circle', color: '#06b6d4', orders: [] },
    { id: 'preparing',  label: 'En Preparación',    icon: 'fa-utensils',     color: '#3b82f6', orders: [] },
    { id: 'ready',      label: 'Listos para Servir',icon: 'fa-bell',         color: '#22c55e', orders: [] },
    { id: 'delivered',  label: 'Entregadas',        icon: 'fa-check-double', color: '#8b5cf6', orders: [] },
  ];

  expandedCards: Set<string> = new Set();

  /** Which kanban column is shown on the mobile single-column view. */
  activeKanbanColumn: string = 'pending';

  setActiveKanbanColumn(id: string) {
    this.activeKanbanColumn = id;
  }

  newOrder: Partial<Order> = {
    type: 'dine_in',
    tableId: '',
    status: 'pending'
  };
  orderItems: { menuItemId: string | null; name: string; qty: number; price: number; notes: string }[] = [];
  currentBranchId: string = '';
  branchTables: Table[] = [];
  familyTables: any[] = [];
  isFamilyTableId(id: string | null): boolean {
    return !!id && id.startsWith('fam_');
  }

  private tableDisplayNames = new Map<string, string>();

  getTableDisplayName(tableId: string | null): string {
    if (!tableId) return '';
    return this.tableDisplayNames.get(tableId) || '';
  }

  tableDropdownOpen = false;
  tableSearchTerm: string = '';

  get filteredBranchTables(): Table[] {
    if (!this.tableSearchTerm) return this.branchTables;
    const term = this.tableSearchTerm.toLowerCase();
    return this.branchTables.filter(t =>
      t.name.toLowerCase().includes(term) ||
      String(t.number).includes(term) ||
      String(t.capacity).includes(term)
    );
  }

  get filteredFamilyTables(): any[] {
    if (!this.tableSearchTerm) return this.familyTables;
    const term = this.tableSearchTerm.toLowerCase();
    return this.familyTables.filter(ft =>
      ft._displayName.toLowerCase().includes(term) ||
      ft.name.toLowerCase().includes(term) ||
      String(ft.capacity).includes(term)
    );
  }

  get hasAvailableTables(): boolean {
    return this.branchTables.length > 0 || this.familyTables.length > 0;
  }

  isTableSelected(tableNumber: number): boolean {
    return this.newOrder.tableId !== null && this.newOrder.tableId !== ''
      && String(this.newOrder.tableId) === String(tableNumber);
  }

  get selectedTableLabel(): string {
    if (!this.newOrder.tableId) return '';
    if (this.isFamilyTableId(this.newOrder.tableId)) {
      const ft = this.familyTables.find(f => f.id === this.newOrder.tableId);
      return ft ? ft._displayName : 'Mesa Familiar';
    }
    const t = this.branchTables.find(m => String(m.number) === String(this.newOrder.tableId));
    return t ? `${t.name} — ${t.capacity} pers.` : `Mesa ${this.newOrder.tableId}`;
  }

  toggleTableDropdown(event?: Event) {
    this.tableDropdownOpen = !this.tableDropdownOpen;
    if (this.tableDropdownOpen) {
      this.tableSearchTerm = '';
      this.scrollTriggerIntoView(event, 'start');
    }
  }

  /** Brings the dropdown's trigger near the top of the modal's scroll area so the
   *  panel that opens below it has room to render instead of being clipped. */
  private scrollTriggerIntoView(event: Event | undefined, block: ScrollLogicalPosition) {
    const target = event?.currentTarget as HTMLElement | undefined;
    if (!target) return;
    setTimeout(() => target.scrollIntoView({ block, behavior: 'smooth' }), 0);
  }

  selectTable(tableId: string) {
    this.newOrder.tableId = tableId;
    this.tableDropdownOpen = false;
    this.tableSearchTerm = '';
  }

  onTableDropdownBlur() {
    setTimeout(() => { this.tableDropdownOpen = false; this.tableSearchTerm = ''; }, 200);
  }

  getFamilyTableLabel(ft: any): string {
    return ft._displayName || ft.name + ' — ' + ft.capacity + ' pers.';
  }

  getPermanentFamilies(): any[] {
    return this.familyTables.filter(ft => ft.permanentFamily);
  }

  getTemporaryFamilies(): any[] {
    return this.familyTables.filter(ft => !ft.permanentFamily);
  }
  menuItems: MenuItem[] = [];
  menuCategories: MenuCategory[] = [];
  private rawMenuItems: MenuItem[] = [];
  filteredItemLists: MenuItem[][] = [];
  showDropdown: boolean[] = [];
  selectedCategoryId: string = '';
  statusOptions = [
    { value: 'all', label: 'Todas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'confirmed', label: 'Confirmadas' },
    { value: 'preparing', label: 'Preparando' },
    { value: 'ready', label: 'Listas' },
    { value: 'delivered', label: 'Entregadas' },
    { value: 'cancelled', label: 'Canceladas' }
  ];

  constructor(
    private ordersService: OrdersService,
    private tableService: TableService,
    private branchSelection: BranchSelectionService,
    private auth: Auth,
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private availabilityService: MenuAvailabilityService,
    private userService: UserService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    console.log('[WAITER ORDERS] Inicializando componente de órdenes...');

    this.branchSelection.selectedBranchId$.subscribe(branchId => {
      console.log('[WAITER ORDERS] Branch seleccionada cambió:', branchId);
      this.currentBranchId = branchId;
      this.loadBranchTables();
    });

    this.orders$ = this.ordersService.getOrders();  
    this.orders$.subscribe({
      next: (orders) => {
        console.log('[WAITER ORDERS] Órdenes cargadas:', orders.length);
        this.orders = orders;
        this.applyFilter();
        this.groupIntoColumns();
        this.cdr.markForCheck();
      },
      error: (error) => console.error('[WAITER ORDERS] Error recibiendo órdenes:', error)
    });

    this.route.queryParams.subscribe(params => {
      if (params['create'] === 'true') {
        this.showCreateOrderForm = true;
      }
      if (params['tableId']) {
        this.newOrder.tableId = params['tableId'];
      }
      if (params['orderId']) {
        this.viewOrderId = params['orderId'];
        this.applyFilter();
      }
    });

    this.loadMenuData();

    this.userService.getUsers().subscribe(users => {
      this.cachedUsers = users;
    });

    this.notificationSub = this.notificationService.getNotifications().subscribe(all => {
      const currentUserEmail = this.auth.getCurrentUser()?.email;
      const currentUserRole = this.auth.getUserRole();

      if (!this.notifInitialized) {
        all.forEach(n => this.knownNotificationIds.add(n.id));
        this.notifInitialized = true;
        return;
      }
      for (const n of all) {
        if (n.read) continue;
        if (currentUserEmail && n.readBy?.includes(currentUserEmail)) continue;
        const targetsMe = n.userId
          ? n.userId === currentUserEmail
          : (n.targetRole === null || (!!currentUserRole && !!n.targetRole?.includes(currentUserRole)));

        if (
          targetsMe &&
          (!n.branchId || n.branchId === this.currentBranchId) &&
          !this.knownNotificationIds.has(n.id)
        ) {
          this.knownNotificationIds.add(n.id);
          this.toasts.push({ id: n.id, title: n.title, message: n.message });
          setTimeout(() => {
            const idx = this.toasts.findIndex(t => t.id === n.id);
            if (idx >= 0) this.toasts.splice(idx, 1);
          }, 5000);
        }
      }
    });
  }

  ngOnDestroy() {
    this.notificationSub?.unsubscribe();
  }

  private loadBranchTables() {
    this.tableService.getTables().subscribe(tables => {
      const allBranch = tables.filter(t => !this.currentBranchId || t.branchId === this.currentBranchId);

      // Build display name map from ALL tables (including occupied)
      this.tableDisplayNames.clear();
      allBranch.filter(t => !t.familyGroupId).forEach(t => {
        this.tableDisplayNames.set(String(t.number), t.name);
      });
      const familyGroups = new Map<string, Table[]>();
      allBranch.filter(t => t.familyGroupId).forEach(t => {
        const gid = t.familyGroupId!;
        const list = familyGroups.get(gid) || [];
        list.push(t);
        familyGroups.set(gid, list);
      });
      familyGroups.forEach((children, groupId) => {
        const names = children.map(c => c.name).join(' + ');
        this.tableDisplayNames.set('fam_' + groupId, names);
      });

      this.branchTables = allBranch.filter(t =>
        !t.familyGroupId && (t.status === 'free' || t.status === 'available')
      );

      const groups = new Map<string, Table[]>();
      allBranch.forEach(t => {
        if (t.familyGroupId) {
          const list = groups.get(t.familyGroupId) || [];
          list.push(t);
          groups.set(t.familyGroupId, list);
        }
      });

      this.familyTables = Array.from(groups.entries())
        .filter(([, children]) => children.every(t =>
          t.status === 'free' || t.status === 'available' || t.status === 'family_merged'
        ))
        .map(([groupId, children]) => {
          const names = children.map(c => c.name).join(' + ');
          const capacity = children.reduce((sum, c) => sum + (c.capacity || 4), 0);
          const isPermanent = children.some(c => c.permanentFamily);
          return {
            ...children[0],
            id: 'fam_' + groupId,
            number: 0,
            name: 'Mesa Familiar',
            capacity,
            familyGroupId: groupId,
            permanentFamily: isPermanent,
            _displayName: 'Mesa Familiar: ' + names,
            _children: children
          } as Table & { _displayName: string; _children: Table[] };
        });
    });
  }

  private loadMenuData() {
    this.availabilityService.startClock();
    this.menuService.getMenuItems().subscribe(items => {
      this.rawMenuItems = items;
      this.applyMenuAvailabilityFilter();
    });
    this.menuService.getMenuCategories().subscribe(cats => {
      this.menuCategories = cats.filter(c => c.active);
      this.applyMenuAvailabilityFilter();
    });
    this.availabilityService.getPeriods().subscribe(() => this.applyMenuAvailabilityFilter());
    this.availabilityService.getSchedule().subscribe(() => this.applyMenuAvailabilityFilter());
    this.availabilityService.now$.subscribe(() => this.applyMenuAvailabilityFilter());
  }

  private applyMenuAvailabilityFilter() {
    this.menuItems = this.rawMenuItems.slice();
  }

  isItemCurrentlyAvailable(item: MenuItem): boolean {
    const category = this.menuCategories.find(c => c.id === item.categoryId);
    return this.availabilityService.isItemAvailable(item, category);
  }

  getItemPeriodLabel(item: MenuItem): string {
    const category = this.menuCategories.find(c => c.id === item.categoryId);
    return this.availabilityService.getItemPeriodLabel(item, category);
  }

  /**
   * Un mozo solo debe operar sus propias órdenes dine_in (evita que un mozo
   * confirme/entregue/marque un pedido que tomó otro). Las órdenes para llevar y
   * las que aún no tienen mozo asignado quedan en un pool compartido, igual que
   * ya asume el direccionamiento de notificaciones en OrdersService.updateOrderStatus.
   */
  private isOrderVisibleToWaiter(order: Order): boolean {
    if (order.type === 'takeout' || !order.waiterId) return true;
    return order.waiterId === this.auth.getCurrentUser()?.email;
  }

  applyFilter() {
    const userRole = this.auth.getUserRole();

    try {
      let filtered = this.orders.filter(order => {
        const roleMatch = userRole !== 'waiter' || this.isOrderVisibleToWaiter(order);

        const branchMatch = !this.currentBranchId || order.branchId === this.currentBranchId;
        const statusMatch = this.selectedStatus === 'all' || order.status === this.selectedStatus;
        const paymentMatch = this.selectedPaymentFilter === 'all' || order.paymentStatus === this.selectedPaymentFilter;
        const typeMatch = this.selectedType === 'all' || order.type === this.selectedType;

        return roleMatch && branchMatch && statusMatch && paymentMatch && typeMatch;
      });

      if (this.viewOrderId) {
        filtered = filtered.filter(order => order.id === this.viewOrderId);
      }

      this.filteredOrders = filtered.sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } catch (error) {
      console.error('[WAITER ORDERS] Error en applyFilter:', error);
    }
  }

  private groupIntoColumns() {
    const userRole = this.auth.getUserRole();
    try {
      for (const col of this.kanbanColumns) {
        col.orders = this.orders.filter(o =>
          o.status === col.id &&
          (col.id !== 'delivered' || o.paymentStatus !== 'paid') &&
          (!this.currentBranchId || o.branchId === this.currentBranchId) &&
          (userRole !== 'waiter' || this.isOrderVisibleToWaiter(o))
        );
      }
    } catch (error) {
      console.error('[KANBAN] Error agrupando columnas:', error);
    }
  }

  toggleCard(orderId: string) {
    if (this.expandedCards.has(orderId)) {
      this.expandedCards.delete(orderId);
    } else {
      this.expandedCards.add(orderId);
    }
  }

  getTypeClass(type: Order['type']): string {
    return type === 'dine_in' ? 'order-type-badge-dinein' : 'order-type-badge-takeout';
  }

  updateOrderStatus(orderId: string, newStatus: Order['status']) {
    if (!orderId) return;
    const validStatuses: Order['status'][] = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    if (!validStatuses.includes(newStatus)) return;

    const order = this.orders.find(o => o.id === orderId);
    if (newStatus === 'cancelled' && order && !['pending', 'confirmed'].includes(order.status)) return;

    this.ordersService.updateOrderStatus(orderId, newStatus).then(() => {
      console.log('[WAITER ORDERS] Estado actualizado');
    }).catch(error => {
      console.error('[WAITER ORDERS] Error actualizando estado:', error);
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
    const labels: Record<string, string> = {
      dine_in: 'Comer aquí',
      takeout: 'Para llevar',
    };
    return labels[type as keyof typeof labels] || type;
  }

  getOrdersCount(status: string): number {
    // Debe reflejar exactamente lo que se ve en el tablero Kanban (ver groupIntoColumns):
    // misma sucursal, y solo se cierra (sale del tablero) cuando ya fue entregado Y pagado.
    // Los pedidos públicos se pagan por adelantado, así que "pagado" por sí solo no implica que estén resueltos.
    const userRole = this.auth.getUserRole();
    if (status === 'paid') {
      return this.orders.filter(order =>
        order.paymentStatus === 'paid' &&
        (!this.currentBranchId || order.branchId === this.currentBranchId) &&
        (userRole !== 'waiter' || this.isOrderVisibleToWaiter(order))
      ).length;
    }
    return this.orders.filter(order =>
      order.status === status &&
      (status !== 'delivered' || order.paymentStatus !== 'paid') &&
      (!this.currentBranchId || order.branchId === this.currentBranchId) &&
      (userRole !== 'waiter' || this.isOrderVisibleToWaiter(order))
    ).length;
  }

  getStatusBgColor(status: string): string {
    const colors: Record<string, string> = {
      pending: '#fff8e1',
      confirmed: '#e0f7fa',
      preparing: '#e3f2fd',
      ready: '#e8f5e9',
      delivered: '#f3e8ff',
      paid: '#e6f7e6'
    };
    return colors[status] || 'transparent';
  }

  setFilterStatus(status: string) {
    try {
      this.selectedPaymentFilter = 'all';
      this.selectedStatus = this.selectedStatus === status ? 'all' : status;
      this.applyFilter();
    } catch (error) {
      console.error('[WAITER ORDERS] Error al filtrar por estado:', error);
    }
  }

  setFilterPayment(status: string) {
    try {
      this.selectedStatus = 'all';
      this.selectedPaymentFilter = this.selectedPaymentFilter === status ? 'all' : status;
      this.applyFilter();
    } catch (error) {
      console.error('[WAITER ORDERS] Error al filtrar por pago:', error);
    }
  }

  isPriorityOrder(order: Order): boolean {
    return order.items.length > 5;
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

  getPaymentMethodLabel(method: string): string {
    const labels = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      yape: 'Yape',
      transfer: 'Transferencia'
    };
    return labels[method as keyof typeof labels] || method;
  }

  getPaymentStatusLabel(status: string): string {
    const labels = {
      pending: 'Pendiente',
      paid: 'Pagado',
      refunded: 'Reembolsado'
    };
    return labels[status as keyof typeof labels] || status;
  }

  private canActOnOrder(order: Order): boolean {
    return this.auth.getUserRole() !== 'waiter' || this.isOrderVisibleToWaiter(order);
  }

  canConfirmOrder(order: Order): boolean {
    return order.status === 'pending' && this.canActOnOrder(order);
  }

  canStartPreparing(order: Order): boolean {
    return false;
  }

  canMarkReady(order: Order): boolean {
    return false;
  }

  canDeliver(order: Order): boolean {
    return order.status === 'ready' && this.canActOnOrder(order);
  }

  canPayOrder(order: Order): boolean {
    return (order.status === 'ready' || order.status === 'delivered')
      && order.paymentStatus !== 'paid'
      && this.canActOnOrder(order);
  }

  goToPayment(order: Order) {
    const tableId = order.tableId || '';
    this.router.navigate(['/waiter/payment'], {
      queryParams: { orderId: order.id, tableId }
    });
  }

  toggleOrderForm() {
    if (this.showCreateOrderForm) {
      this.closeOrderForm();
    } else {
      this.showCreateOrderForm = true;
    }
  }

  /** Plays the collapse animation, then hides the form (and optionally resets it) once it's done. */
  closeOrderForm(afterClose?: () => void) {
    this.closingOrderForm = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showCreateOrderForm = false;
      this.closingOrderForm = false;
      afterClose?.();
      this.cdr.detectChanges();
    }, this.ORDER_FORM_CLOSE_ANIMATION_MS);
  }

  addItem() {
    this.orderItems.push({ menuItemId: null, name: '', qty: 1, price: 0, notes: '' });
    this.filteredItemLists.push([]);
    this.showDropdown.push(false);
  }

  removeItem(index: number) {
    this.orderItems.splice(index, 1);
    this.filteredItemLists.splice(index, 1);
    this.showDropdown.splice(index, 1);
  }

  onCategoryChange() {
    this.hideAllDropdowns();
  }

  onItemSearch(index: number, event: Event) {
    const term = (event.target as HTMLInputElement).value.toLowerCase().trim();
    this.orderItems[index].name = term;

    if (!term) {
      this.filteredItemLists[index] = [];
      this.showDropdown[index] = false;
      return;
    }

    let filtered = this.menuItems.filter(mi => {
      const matchesSearch = mi.name.toLowerCase().includes(term);
      const matchesCategory = !this.selectedCategoryId || mi.categoryId === this.selectedCategoryId;
      return matchesSearch && matchesCategory;
    });

    this.filteredItemLists[index] = filtered.slice(0, 20);
    this.showDropdown[index] = this.filteredItemLists[index].length > 0;
  }

  selectItem(index: number, menuItem: MenuItem) {
    if (!this.isItemCurrentlyAvailable(menuItem)) {
      return;
    }
    this.orderItems[index].menuItemId = menuItem.id;
    this.orderItems[index].name = menuItem.name;
    this.orderItems[index].price = menuItem.price;
    this.showDropdown[index] = false;
  }

  getCategoryName(categoryId: string): string {
    const cat = this.menuCategories.find(c => c.id === categoryId);
    return cat?.name || '';
  }

  showItemDropdown(index: number, event?: Event) {
    const term = (this.orderItems[index].name || '').toLowerCase().trim();
    let filtered = this.menuItems.filter(mi => {
      const matchesSearch = !term || mi.name.toLowerCase().includes(term);
      const matchesCategory = !this.selectedCategoryId || mi.categoryId === this.selectedCategoryId;
      return matchesSearch && matchesCategory;
    });
    this.filteredItemLists[index] = filtered.slice(0, 20);
    this.showDropdown[index] = this.filteredItemLists[index].length > 0;
    if (this.showDropdown[index]) {
      this.scrollTriggerIntoView(event, 'center');
    }
  }

  onBlur(index: number) {
    setTimeout(() => this.showDropdown[index] = false, 200);
  }

  private hideAllDropdowns() {
    this.showDropdown = this.showDropdown.map(() => false);
  }

  calculateTotal(): number {
    return this.orderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }

  private getWaiterDisplayName(): string {
    try {
      const currentUser = this.auth.getCurrentUser();
      if (!currentUser?.email) return '';

      const users = this.cachedUsers;
      const found = users.find(u => u.email === currentUser.email);
      if (found) {
        const name = [found.firstName, found.lastName].filter(Boolean).join(' ');
        if (name) return name;
      }
      return currentUser.email || '';
    } catch {
      return this.auth.getCurrentUser()?.email || '';
    }
  }

  private cachedUsers: import('../../../models/user').AppUser[] = [];

  async createOrder() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    console.log('[WAITER ORDERS] ===== CREAR ORDEN INICIADO =====');
    console.log('[WAITER ORDERS] orderItems.length:', this.orderItems.length);
    console.log('[WAITER ORDERS] currentBranchId:', this.currentBranchId);
    console.log('[WAITER ORDERS] newOrder:', JSON.stringify(this.newOrder));
    console.log('[WAITER ORDERS] ¿Usuario logueado?', this.auth.isLoggedIn());
    console.log('[WAITER ORDERS] Rol del usuario:', this.auth.getUserRole());

    if (this.orderItems.length === 0) {
      console.warn('[WAITER ORDERS] Validación fallida: No hay items');
      this.isSubmitting = false;
      return;
    }

    if (!this.currentBranchId) {
      console.error('[WAITER ORDERS] Validación fallida: No hay branch seleccionada');
      this.isSubmitting = false;
      return;
    }

    if (this.newOrder.type === 'dine_in' && !this.newOrder.tableId) {
      console.error('[WAITER ORDERS] Validación fallida: debe seleccionar una mesa para pedidos dine_in');
      this.isSubmitting = false;
      return;
    }

    const invalidItems = this.orderItems.filter(
      item => !item.name || item.name.trim() === '' || item.qty < 1 || item.price <= 0
    );
    if (invalidItems.length > 0) {
      console.warn('[WAITER ORDERS] Validación fallida: Items inválidos:', invalidItems);
      this.isSubmitting = false;
      return;
    }

    const items: OrderItem[] = this.orderItems.map(item => ({
      itemId: item.menuItemId || item.name.toLowerCase().replace(/\s+/g, '-'),
      name: item.name,
      price: item.price,
      qty: item.qty,
      modifiers: [],
      notes: item.notes
    }));
    console.log('[WAITER ORDERS] Items mapeados:', JSON.stringify(items));

    const subtotal = this.calculateTotal();
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    const tableId = this.newOrder.tableId ? String(this.newOrder.tableId) : null;
    const tableName = tableId ? this.selectedTableLabel : undefined;

    const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
      branchId: this.currentBranchId,
      tableId,
      tableName,
      customerId: null,
      waiterId: this.auth.getCurrentUser()?.email || '',
      waiterName: this.getWaiterDisplayName(),
      type: this.newOrder.type as string,
      status: 'pending',
      items: items,
      subtotal: subtotal,
      tax: tax,
      total: total,
      paymentMethod: 'cash',
      paymentStatus: 'pending'
    };
    console.log('[WAITER ORDERS] orderData a enviar:', JSON.stringify(orderData));

    try {
      console.log('[WAITER ORDERS] Llamando a ordersService.createOrder...');
      const result = await this.ordersService.createOrder(orderData);
      const orderId = result.id;
      console.log('[WAITER ORDERS] Orden creada exitosamente ID:', orderId, '| orderNumber:', result.orderNumber);

      if (orderData.tableId) {
        console.log('[WAITER ORDERS] Cargando mesas para asignar orden a mesa:', orderData.tableId);
        const tables = await this.tableService.getLoadedTables();
        console.log('[WAITER ORDERS] Mesas cargadas:', tables.length);

        if (this.isFamilyTableId(orderData.tableId)) {
          const familyTables = tables.filter(t => t.familyGroupId === orderData.tableId);
          console.log('[WAITER ORDERS] Actualizando', familyTables.length, 'mesas familiares...');
          await Promise.all(familyTables.map(t =>
            this.tableService.updateTable(t.id, {
              status: 'occupied',
              currentOrderId: orderId,
              occupiedTime: new Date()
            })
          ));
          console.log('[WAITER ORDERS] Mesas familiares actualizadas');
        } else {
          const table = tables.find(t => String(t.number) === String(orderData.tableId));
          if (table) {
            console.log('[WAITER ORDERS] Actualizando mesa:', table.name, '(id:', table.id, ')');
            await this.tableService.updateTable(table.id, {
              status: 'occupied',
              currentOrderId: orderId,
              occupiedTime: new Date()
            });
            console.log('[WAITER ORDERS] Mesa actualizada a occupied');
          } else {
            console.warn('[WAITER ORDERS] Mesa no encontrada para tableId:', orderData.tableId, '| mesas disponibles:', tables.map(t => t.number.toString() + '-' + t.name).join(', '));
          }
        }
      } else {
        console.log('[WAITER ORDERS] Pedido sin mesa (takeout), se omite actualización de mesa');
      }

      this.closeOrderForm(() => {
        this.newOrder = { type: 'dine_in', tableId: '', status: 'pending' };
        this.orderItems = [];
        this.filteredItemLists = [];
        this.showDropdown = [];
        this.selectedCategoryId = '';
      });
      console.log('[WAITER ORDERS] Formulario limpiado y cerrado');
    } catch (error) {
      console.error('[WAITER ORDERS] Error capturado en createOrder:', error);
    } finally {
      console.log('[WAITER ORDERS] FINALLY - isSubmitting será false');
      this.isSubmitting = false;
      this.cdr.detectChanges();
      console.log('[WAITER ORDERS] FINALLY - isSubmitting =', this.isSubmitting);
    }
    console.log('[WAITER ORDERS] ===== CREAR ORDEN FINALIZADO =====');
  }

  trackByOrderId(index: number, order: Order): string {
    return order.id;
  }
}
