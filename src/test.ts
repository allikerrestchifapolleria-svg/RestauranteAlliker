import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

declare var require: (path: string) => any;

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

// Import all spec files
require('./app/app.spec');
require('./app/services/cart.spec');
require('./app/services/payment.spec');
require('./app/services/branch-selection.spec');
require('./app/services/table-merge.spec');
require('./app/modules/public/dishes/dishes.spec');
require('./app/modules/public/cart/cart.spec');
require('./app/modules/public/payment/payment.spec');
require('./app/modules/public/menu/menu.spec');
require('./app/modules/public/home/home.spec');
require('./app/modules/public/login/login.spec');
require('./app/modules/public/register/register.spec');
// RESERVACIONES DESHABILITADO (posible implementación futura).
// require('./app/modules/public/reservations/reservations.spec');
require('./app/modules/public/no-branch/no-branch.spec');
require('./app/layouts/public-layout/public-layout.spec');
require('./app/layouts/waiter-layout/waiter-layout.spec');
require('./app/layouts/kitchen-layout/kitchen-layout.spec');
require('./app/layouts/admin-layout/admin-layout.spec');
require('./app/modules/waiter/orders/orders.spec');
require('./app/modules/waiter/tables/tables.spec');
require('./app/modules/waiter/payment/payment.spec');
require('./app/modules/kitchen/orders/orders.spec');
require('./app/modules/admin/dashboard/dashboard.spec');
require('./app/modules/admin/table-management/table-management.spec');
require('./app/modules/admin/user-management/user-management.spec');
require('./app/modules/admin/branch-management/branch-management.spec');
require('./app/modules/admin/customer-management/customer-management.spec');
require('./app/modules/admin/menu-management/menu-management.spec');
require('./app/modules/admin/menu-category-management/menu-category-management.spec');
require('./app/modules/admin/promotion-management/promotion-management.spec');
require('./app/modules/admin/notification-management/notification-management.spec');
