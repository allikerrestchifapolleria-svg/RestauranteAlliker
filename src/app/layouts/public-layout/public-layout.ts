import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { Auth } from '../../services/auth';
import { CartService } from '../../services/cart';
import { CartSidebarService } from '../../shared/components/cart-sidebar/cart-sidebar.service';
import { CartSidebarComponent } from '../../shared/components/cart-sidebar/cart-sidebar';
import { CompanyService } from '../../services/company.service';
import { CompanyData } from '../../models/invoice';
import { NotificationService } from '../../services/notification';
import { Notification } from '../../models/notification';

@Component({
  selector: 'app-public-layout',
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.css',
  imports: [CommonModule, RouterModule, CartSidebarComponent]
})
export class PublicLayoutComponent implements OnInit, OnDestroy {
  isScrolled: boolean = false;
  companyData!: CompanyData;
  currentYear: number = new Date().getFullYear();
  unreadNotifications: number = 0;
  showNotifications: boolean = false;
  notifications: Notification[] = [];
  private notifSub: Subscription | null = null;

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  get isAdmin(): boolean {
    return this.auth.getUserRole() === 'admin';
  }

  get isCook(): boolean {
    return this.auth.getUserRole() === 'cook';
  }

  get isWaiter(): boolean {
    return this.auth.getUserRole() === 'waiter';
  }

  get isCustomer(): boolean {
    return this.auth.getUserRole() === 'user';
  }

  get roleLabel(): string {
    const role = this.auth.getUserRole();
    switch (role) {
      case 'admin': return 'Admin';
      case 'cook': return 'Cocina';
      case 'waiter': return 'Mesas';
      case 'user': return 'Cliente';
      default: return '';
    }
  }

  get userEmail(): string {
    return this.auth.getCurrentUser()?.email || '';
  }

  get cartItemCount(): number {
    return this.cartService.getCartItemCount();
  }

  constructor(
    private auth: Auth,
    private router: Router,
    private cartService: CartService,
    private cartSidebarService: CartSidebarService,
    private companyService: CompanyService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {
    this.companyData = this.companyService.getDefaultCompany();
  }

  ngOnInit() {
    this.loadCompanyData();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const navbarCollapse = document.getElementById('navbarNav');
        if (navbarCollapse && navbarCollapse.classList.contains('show')) {
          navbarCollapse.classList.remove('show');
        }
      });

    // Only regular customers get a bell here — staff previewing the public
    // site already have their own notification bell in their own layout.
    if (this.isCustomer) {
      const currentUser = this.auth.getCurrentUser();
      this.notifSub = this.notificationService.getNotifications().subscribe(all => {
        const filtered = all.filter(n => {
          if (n.read) return false; // admin closed it for everyone
          if (currentUser?.email && n.readBy?.includes(currentUser.email)) return false; // I already read it
          return n.userId
            ? n.userId === currentUser?.email
            : (n.targetRole === null || !!n.targetRole?.includes('user'));
        });
        setTimeout(() => {
          this.unreadNotifications = filtered.length;
          this.notifications = filtered.slice(0, 10);
        });
      });
    }
  }

  ngOnDestroy() {
    this.notifSub?.unsubscribe();
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
  }

  async markNotificationAsRead(notif: Notification) {
    if (!this.userEmail) return;
    await this.notificationService.markReadByUser(notif.id, this.userEmail);
  }

  async markAllNotificationsAsRead() {
    const unreadIds = this.notifications.map(n => n.id);
    if (unreadIds.length === 0 || !this.userEmail) return;
    await this.notificationService.markMultipleReadByUser(unreadIds, this.userEmail);
    this.showNotifications = false;
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  private async loadCompanyData() {
    try {
      const data = await this.companyService.getCompanyOnce();
      this.companyData = data;
      this.cdr.markForCheck();
    } catch (err) {
      console.error('[PUBLIC-LAYOUT] Error cargando datos del negocio:', err);
    }
  }

  getAddress(): string {
    if (!this.companyData?.address) return 'Av. Juan Velasco S/N - C.P. Chao, Chao, Virú - La Libertad';
    const a = this.companyData.address;
    return a.street + ', ' + a.district + ', ' + a.province + ' - ' + a.department;
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  openCartSidebar() {
    this.cartSidebarService.open();
    this.closeNavbar();
  }

  closeNavbar() {
    const navbarCollapse = document.getElementById('navbarNav');
    if (navbarCollapse?.classList.contains('show')) {
      navbarCollapse.classList.remove('show');
    }
  }

  goToAdmin() {
    this.router.navigate(['/admin/dashboard']);
  }

  goToKitchen() {
    this.router.navigate(['/kitchen']);
  }

  goToWaiter() {
    this.router.navigate(['/waiter']);
  }
}