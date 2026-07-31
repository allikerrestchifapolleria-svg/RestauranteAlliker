import { Routes } from '@angular/router';
import { PublicLayoutComponent } from '../../layouts/public-layout/public-layout';
import { HomeComponent } from './home/home';
import { Login } from './login/login';
import { Register } from './register/register';
import { Menu } from './menu/menu';
import { Dishes } from './dishes/dishes';
import { Reservations } from './reservations/reservations';
import { Cart } from './cart/cart';
import { Payment } from './payment/payment';
import { OrderTracking } from './order-tracking/order-tracking';
import { NoBranchComponent } from './no-branch/no-branch';
import { authGuard } from '../../guards/auth.guard';
import { customerGuard } from '../../guards/customer.guard';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        component: HomeComponent
      },
      {
        path: 'login',
        component: Login
      },
      {
        path: 'register',
        component: Register
      },
      {
        path: 'menu',
        component: Menu
      },
      {
        path: 'dishes',
        component: Dishes
      },
      {
        path: 'reservations',
        component: Reservations,
        // authGuard primero: reservar exige cuenta registrada, y redirige a
        // /login?returnUrl=/reservations para volver aqui tras registrarse.
        canActivate: [authGuard, customerGuard]
      },
      {
        path: 'cart',
        component: Cart,
        canActivate: [customerGuard]
      },
      {
        path: 'payment',
        component: Payment,
        canActivate: [authGuard, customerGuard]
      },
      {
        path: 'order-tracking/:orderId',
        component: OrderTracking,
        canActivate: [customerGuard]
      },
      {
        path: 'no-branch',
        component: NoBranchComponent
      }
    ]
  }
];
