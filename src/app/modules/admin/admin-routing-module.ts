import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from '../../layouts/admin-layout/admin-layout';
import { Dashboard } from './dashboard/dashboard';
import { roleGuard } from '../../guards/role.guard';
import { CashRegister } from './cash-register/cash-register';
import { MenuManagement } from './menu-management/menu-management';
import { UserManagement } from './user-management/user-management';
import { CustomerManagement } from './customer-management/customer-management';
import { BranchManagement } from './branch-management/branch-management';
import { MenuCategoryManagement } from './menu-category-management/menu-category-management';
import { PromotionManagement } from './promotion-management/promotion-management';
import { TableManagement } from './table-management/table-management';
import { NotificationManagement } from './notification-management/notification-management';
import { CompanyConfig } from './company-config/company-config';
import { Invoices } from './invoices/invoices';
import { Ventas } from './ventas/ventas';
import { OrderHistory } from './order-history/order-history';
import { ScheduleManagement } from './schedule-management/schedule-management';

export const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [roleGuard(['admin'])],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'cash-register', component: CashRegister },
      { path: 'menu-management', component: MenuManagement },
      { path: 'user-management', component: UserManagement },
      { path: 'customer-management', component: CustomerManagement },
      { path: 'branch-management', component: BranchManagement },
      { path: 'menu-category-management', component: MenuCategoryManagement },
      { path: 'promotion-management', component: PromotionManagement },
      { path: 'table-management', component: TableManagement },
      { path: 'notification-management', component: NotificationManagement },
      { path: 'schedule-management', component: ScheduleManagement },
      { path: 'company-config', component: CompanyConfig },
      { path: 'invoices', component: Invoices },
      { path: 'ventas', component: Ventas },
      { path: 'order-history', component: OrderHistory },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
