/**
 * @file auth-guard.ts
 * @description Guard funcional de Angular que protege las rutas del área de
 * administración (`/admin/**`), garantizando que solo administradores
 * autenticados puedan acceder a ellas.
 *
 * ## Estrategia de verificación (tres casos)
 *
 * 1. **Estado en memoria**: si el signal `isAuthenticated` ya está activo
 *    (sesión validada en la misma visita), concede acceso inmediato sin
 *    realizar ninguna petición HTTP.
 *
 * 2. **Token en localStorage sin estado en memoria**: el usuario recargó la
 *    página o navegó directamente a una ruta protegida. Se hace una llamada a
 *    `GET /api/auth/session` para validar el token con el backend.
 *    - Si la sesión es válida, concede acceso y actualiza el estado en memoria.
 *    - Si la sesión es inválida o la petición falla, redirige a `/login`.
 *
 * 3. **Sin token**: redirige directamente a `/login` sin petición HTTP.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, of } from 'rxjs';

/**
 * Guard funcional de Angular Router para rutas protegidas por autenticación.
 *
 * Devuelve `true` de forma síncrona si el estado en memoria ya confirma la
 * autenticación, o un `Observable<boolean | UrlTree>` si es necesario verificar
 * el token con el backend.
 *
 * Las redirecciones se realizan devolviendo un `UrlTree` en lugar de llamar a
 * `router.navigate()` manualmente, que es el patrón Angular recomendado para
 * guards: evita Promises flotantes y permite al Router gestionar la navegación
 * de forma declarativa.
 *
 * @returns `true` si está autenticado, `UrlTree` de `/login` si no lo está,
 *          u `Observable<boolean | UrlTree>` cuando se valida el token con el backend.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  /** UrlTree de redirección reutilizado en los tres casos de denegación. */
  const loginTree: UrlTree = router.createUrlTree(['/login']);

  if (authService.isAuthenticated()) {
    return true;
  }

  if (authService.getToken()) {
    return authService.checkSession().pipe(
      map(response => response.isValid ? true : loginTree),
      catchError(() => of(loginTree))
    );
  }

  return loginTree;
};
