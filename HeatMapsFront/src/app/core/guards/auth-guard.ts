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
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError, of } from 'rxjs';

/**
 * Guard funcional de Angular Router para rutas protegidas por autenticación.
 *
 * Devuelve `true` de forma síncrona si el estado en memoria ya confirma la
 * autenticación, o un `Observable<boolean>` si es necesario verificar el
 * token con el backend.
 *
 * @returns `true` | `false` (síncronos) o `Observable<boolean>` (asíncrono
 *          cuando se valida el token con el backend).
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Caso 1: sesión ya activa en memoria — acceso inmediato sin HTTP
  if (authService.isAuthenticated()) {
    return true;
  }

  // Caso 2: hay token pero sin estado en memoria — validar con el backend
  if (authService.getToken()) {
    return authService.checkSession().pipe(
      map(response => {
        if (response.isValid) return true;
        // Token inválido según el backend: redirigir
        void router.navigate(['/login']);
        return false;
      }),
      catchError(() => {
        // Error de red u otro error HTTP: denegar acceso preventivamente
        void router.navigate(['/login']);
        return of(false);
      })
    );
  }

  // Caso 3: sin token — redirigir directamente
  void router.navigate(['/login']);
  return false;
};
