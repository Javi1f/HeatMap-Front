/**
 * @file crypto.interceptor.ts
 * @description Interceptor HTTP funcional que cifra automáticamente todos los
 * cuerpos de petición salientes y descifra todos los cuerpos de respuesta
 * entrantes mediante {@link CryptoService} (AES-256-GCM).
 *
 * ## Cuándo actúa
 * Se aplica a **todas** las peticiones HTTP gestionadas por `HttpClient`.
 * Los endpoints que no requieren cifrado (p.ej. `/ping`) no tienen body ni
 * devuelven un objeto con propiedad `data`, por lo que el interceptor los
 * deja pasar intactos.
 *
 * ## Flujo de una petición cifrada
 * ```
 * req.body (objeto JS)
 *   → CryptoService.encrypt()
 *   → { data: "<base64>" }         ← body que viaja por la red
 *   → backend descifra y procesa
 *   → { data: "<base64>" }         ← body que llega del servidor
 *   → CryptoService.decrypt()
 *   → objeto JS original            ← lo que recibe el suscriptor
 * ```
 *
 * ## Orden con authInterceptor
 * Registrado **después** de `authInterceptor` en `app.config.ts`:
 * - Request: auth añade el header `Authorization` → crypto cifra el body.
 * - Response: crypto descifra el body → auth evalúa errores 401.
 *
 * @see {@link CryptoService}
 */

import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, of, switchMap, catchError, throwError, map } from 'rxjs';
import { CryptoService } from '../crypto/crypto.service';

/**
 * Interceptor funcional de Angular que aplica cifrado/descifrado AES-256-GCM
 * de forma transparente a todas las peticiones `HttpClient`.
 *
 * ### Cifrado de la petición
 * Si el body de la petición no es `null`, lo cifra y lo reemplaza por
 * `{ data: "<base64>" }` antes de enviarlo. Las peticiones GET (sin body)
 * no se modifican.
 *
 * ### Descifrado de la respuesta exitosa
 * Si la respuesta tiene un body con la propiedad `data` (string), asume que
 * está cifrado, lo descifra y reemplaza el body del evento con el resultado.
 *
 * ### Descifrado de errores HTTP
 * Los errores del backend también viajan cifrados. Si el body del error tiene
 * la propiedad `data`, lo descifra antes de relanzar el `HttpErrorResponse`,
 * para que los suscriptores reciban la forma de error estándar del backend
 * (`{ success, message, code, statusCode, details? }`).
 */
export const cryptoInterceptor: HttpInterceptorFn = (req, next) => {
  const crypto = inject(CryptoService);

  // ── Paso 1: cifrar el body saliente (si existe) ──────────────────────────
  const encryptRequest$ = req.body !== null
    ? from(crypto.encrypt(req.body)).pipe(
        map(encrypted => req.clone({ body: { data: encrypted } }))
      )
    : of(req);

  return encryptRequest$.pipe(
    // ── Paso 2: enviar la petición (ya cifrada o sin body) ─────────────────
    switchMap(encryptedReq => next(encryptedReq)),

    // ── Paso 3: descifrar la respuesta exitosa ─────────────────────────────
    switchMap(event => {
      if (
        event instanceof HttpResponse &&
        event.body !== null &&
        typeof event.body === 'object' &&
        'data' in event.body
      ) {
        const body = event.body as { data: string };
        return from(crypto.decrypt(body.data)).pipe(
          map(decrypted => event.clone({ body: decrypted }))
        );
      }
      // Eventos que no son HttpResponse (p.ej. UploadProgress) pasan sin cambios
      return of(event);
    }),

    // ── Paso 4: descifrar el body de errores HTTP ──────────────────────────
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.error !== null &&
        typeof error.error === 'object' &&
        'data' in error.error
      ) {
        const errorBody = error.error as { data: string };
        return from(crypto.decrypt(errorBody.data)).pipe(
          switchMap(decrypted =>
            throwError(() => new HttpErrorResponse({
              error: decrypted,
              status: error.status,
              statusText: error.statusText,
              url: error.url ?? undefined,
              headers: error.headers
            }))
          )
        );
      }
      // Errores de red o no-HTTP se relanzan tal cual
      return throwError(() => error);
    })
  );
};
