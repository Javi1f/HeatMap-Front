/**
 * @file auth.interceptor.ts
 * @description Interceptor HTTP funcional que gestiona la autenticación JWT
 * en todas las peticiones salientes y reacciona globalmente a errores 401.
 *
 * ## Responsabilidades
 * 1. **Inyección del token**: adjunta el header `Authorization: Bearer <token>`
 *    en cada petición si existe un token activo en `localStorage`.
 * 2. **Manejo de 401**: cuando el backend responde con 401 (token expirado,
 *    inválido o ausente), limpia la sesión local y redirige al login,
 *    sin requerir lógica adicional en cada componente o servicio.
 *
 * ## Orden con cryptoInterceptor
 * Registrado **antes** de `cryptoInterceptor` en `app.config.ts`:
 * - Request: auth añade el header `Authorization` → crypto cifra el body.
 * - Response: crypto descifra el body (ya descifrado cuando llega aquí) → auth evalúa 401.
 *
 * @see {@link AuthService}
 */

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor funcional de Angular para autenticación basada en JWT.
 *
 * - Si hay token disponible, clona la petición y añade el header
 *   `Authorization: Bearer <token>` antes de pasarla al siguiente handler.
 * - Si la respuesta es un error 401, invoca {@link AuthService.clearSession}
 *   para limpiar el estado local y redirige a `/login`.
 *   El error se relanza igualmente para que los suscriptores puedan reaccionar.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Clonar la petición añadiendo el header solo si hay token activo
  const authReq = token
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Sesión expirada o token inválido: limpiar estado y redirigir
      if (error.status === 401) {
        authService.clearSession();
        router.navigate(['/login']).catch(() => undefined);
      }
      return throwError(() => error);
    })
  );
};
