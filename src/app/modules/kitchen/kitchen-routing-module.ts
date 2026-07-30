import { Routes } from '@angular/router';
import { KitchenLayoutComponent } from '../../layouts/kitchen-layout/kitchen-layout';
import { Orders } from './orders/orders';
import { roleGuard } from '../../guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    component: KitchenLayoutComponent,
    canActivate: [roleGuard(['cook'])],
    children: [
      { path: 'orders', component: Orders },
      { path: '', redirectTo: 'orders', pathMatch: 'full' }
    ]
  }
];