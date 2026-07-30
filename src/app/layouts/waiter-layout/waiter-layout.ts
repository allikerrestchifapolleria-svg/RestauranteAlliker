import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Auth } from '../../services/auth';
import { BranchService } from '../../services/branch';
import { BranchSelectionService } from '../../services/branch-selection';
import { NotificationService } from '../../services/notification';
import { Branch } from '../../models/branch';
import { Notification } from '../../models/notification';

@Component({
  selector: 'app-waiter-layout',
  templateUrl: './waiter-layout.html',
  styleUrl: './waiter-layout.css',
  imports: [RouterModule, CommonModule]
})
export class WaiterLayoutComponent implements OnInit, OnDestroy {
  branches: Branch[] = [];
  unreadNotifications: number = 0;
  showNotifications: boolean = false;
  notifications: Notification[] = [];
  private notifSub: Subscription | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private auth: Auth,
    private router: Router,
    private branchService: BranchService,
    public branchSelection: BranchSelectionService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    if (this.auth.getUserRole() !== 'waiter') {
      this.router.navigate(['/']);
      return;
    }
    this.branchService.getBranches().subscribe(branches => {
      this.branches = branches;
      this.branchSelection.setBranches(branches);
      this.branchSelection.initializeFromUserBranch(this.auth.getUserBranchId());
      this.cdr.detectChanges();
      if (!this.branchSelection.getSelectedBranchId()) {
        this.router.navigate(['/no-branch']);
      }
    });

    const currentUser = this.auth.getCurrentUser();
    const currentUserRole = this.auth.getUserRole();

    this.notifSub = this.notificationService.getNotifications().subscribe(all => {
      const branchId = this.branchSelection.getSelectedBranchId();
      const filtered = all.filter(n => {
        if (n.read) return false; // admin closed it for everyone
        if (currentUser?.email && n.readBy?.includes(currentUser.email)) return false; // I already read it

        // Targeted at me specifically, or at "general" (no targetRole = everyone),
        // or at my role — this covers both system alerts (order_ready) and the
        // admin's own broadcasts from Gestión de Notificaciones.
        const targetsMe = n.userId
          ? n.userId === currentUser?.email
          : (n.targetRole === null || (!!currentUserRole && !!n.targetRole?.includes(currentUserRole)));

        return targetsMe && (!n.branchId || n.branchId === branchId);
      });
      setTimeout(() => {
        this.unreadNotifications = filtered.length;
        this.notifications = filtered.slice(0, 10);
      });
    });
  }

  ngOnDestroy() {
    this.notifSub?.unsubscribe();
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
  }

  async markAsRead(notif: Notification) {
    const email = this.auth.getCurrentUser()?.email;
    if (!email) return;
    await this.notificationService.markReadByUser(notif.id, email);
  }

  async markAllAsRead() {
    const email = this.auth.getCurrentUser()?.email;
    const unreadIds = this.notifications.map(n => n.id);
    if (unreadIds.length === 0 || !email) return;
    await this.notificationService.markMultipleReadByUser(unreadIds, email);
    this.showNotifications = false;
  }

  getCurrentUser() {
    return this.auth.getCurrentUser();
  }

  getBranchName(): string {
    return this.branchSelection.getSelectedBranchName();
  }

  goToPublicPortal() {
    this.router.navigate(['/']);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/']);
  }
}
