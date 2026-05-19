/**
 * @file verification.service.ts
 * @description Servicio de estado para el flujo de verificación por código
 * de 5 dígitos que se ejecuta tras el registro.
 *
 * Mantiene los signals reactivos que el componente {@link RegisterComponent}
 * usa para mostrar el estado del modal de verificación: intentos restantes y
 * mensajes de error.
 *
 * ## Responsabilidad única
 * Este servicio **solo gestiona el estado de UI** del flujo de verificación;
 * no realiza llamadas HTTP directamente. La lógica de negocio real (enviar
 * el código, contar intentos) vive en el backend. Este servicio refleja lo
 * que el backend comunica a través de `details.attemptsLeft`.
 */

import { Injectable, signal } from '@angular/core';

/**
 * Servicio singleton que mantiene el estado del modal de verificación de código.
 *
 * Provisto en root porque es accedido tanto por el componente de registro
 * como, potencialmente, por otros flujos futuros que requieran verificación.
 */
@Injectable({ providedIn: 'root' })
export class VerificationService {
  /**
   * Intentos de verificación restantes, inicializados a 3 (máximo del backend).
   * Se actualiza con el valor real devuelto por el backend en cada intento fallido.
   */
  attemptsLeft = signal<number>(3);

  /**
   * Mensaje de error legible para mostrar al usuario bajo el input del código.
   * Vacío cuando no hay error activo o tras un reset.
   */
  verificationError = signal<string>('');

  /**
   * Procesa un error de verificación devuelto por el backend y actualiza
   * los signals con el estado resultante.
   *
   * - Si `serverAttemptsLeft === 0`: el registro pendiente ha sido eliminado
   *   por el backend; no se actualiza el mensaje aquí (el componente gestiona
   *   este caso de forma especial cerrando el modal).
   * - Si `serverAttemptsLeft > 0`: muestra cuántos intentos quedan con
   *   concordancia gramatical en singular/plural.
   *
   * @param serverAttemptsLeft - Valor de `details.attemptsLeft` en la respuesta
   *                             de error del backend.
   */
  handleServerError(serverAttemptsLeft: number): void {
    this.attemptsLeft.set(serverAttemptsLeft);
    if (serverAttemptsLeft === 0) {
      this.verificationError.set('Has agotado todos los intentos.');
    } else {
      const s = serverAttemptsLeft === 1 ? '' : 's';
      this.verificationError.set(
        `Código incorrecto. Te quedan ${serverAttemptsLeft} intento${s}.`
      );
    }
  }

  /**
   * Restaura los signals a su estado inicial (3 intentos, sin error).
   *
   * Debe llamarse al abrir el modal de verificación (nuevo registro) o al
   * cerrar el modal sin completar la verificación.
   */
  reset(): void {
    this.attemptsLeft.set(3);
    this.verificationError.set('');
  }
}
