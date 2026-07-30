import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, UserRole } from '../services/auth';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return (route, state) => {
    const auth = inject(Auth);
    const router = inject(Router);
    const userRole = auth.getUserRole();
    console.log('[ROLE-GUARD]', state.url, '-> role actual:', userRole, '| roles permitidos:', allowedRoles, '| isLoggedIn:', auth.isLoggedIn());
    if (userRole && allowedRoles.includes(userRole)) {
      console.log('[ROLE-GUARD] ACCESO PERMITIDO a', state.url);
      return true;
    }
    console.warn('[ROLE-GUARD] ACCESO DENEGADO a', state.url, '-> redirigiendo a "/". Motivo:', userRole ? 'rol "' + userRole + '" no esta en ' + JSON.stringify(allowedRoles) : 'no hay usuario logueado (getUserRole() devolvio null)');
    router.navigate(['/']);
    return false;
  };
};
