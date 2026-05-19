/**
 * @file admin.model.ts
 * @description Interfaces TypeScript que modelan las entidades de dominio y los
 * contratos de request/response de la API REST del backend.
 *
 * Todos los tipos aquí reflejan el contrato del backend tal cual:
 * los campos, sus tipos y su opcionalidad deben mantenerse sincronizados
 * con la documentación de la API cuando el backend evolucione.
 */

// ─── Entidades de dominio ──────────────────────────────────────────────────────

/**
 * Representa un administrador autenticado en el sistema.
 * Esta entidad se recibe del backend tras un login o verificación exitosos,
 * y se persiste en el estado de sesión de {@link AuthService}.
 */
export interface Admin {
  /** Identificador numérico único asignado por la base de datos. */
  id: number;
  /** Nombre de usuario único; entre 3 y 32 caracteres `[A-Za-z0-9_-]`. */
  username: string;
  /** Dirección de correo electrónico del administrador. */
  email: string;
}

/**
 * Registro de un correo electrónico en la lista blanca de registros permitidos.
 * Solo los correos presentes en esta lista pueden completar el flujo de registro.
 */
export interface AllowedEmail {
  /** Identificador numérico único del registro. */
  id: number;
  /** Dirección de correo electrónico autorizada. */
  email: string;
  /** Username del administrador que añadió este correo a la lista. */
  addedBy: string;
  /** Fecha de creación en formato ISO 8601 (ej. `"2026-05-01T12:00:00.000Z"`). */
  createdAt: string;
}

// ─── Auth: requests ────────────────────────────────────────────────────────────

/**
 * Payload enviado a `POST /api/auth/login`.
 * El campo `username` acepta tanto el nombre de usuario como el email.
 */
export interface LoginRequest {
  /**
   * Identificador del administrador: puede ser el `username` o el `email`.
   * Mínimo 1 carácter; la validación de fuerza se realiza en el backend.
   */
  username: string;
  /** Contraseña en texto plano. Se cifra en tránsito mediante AES-256-GCM. */
  password: string;
}

/**
 * Payload enviado a `POST /api/auth/register`.
 * El email debe estar en la lista blanca del backend para que el registro prospere.
 */
export interface RegisterRequest {
  /** Nombre de usuario deseado; 3-32 caracteres `[A-Za-z0-9_-]`. */
  username: string;
  /** Correo electrónico; debe estar autorizado en la lista blanca. */
  email: string;
  /** Contraseña: mínimo 8 caracteres con mayúscula, minúscula, número y símbolo. */
  password: string;
}

// ─── Auth: responses ───────────────────────────────────────────────────────────

/**
 * Respuesta de `POST /api/auth/login` y `POST /api/auth/verify-code` (éxito).
 * Contiene los datos del administrador y el JWT para peticiones autenticadas.
 */
export interface LoginResponse {
  /** Datos del administrador que acaba de autenticarse. */
  admin: Admin;
  /** JWT firmado por el backend; debe enviarse como `Authorization: Bearer <token>`. */
  token: string;
}

/**
 * Respuesta de `POST /api/auth/register` (éxito).
 * El registro no es inmediato: siempre requiere verificación por correo.
 */
export interface RegisterResponse {
  /** Mensaje informativo para mostrar al usuario. */
  message: string;
  /**
   * Siempre `true` en la implementación actual.
   * Indica que debe mostrarse el flujo de verificación de código.
   */
  verificationRequired: boolean;
}

/**
 * Respuesta de `POST /api/auth/verify-code` (éxito).
 * Idéntica en forma a {@link LoginResponse}; se reutiliza en `AuthService.verifyCode`.
 * Declarada por separado para mayor claridad semántica en el flujo de registro.
 */
export interface VerifyCodeResponse {
  /** Datos del administrador recién verificado. */
  admin: Admin;
  /** JWT firmado; equivalente al devuelto en el login. */
  token: string;
}

/**
 * Cuerpo del error devuelto por `POST /api/auth/verify-code` en caso de fallo.
 * El backend usa la forma uniforme de error; aquí se tipan los campos relevantes.
 */
export interface VerifyCodeErrorResponse {
  /** Siempre `false` en respuestas de error. */
  success: boolean;
  /** Descripción legible del error para mostrar en la UI. */
  message: string;
  /**
   * Código de error de máquina. Valores relevantes para este endpoint:
   * - `"INVALID_VERIFICATION_CODE"` — código incorrecto, quedan intentos.
   * - `"VERIFICATION_CODE_EXPIRED"` — el código caducó.
   * - `"TOO_MANY_ATTEMPTS"` — se agotaron los intentos; el pending se elimina.
   */
  code: string;
  /** Código de estado HTTP equivalente (400). */
  statusCode: number;
  /**
   * Detalles adicionales específicos del error.
   * Presente en `INVALID_VERIFICATION_CODE` y `TOO_MANY_ATTEMPTS`.
   */
  details?: {
    /**
     * Intentos restantes antes de que el backend elimine el registro pendiente.
     * Cuando llega a `0`, el flujo debe reiniciarse desde el registro.
     */
    attemptsLeft: number;
  };
}

/**
 * Respuesta de `GET /api/auth/session`.
 * Permite validar si el JWT almacenado en `localStorage` sigue siendo válido
 * y obtener los datos actualizados del administrador.
 */
export interface SessionResponse {
  /** Datos actuales del administrador si la sesión es válida. */
  admin: Admin;
  /**
   * `true` si el token es válido y no ha expirado.
   * `false` si el token es inválido, ha expirado o fue revocado.
   */
  isValid: boolean;
}
