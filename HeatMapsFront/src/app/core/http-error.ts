/**
 * @file http-error.ts
 * @description Traduce un error HTTP al mensaje que se muestra en pantalla.
 *
 * Existe porque un mensaje genérico del tipo «no se pudieron cargar los datos»
 * oculta la causa y manda a buscar el fallo donde no está: un 429 por cuota
 * agotada y un 500 del servidor exigen reacciones distintas, y quien mira la
 * pantalla no tiene la consola delante para distinguirlos.
 */

import { HttpErrorResponse } from '@angular/common/http';

/**
 * Devuelve un mensaje legible para un error de petición.
 *
 * Da prioridad al mensaje que envía el backend, que suele ser el más preciso,
 * y solo recurre a un texto propio cuando no hay ninguno o cuando el código de
 * estado explica mejor la situación que el cuerpo de la respuesta.
 *
 * @param err      - Error emitido por `HttpClient`.
 * @param fallback - Texto a usar cuando no se puede decir nada más concreto.
 */
export function describeHttpError(err: unknown, fallback: string): string {
  if (!(err instanceof HttpErrorResponse)) return fallback;

  switch (err.status) {
    case 0:
      return 'No hay conexión con el servidor. Comprueba que el backend esté levantado.';
    case 401:
      return 'Tu sesión caducó o fue cerrada. Vuelve a iniciar sesión.';
    case 429:
      return 'Demasiadas peticiones seguidas. Espera unos minutos y recarga.';
    case 500:
    case 502:
    case 503:
      return 'El servidor devolvió un error. Revisa sus registros.';
    default:
      return err.error?.message ?? fallback;
  }
}
