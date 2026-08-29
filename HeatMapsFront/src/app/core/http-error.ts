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
 * Mensaje propio para los códigos de estado que se explican mejor por sí solos
 * que por el cuerpo de la respuesta.
 *
 * Es una tabla y no una cadena de `case` para que añadir un código sea agregar
 * una línea, sin sumar un camino más a la función que la consulta.
 */
const MENSAJE_POR_ESTADO: Readonly<Record<number, string>> = {
  0: 'No hay conexión con el servidor. Comprueba que el backend esté levantado.',
  401: 'Tu sesión caducó o fue cerrada. Vuelve a iniciar sesión.',
  429: 'Demasiadas peticiones seguidas. Espera unos minutos y recarga.',
  500: 'El servidor devolvió un error. Revisa sus registros.',
  502: 'El servidor devolvió un error. Revisa sus registros.',
  503: 'El servidor devolvió un error. Revisa sus registros.',
};

/**
 * Devuelve un mensaje legible para un error de petición.
 *
 * Da prioridad al mensaje que envía el backend, que suele ser el más preciso,
 * y solo recurre a un texto propio cuando no hay ninguno o cuando el código de
 * estado explica mejor la situación que el cuerpo de la respuesta.
 *
 * @param err      - Error emitido por `HttpClient`.
 * @param fallback - Texto a usar cuando no se puede decir nada más concreto.
 * @returns Texto listo para mostrar al usuario.
 */
export const describeHttpError = (err: unknown, fallback: string): string => {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  return MENSAJE_POR_ESTADO[err.status] ?? err.error?.message ?? fallback;
};
