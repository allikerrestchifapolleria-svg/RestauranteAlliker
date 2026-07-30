import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

export const customerGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const role = auth.getUserRole();

  if (role === 'cook') {
    router.navigate(['/kitchen']);
    return false;
  }
  if (role === 'waiter') {
    router.navigate(['/waiter']);
    return false;
  }
  if (role === 'admin') {
    router.navigate(['/admin/dashboard']);
    return false;
  }
  return true;
};
