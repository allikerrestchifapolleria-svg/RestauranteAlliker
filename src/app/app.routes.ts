import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./modules/public/public-routing-module').then(m => m.routes)
  },
  {
    path: 'admin',
    loadChildren: () => import('./modules/admin/admin-routing-module').then(m => m.routes)
  },
  
  {
    path: 'waiter',
    loadChildren: () => import('./modules/waiter/waiter-routing-module').then(m => m.routes)
  },
  {
    path: 'kitchen',
    loadChildren: () => import('./modules/kitchen/kitchen-routing-module').then(m => m.routes)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
