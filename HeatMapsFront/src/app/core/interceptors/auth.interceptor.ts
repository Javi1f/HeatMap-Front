/**
 * @file auth.interceptor.ts
 * @description Interceptor HTTP funcional que gestiona la autenticación JWT
 * en todas las peticiones salientes y reacciona globalmente a errores 401.
 *
 * ## Responsabilidades
 * 1. **Inyección del token**: adjunta el header `Authorization: Bearer <token>`
 *    en cada petición si existe un token activo en `localStorage`.
 * 2. **Manejo de 401**: cuando el backend responde con 401 (token expirado,
 *    inválido o ausente), limpia la sesión local y devuelve al inicio,
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
import { catchError, throwError, noop } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Endpoints donde un 401 lo produce la credencial enviada, no una sesión caducada. */
const RUTAS_DE_ACCESO = ['/auth/login', '/auth/register', '/auth/verify-code'];

/** Indica si la URL corresponde a un intento de autenticación. */
const esIntentoDeAcceso = (url: string): boolean =>
  RUTAS_DE_ACCESO.some(ruta => url.includes(ruta));

/**
 * Interceptor funcional de Angular para autenticación basada en JWT.
 *
 * - Si hay token disponible, clona la petición y añade el header
 *   `Authorization: Bearer <token>` antes de pasarla al siguiente handler.
 * - Si la respuesta es un error 401, invoca {@link AuthService.clearSession}
 *   para limpiar el estado local y devuelve al inicio.
 *   El error se relanza igualmente para que los suscriptores puedan reaccionar.
 *
 * Se exceptúan los intentos de autenticación: un 401 de `/auth/login` significa
 * «contraseña incorrecta», no «sesión caducada». Sacar al usuario de la pantalla
 * de acceso al fallar el primer intento le impediría corregirlo.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  const authReq = token
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !esIntentoDeAcceso(req.url)) {
        authService.clearSession();
        router.navigate(['/']).catch(noop);
      }
      return throwError(() => error);
    })
  );
};
