import { Routes } from '@angular/router';
import { WaiterLayoutComponent } from '../../layouts/waiter-layout/waiter-layout';
import { Orders } from './orders/orders';
import { Tables } from './tables/tables';
import { Payment } from './payment/payment';
import { roleGuard } from '../../guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    component: WaiterLayoutComponent,
    canActivate: [roleGuard(['waiter'])],
    children: [
      { path: 'orders', component: Orders },
      { path: 'tables', component: Tables },
      { path: 'payment', component: Payment },
      { path: '', redirectTo: 'tables', pathMatch: 'full' }
    ]
  }
];