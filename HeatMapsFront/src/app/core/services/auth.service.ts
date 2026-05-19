/**
 * @file auth.service.ts
 * @description Servicio central de autenticación. Gestiona el ciclo de vida
 * completo de la sesión del administrador: login, registro, verificación por
 * código, cierre de sesión y validación de token.
 *
 * ## Estado de sesión
 * El estado se mantiene en dos Angular Signals privados y se expone como
 * `computed` de solo lectura para que los componentes puedan suscribirse
 * de forma reactiva sin poder mutar el estado directamente.
 *
 * ## Persistencia
 * El JWT se persiste en `localStorage` bajo la clave `"token"` para sobrevivir
 * recargas de página. El estado en memoria (`_isAuthenticated`, `_currentAdmin`)
 * se reconstruye en el arranque de la app verificando el token con el backend
 * (véase `AppComponent.ngOnInit`).
 *
 * ## Cifrado
 * Todos los métodos delegan en `HttpClient`, cuyas peticiones son interceptadas
 * automáticamente por {@link CryptoInterceptor}. Este servicio no conoce
 * los detalles de cifrado.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import {
  Admin, LoginRequest, LoginResponse,
  RegisterRequest, RegisterResponse,
  SessionResponse
} from '../models/admin.model';
import { apiUrl as API_URL } from '../config';

/**
 * Servicio singleton de autenticación y gestión de sesión.
 *
 * Expone métodos que corresponden 1:1 con los endpoints `POST /api/auth/*`
 * y `GET /api/auth/session`. Los `Observable`s devueltos ya tienen aplicado
 * el `tap` necesario para sincronizar el estado interno al recibir la respuesta.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  /** Signal privado que indica si hay una sesión activa en memoria. */
  private _isAuthenticated = signal<boolean>(false);

  /** Signal privado con los datos del administrador actualmente autenticado. */
  private _currentAdmin = signal<Admin | null>(null);

  /**
   * Signal de solo lectura que expone el estado de autenticación.
   * Los componentes deben suscribirse a este computed en lugar del signal interno.
   */
  isAuthenticated = computed(() => this._isAuthenticated());

  /**
   * Signal de solo lectura con los datos del administrador autenticado,
   * o `null` si no hay sesión activa.
   */
  currentAdmin = computed(() => this._currentAdmin());

  /**
   * Autentica al administrador con usuario y contraseña.
   *
   * En caso de éxito, llama automáticamente a {@link saveSession} via `tap`
   * para persistir el token y actualizar el estado en memoria antes de que
   * el suscriptor reciba la respuesta.
   *
   * @param request - Credenciales del administrador (`username`/`email` + `password`).
   * @returns Observable que emite {@link LoginResponse} (`{ admin, token }`) en éxito,
   *          o lanza `HttpErrorResponse` con `code: "INVALID_CREDENTIALS"` si fallan.
   */
  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_URL}/auth/login`, request).pipe(
      tap(response => this.saveSession(response))
    );
  }

  /**
   * Registra un nuevo administrador.
   *
   * El registro no es inmediato: el backend envía un código de verificación
   * al correo indicado y el flujo continúa con {@link verifyCode}.
   *
   * @param request - Datos del nuevo administrador (`username`, `email`, `password`).
   * @returns Observable que emite {@link RegisterResponse} (`{ message, verificationRequired: true }`)
   *          en éxito, o lanza `HttpErrorResponse` si el email no está en la lista blanca
   *          (`EMAIL_NOT_ALLOWED`), ya está registrado (`CONFLICT`) o los datos son inválidos
   *          (`VALIDATION_FAILED`).
   */
  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${API_URL}/auth/register`, request);
  }

  /**
   * Verifica el código de 5 dígitos enviado al correo durante el registro.
   *
   * En caso de éxito, completa el registro y abre la sesión automáticamente
   * llamando a {@link saveSession} via `tap`.
   *
   * @param email - Correo electrónico del administrador en verificación.
   * @param code  - Código de verificación de exactamente 5 dígitos.
   * @returns Observable que emite {@link LoginResponse} en éxito (el administrador queda
   *          autenticado), o lanza `HttpErrorResponse` con `details.attemptsLeft` si el
   *          código es incorrecto, o con `code: "TOO_MANY_ATTEMPTS"` si se superaron
   *          los 3 intentos permitidos.
   */
  verifyCode(email: string, code: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_URL}/auth/verify-code`, { email, code })
      .pipe(tap(response => this.saveSession(response)));
  }

  /**
   * Cancela el proceso de verificación pendiente para el email indicado.
   *
   * Se usa cuando el usuario cierra el modal de verificación voluntariamente,
   * limpiando el estado pendiente en el backend para permitir un nuevo intento
   * de registro. La operación es idempotente (responde 200 aunque no haya pending).
   *
   * @param email - Correo electrónico del registro pendiente a cancelar.
   * @returns Observable que emite `{ message: string }` en éxito.
   */
  cancelVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${API_URL}/auth/cancel-verification`,
      { email }
    );
  }

  /**
   * Valida el token JWT almacenado con el backend y actualiza el estado en memoria.
   *
   * Se invoca en el arranque de la aplicación (`AppComponent.ngOnInit`) y en
   * {@link AuthGuard} cuando hay token pero no hay estado en memoria (recarga de página).
   *
   * - Si `isValid: true`: actualiza `_isAuthenticated` y `_currentAdmin`.
   * - Si `isValid: false` o error HTTP: llama a {@link clearSession}.
   *
   * @returns Observable que emite {@link SessionResponse} (`{ admin, isValid }`) en éxito,
   *          o lanza el error después de limpiar la sesión.
   */
  checkSession(): Observable<SessionResponse> {
    return this.http.get<SessionResponse>(`${API_URL}/auth/session`).pipe(
      tap(response => {
        if (response.isValid) {
          this._isAuthenticated.set(true);
          this._currentAdmin.set(response.admin);
        } else {
          this.clearSession();
        }
      }),
      catchError(err => {
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  /**
   * Cierra la sesión activa en el backend y limpia el estado local.
   *
   * El JWT es stateless, por lo que el "cierre" en el backend es informativo.
   * La sesión se destruye en el cliente siempre, incluso si la petición falla.
   *
   * @returns Observable que emite `{ message: string }` en éxito.
   */
  logout(): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${API_URL}/auth/logout`, {})
      .pipe(
        tap(() => this.clearSession()),
        catchError(err => {
          // Limpiar siempre aunque falle la petición
          this.clearSession();
          return throwError(() => err);
        })
      );
  }

  /**
   * Persiste la sesión en `localStorage` y actualiza los signals de estado.
   *
   * Llamado internamente por {@link login} y {@link verifyCode} mediante `tap`.
   * Es público para permitir su uso en tests y en escenarios excepcionales donde
   * se recibe una respuesta de login fuera del flujo estándar.
   *
   * @param response - Respuesta de login/verificación con `{ admin, token }`.
   */
  saveSession(response: LoginResponse): void {
    localStorage.setItem('token', response.token);
    this._isAuthenticated.set(true);
    this._currentAdmin.set(response.admin);
  }

  /**
   * Elimina el token de `localStorage` y resetea los signals de estado.
   *
   * Se llama en logout, en errores 401 (via {@link AuthInterceptor}) y cuando
   * {@link checkSession} confirma que la sesión es inválida.
   */
  clearSession(): void {
    localStorage.removeItem('token');
    this._isAuthenticated.set(false);
    this._currentAdmin.set(null);
  }

  /**
   * Lee el token JWT directamente de `localStorage`.
   *
   * @returns El token JWT como string, o `null` si no existe.
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  }
}
