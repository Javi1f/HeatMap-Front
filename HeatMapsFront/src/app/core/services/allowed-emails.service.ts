/**
 * @file allowed-emails.service.ts
 * @description Servicio CRUD para la lista blanca de correos electrónicos
 * autorizados a registrarse como administradores.
 *
 * Todos los endpoints requieren autenticación (`Authorization: Bearer <token>`),
 * que el {@link AuthInterceptor} añade automáticamente. Los payloads viajan
 * cifrados gracias al {@link CryptoInterceptor}.
 *
 * ## Endpoints que consume
 * | Método   | Path                         | Descripción                     |
 * |----------|------------------------------|---------------------------------|
 * | `GET`    | `/api/allowed-emails`        | Lista todos los correos          |
 * | `POST`   | `/api/allowed-emails`        | Añade un correo a la lista       |
 * | `DELETE` | `/api/allowed-emails/:id`    | Elimina un correo por ID         |
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AllowedEmail } from '../models/admin.model';
import { apiUrl as API_URL } from '../config';

// ─── Response shapes ───────────────────────────────────────────────────────────

/**
 * Respuesta de `GET /api/allowed-emails`.
 * Devuelve la lista completa de correos autorizados, ordenada por fecha de creación.
 */
export interface AllowedEmailsListResponse {
  /** Siempre `true` en respuestas exitosas. */
  success: boolean;
  /** Array de correos autorizados. */
  data: AllowedEmail[];
}

/**
 * Respuesta de `POST /api/allowed-emails`.
 * Devuelve el correo recién creado con su ID asignado por la base de datos.
 */
export interface AllowedEmailItemResponse {
  /** Siempre `true` en respuestas exitosas. */
  success: boolean;
  /** El registro del correo creado. */
  data: AllowedEmail;
}

/**
 * Respuesta de `DELETE /api/allowed-emails/:id`.
 */
export interface DeleteEmailResponse {
  /** Siempre `true` en respuestas exitosas. */
  success: boolean;
  /** Mensaje de confirmación para mostrar en la UI si se desea. */
  message: string;
}

// ─── Servicio ──────────────────────────────────────────────────────────────────

/**
 * Servicio singleton para gestionar la lista blanca de correos permitidos.
 *
 * Todas las operaciones requieren que el usuario esté autenticado.
 * Los errores HTTP (403 sin permiso, 409 correo duplicado, 404 no encontrado)
 * se propagan como `HttpErrorResponse` y deben manejarse en los componentes.
 */
@Injectable({ providedIn: 'root' })
export class AllowedEmailsService {
  private http = inject(HttpClient);

  /**
   * Obtiene la lista completa de correos autorizados.
   *
   * @returns Observable con `{ success, data: AllowedEmail[] }`.
   */
  getAll(): Observable<AllowedEmailsListResponse> {
    return this.http.get<AllowedEmailsListResponse>(`${API_URL}/allowed-emails`);
  }

  /**
   * Añade un correo electrónico a la lista blanca.
   *
   * @param email - Dirección de correo a autorizar. Debe ser un email RFC válido.
   * @returns Observable con `{ success, data: AllowedEmail }` (el registro creado).
   * @throws `HttpErrorResponse` con `code: "CONFLICT"` si el correo ya existe,
   *         o `code: "VALIDATION_FAILED"` si el formato es inválido.
   */
  add(email: string): Observable<AllowedEmailItemResponse> {
    return this.http.post<AllowedEmailItemResponse>(`${API_URL}/allowed-emails`, { email });
  }

  /**
   * Elimina un correo de la lista blanca por su identificador numérico.
   *
   * @param id - ID numérico del registro a eliminar.
   * @returns Observable con `{ success, message }` de confirmación.
   * @throws `HttpErrorResponse` con `code: "NOT_FOUND"` si el ID no existe.
   */
  delete(id: number): Observable<DeleteEmailResponse> {
    return this.http.delete<DeleteEmailResponse>(`${API_URL}/allowed-emails/${id}`);
  }
}
