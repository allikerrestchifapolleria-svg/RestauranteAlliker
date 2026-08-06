import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, UserRole } from '../services/auth';

/**
 * Guard de las zonas de personal (admin, cocina, mesero).
 *
 * Antes decidia con `auth.getUserRole()`, que lee el rol del localStorage: bastaba
 * con editar esa clave desde las devtools para que se abriera /admin. Los datos
 * seguian protegidos por las reglas de Firestore y por requireAdmin en las Netlify
 * Functions, pero la interfaz se abria igual. Ahora el rol se reconfirma contra
 * Firestore antes de conceder la ruta.
 *
 * El guard solo cuelga de la ruta raiz de cada modulo, asi que es una lectura por
 * entrada al modulo, no por navegacion interna.
 */
export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return async (_route, state) => {
    const auth = inject(Auth);
    const router = inject(Router);

    const verifiedRole = await auth.resolveVerifiedRole();

    if (verifiedRole && allowedRoles.includes(verifiedRole)) {
      return true;
    }

    console.warn(
      '[ROLE-GUARD] Acceso denegado a', state.url,
      '· rol verificado:', verifiedRole ?? 'ninguno',
      '· roles permitidos:', allowedRoles
    );
    return router.createUrlTree(['/']);
  };
};
