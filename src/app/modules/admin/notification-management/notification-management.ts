import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationService } from '../../../services/notification';
import { Notification } from '../../../models/notification';
import { BranchService } from '../../../services/branch';
import { Branch } from '../../../models/branch';
import { NotificationTypeService } from '../../../services/notification-type';
import { NotificationType } from '../../../models/notification-type';

@Component({
  selector: 'app-notification-management',
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-management.html',
  styleUrl: './notification-management.css',
})
export class NotificationManagement implements OnInit {
  notifications$: Observable<Notification[]> = new Observable<Notification[]>();
  searchTerm: string = '';
  searchTerm$ = new BehaviorSubject<string>('');
  filterTargetRole$ = new BehaviorSubject<string>('all');
  filterReadStatus$ = new BehaviorSubject<string>('all');
  filterType$ = new BehaviorSubject<string>('all');
  filteredNotifications$: Observable<Notification[]>;
  showAddForm: boolean = false;
  editingNotification: Notification | null = null;

  targetRoles: { value: string; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'cook', label: 'Cocineros' },
    { value: 'waiter', label: 'Mozos' },
    { value: 'user', label: 'Clientes' }
  ];

  roleFilterOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Todos los roles' },
    { value: 'admin', label: 'Admin' },
    { value: 'cook', label: 'Cocineros' },
    { value: 'waiter', label: 'Mozos' },
    { value: 'user', label: 'Clientes' },
    { value: 'general', label: 'General (sin rol)' }
  ];

  readFilterOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'unread', label: 'Abiertas' },
    { value: 'read', label: 'Cerradas para todos' }
  ];

  branches: Branch[] = [];

  // Notification types are a managed CRUD (collection "notification_types"),
  // not a hardcoded list — this keeps them in sync everywhere they're used
  // (filter dropdown, the create/edit form, and the badge on each card).
  notificationTypes: NotificationType[] = [];

  get typeFilterOptions(): { value: string; label: string }[] {
    return [
      { value: 'all', label: 'Todos los tipos' },
      ...this.notificationTypes.map(t => ({ value: t.value, label: t.label }))
    ];
  }

  showTypeManager: boolean = false;
  editingType: NotificationType | null = null;
  newType: { value: string; label: string; color: string; icon: string } = this.emptyType();
  // Tracks whether the user has hand-edited the identifier field, so we stop
  // auto-generating it from the display name once they've customized it.
  private typeValueTouched = false;

  private emptyType() {
    return { value: '', label: '', color: '#22d3ee', icon: 'fa-bell' };
  }

  private slugify(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  onTypeLabelChange(): void {
    if (!this.editingType && !this.typeValueTouched) {
      this.newType.value = this.slugify(this.newType.label);
    }
  }

  onTypeValueChange(): void {
    this.typeValueTouched = true;
  }

  formErrors: Record<string, string> = {};

  // Form data
  newNotification: any = {
    targetRole: null as string[] | null,
    branchId: '',
    type: '',
    title: '',
    message: '',
    read: false
  };

  constructor(
    private notificationService: NotificationService,
    private branchService: BranchService,
    private notificationTypeService: NotificationTypeService
  ) {
    this.notifications$ = this.notificationService.getNotifications();
    this.filteredNotifications$ = combineLatest([
      this.notifications$,
      this.searchTerm$,
      this.filterTargetRole$,
      this.filterReadStatus$,
      this.filterType$
    ]).pipe(
      map(([notifications, term, targetRole, readStatus, type]) =>
        notifications.filter(n => {
          // This screen is for notifications the admin composes and sends to others
          // (info/warning/error/success), not the system's own operational alerts
          // (e.g. "order_ready", which the kitchen/orders flow sends straight to
          // waiters — an admin managing/editing/deleting those makes no sense here).
          if (n.type === 'order_ready') return false;
          if (term && !n.title.toLowerCase().includes(term.toLowerCase()) &&
              !n.message.toLowerCase().includes(term.toLowerCase()) &&
              !n.type.toLowerCase().includes(term.toLowerCase())) {
            return false;
          }
          if (targetRole === 'admin' && (!n.targetRole || !n.targetRole.includes('admin'))) {
            return false;
          }
          if (targetRole === 'general' && n.targetRole !== null) {
            return false;
          }
          if (targetRole !== 'all' && targetRole !== 'admin' && targetRole !== 'general') {
            if (!n.targetRole || !n.targetRole.includes(targetRole)) {
              return false;
            }
          }
          if (readStatus === 'unread' && n.read) return false;
          if (readStatus === 'read' && !n.read) return false;
          if (type !== 'all' && n.type !== type) return false;
          return true;
        })
      )
    );
  }

  ngOnInit() {
    this.branchService.getBranches().subscribe(branches => {
      this.branches = branches;
    });
    this.notificationTypeService.getTypes().subscribe(types => {
      this.notificationTypes = types;
      if (!this.newNotification.type && types.length > 0) {
        this.newNotification.type = types[0].value;
      }
    });
  }

  onSearch() {
    this.searchTerm$.next(this.searchTerm);
  }

  setFilterTargetRole(value: string) {
    this.filterTargetRole$.next(value);
  }

  setFilterReadStatus(value: string) {
    this.filterReadStatus$.next(value);
  }

  setFilterType(value: string) {
    this.filterType$.next(value);
  }

  addNewNotification() {
    this.showAddForm = true;
    this.editingNotification = null;
    this.resetForm();
  }

  editNotification(notification: Notification) {
    this.showAddForm = true;
    this.editingNotification = notification;
    this.newNotification = {
      targetRole: notification.targetRole ? [...notification.targetRole] : null,
      branchId: notification.branchId || '',
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read
    };
  }

  isRoleSelected(role: string): boolean {
    return this.newNotification.targetRole !== null &&
      Array.isArray(this.newNotification.targetRole) &&
      this.newNotification.targetRole.includes(role);
  }

  isGeneral(): boolean {
    return this.newNotification.targetRole === null;
  }

  setGeneralNotification() {
    this.newNotification.targetRole = null;
  }

  toggleRole(role: string) {
    if (this.newNotification.targetRole === null) {
      this.newNotification.targetRole = [role];
      return;
    }
    const idx = this.newNotification.targetRole.indexOf(role);
    if (idx >= 0) {
      this.newNotification.targetRole.splice(idx, 1);
      if (this.newNotification.targetRole.length === 0) {
        this.newNotification.targetRole = null;
      }
    } else {
      this.newNotification.targetRole.push(role);
    }
  }

  async saveNotification() {
    this.formErrors = {};

    if (!this.newNotification.type) {
      this.formErrors['type'] = 'El tipo es obligatorio';
    }
    if (!this.newNotification.title?.trim()) {
      this.formErrors['title'] = 'El título es obligatorio';
    }
    if (!this.newNotification.message?.trim()) {
      this.formErrors['message'] = 'El mensaje es obligatorio';
    }

    if (Object.keys(this.formErrors).length > 0) {
      return;
    }

    try {
      if (this.editingNotification) {
        await this.notificationService.updateNotification(this.editingNotification.id, {
          targetRole: this.newNotification.targetRole,
          branchId: this.newNotification.branchId || null,
          type: this.newNotification.type,
          title: this.newNotification.title,
          message: this.newNotification.message,
          read: this.newNotification.read
        });
        this.cancelEdit();
      } else {
        const notificationToAdd: Omit<Notification, 'id' | 'createdAt'> = {
          userId: null,
          targetRole: this.newNotification.targetRole,
          branchId: this.newNotification.branchId || null,
          type: this.newNotification.type || 'info',
          title: this.newNotification.title || '',
          message: this.newNotification.message || '',
          read: this.newNotification.read || false,
          readBy: []
        };
        await this.notificationService.createNotification(notificationToAdd);
        this.cancelEdit();
      }
    } catch (error) {
      console.error('Error saving notification:', error);
      alert('Error al guardar la notificación. Por favor, inténtalo de nuevo.');
    }
  }

  async deleteNotification(notification: Notification) {
    if (confirm(`¿Estás seguro de que quieres eliminar la notificación "${notification.title}"?`)) {
      try {
        await this.notificationService.deleteNotification(notification.id);
        console.log('Notification deleted');
      } catch (error) {
        console.error('Error deleting notification:', error);
        alert('Error al eliminar la notificación. Por favor, inténtalo de nuevo.');
      }
    }
  }

  openTypeManager() {
    this.showTypeManager = true;
  }

  closeTypeManager() {
    this.showTypeManager = false;
    this.cancelTypeEdit();
  }

  editType(type: NotificationType) {
    this.editingType = type;
    this.typeValueTouched = true;
    this.newType = {
      value: type.value,
      label: type.label,
      color: type.color,
      icon: type.icon
    };
  }

  cancelTypeEdit() {
    this.editingType = null;
    this.typeValueTouched = false;
    this.newType = this.emptyType();
  }

  async saveType() {
    const value = this.slugify(this.newType.value);
    const label = this.newType.label.trim();
    if (!value || !label) return;

    try {
      if (this.editingType) {
        await this.notificationTypeService.updateType(this.editingType.id, {
          value,
          label,
          color: this.newType.color,
          icon: this.newType.icon
        });
      } else {
        await this.notificationTypeService.createType({
          value,
          label,
          color: this.newType.color,
          icon: this.newType.icon
        });
      }
      this.cancelTypeEdit();
    } catch (error) {
      console.error('Error saving notification type:', error);
      alert('Error al guardar el tipo de notificación. Por favor, inténtalo de nuevo.');
    }
  }

  async deleteType(type: NotificationType) {
    if (confirm(`¿Estás seguro de que quieres eliminar el tipo "${type.label}"?`)) {
      try {
        await this.notificationTypeService.deleteType(type.id);
      } catch (error) {
        console.error('Error deleting notification type:', error);
        alert('Error al eliminar el tipo de notificación. Por favor, inténtalo de nuevo.');
      }
    }
  }

  getTypeLabel(value: string): string {
    return this.notificationTypes.find(t => t.value === value)?.label || value;
  }

  getTypeBadgeStyle(value: string): { [key: string]: string } {
    const color = this.notificationTypes.find(t => t.value === value)?.color;
    if (!color) return {};
    return {
      color,
      'border-color': color,
      background: color + '26'
    };
  }

  async toggleReadStatus(notification: Notification) {
    try {
      if (notification.read) {
        await this.notificationService.markAsUnread(notification.id);
      } else {
        await this.notificationService.markAsRead(notification.id);
      }
    } catch (error) {
      console.error('Error toggling read status:', error);
      alert('Error al cambiar el estado de lectura.');
    }
  }

  cancelEdit() {
    this.showAddForm = false;
    this.editingNotification = null;
    this.resetForm();
  }

  private resetForm() {
    this.newNotification = {
      targetRole: null,
      branchId: '',
      type: this.notificationTypes[0]?.value || '',
      title: '',
      message: '',
      read: false
    };
    this.formErrors = {};
  }

  getBranchName(branchId: string | null): string {
    if (!branchId) return 'Todas las sucursales';
    const branch = this.branches.find(b => b.id === branchId);
    return branch ? branch.name : branchId;
  }

  getTargetRoleLabels(roles: string[] | null): string {
    if (!roles) return 'General (todos)';
    return roles.map(r => {
      const found = this.targetRoles.find(t => t.value === r);
      return found ? found.label : r;
    }).join(', ');
  }
}
