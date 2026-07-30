import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../services/auth';
import { BranchService } from '../../services/branch';
import { BranchSelectionService } from '../../services/branch-selection';
import { Branch } from '../../models/branch';

export interface NavItem {
  icon: string;
  label: string;
  path: string;
}

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css'],
  imports: [RouterModule, CommonModule, FormsModule]
})
export class AdminLayoutComponent implements OnInit {
  branches: Branch[] = [];
  selectedBranchId: string = '';
  sidebarCollapsed: boolean = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  mobileMoreOpen: boolean = false;

  readonly navItems: NavItem[] = [
    { icon: 'fas fa-th-large', label: 'Dashboard', path: '/admin/dashboard' },
    { icon: 'fas fa-cash-register', label: 'Caja', path: '/admin/cash-register' },
    { icon: 'fas fa-utensils', label: 'Gestión del Menú', path: '/admin/menu-management' },
    { icon: 'fas fa-tags', label: 'Categorías', path: '/admin/menu-category-management' },
    { icon: 'fas fa-user-friends', label: 'Clientes', path: '/admin/customer-management' },
    { icon: 'fas fa-building', label: 'Sucursales', path: '/admin/branch-management' },
    { icon: 'fas fa-percent', label: 'Promociones', path: '/admin/promotion-management' },
    { icon: 'fas fa-chair', label: 'Mesas', path: '/admin/table-management' },
    { icon: 'fas fa-users', label: 'Usuarios', path: '/admin/user-management' },
    { icon: 'fas fa-bell', label: 'Notificaciones', path: '/admin/notification-management' },
  ];

  readonly navItemsSecondary: NavItem[] = [
    { icon: 'fas fa-history', label: 'Historial', path: '/admin/order-history' },
    { icon: 'fas fa-chart-line', label: 'Ventas', path: '/admin/ventas' },
    { icon: 'fas fa-file-invoice', label: 'Comprobantes', path: '/admin/invoices' },
    { icon: 'fas fa-building', label: 'Config. Empresa', path: '/admin/company-config' },
  ];

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(this.sidebarCollapsed));
  }

  /** Closes the sidebar only when it is rendered as an off-canvas drawer (tablet widths). */
  closeSidebar() {
    if (this.sidebarCollapsed) {
      return;
    }
    const isTabletDrawer = window.matchMedia('(min-width: 769px) and (max-width: 1024px)').matches;
    if (!isTabletDrawer) {
      return;
    }
    this.sidebarCollapsed = true;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
  }

  toggleMobileMore() {
    this.mobileMoreOpen = !this.mobileMoreOpen;
  }

  closeMobileMore() {
    this.mobileMoreOpen = false;
  }

  constructor(
    private auth: Auth,
    private router: Router,
    private branchService: BranchService,
    private branchSelection: BranchSelectionService
  ) {}

  ngOnInit() {
    if (this.auth.getUserRole() !== 'admin') {
      this.router.navigate(['/']);
      return;
    }
    this.selectedBranchId = this.branchSelection.getSelectedBranchId();
    this.branchService.getBranches().subscribe(branches => {
      this.branches = branches;
      this.branchSelection.setBranches(branches);
      this.branchSelection.initializeFromUserBranch(this.auth.getUserBranchId());
      this.selectedBranchId = this.branchSelection.getSelectedBranchId();
    });
  }

  onBranchChange() {
    this.branchSelection.selectBranch(this.selectedBranchId);
  }

  getCurrentUser() {
    return this.auth.getCurrentUser();
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  goToPublic() {
    this.router.navigate(['/']);
  }
}
