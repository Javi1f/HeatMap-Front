/**
 * @file users.service.ts
 * @description Cliente de `/api/users`: administradores registrados y sesiones
 * abiertas.
 *
 * Complementa a {@link AllowedEmailsService}: la lista blanca gobierna quién
 * *puede* registrarse, mientras que este servicio describe quién *ya está*
 * dentro y desde dónde.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl as API_URL } from '../config';
import { ApiResponse } from './metrics.service';

/** Administrador registrado. */
export interface AdminSummary {
  /** Identificador numérico de la cuenta. */
  id: number;

  /** Nombre de usuario, ya descifrado por el backend. */
  username: string;

  /** Correo de la cuenta, ya descifrado por el backend. */
  email: string;

  /** `true` si completó la verificación por correo. */
  isVerified: boolean;

  /** Marca ISO del alta de la cuenta. */
  createdAt: string;

  /** `true` si la cuenta tiene al menos una sesión viva. */
  conSesionActiva: boolean;

  /** Rol de la cuenta. */
  rol: 'root' | 'admin';

  /** `false` si la cuenta está desactivada. */
  activo: boolean;
}

/** Evento de auditoría de una acción administrativa. */
export interface EventoAuditoria {
  /** Identificador del evento. */
  id: string;

  /** Marca ISO del evento. */
  fecha: string;

  /** Administrador que actuó, o `null` si no llegó a identificarse. */
  idAdmin: number | null;

  /** Tipo de acción. */
  tipo: string;

  /** Contexto, sin datos personales. */
  detalle: string | null;

  /** IP de origen. */
  ipOrigen: string | null;
}

/** Sesión de administrador actualmente abierta. */
export interface SessionSummary {
  /** Identificador de la sesión, necesario para revocarla. */
  idSesion: string;

  /** Cuenta titular de la sesión. */
  idAdmin: number;

  /** Username del titular, o `null` si la cuenta ya no existe. */
  username: string | null;

  /** IP desde la que se inició, o `null` si no se registró. */
  ipOrigen: string | null;

  /** Marca ISO del inicio de sesión. */
  fechaInicio: string;

  /** Marca ISO en la que el token deja de ser válido. */
  fechaExpiracion: string;

  /** `true` si es la sesión desde la que se está viendo la pantalla. */
  esActual: boolean;
}

/**
 * Servicio singleton de administración de usuarios.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  /** Cliente HTTP con los interceptores de auth y cifrado ya aplicados. */
  private http = inject(HttpClient);

  /** Lista de administradores registrados. */
  listAdmins(): Observable<ApiResponse<AdminSummary[]>> {
    return this.http.get<ApiResponse<AdminSummary[]>>(`${API_URL}/users/admins`);
  }

  /** Sesiones vivas de todos los administradores. */
  listSessions(): Observable<ApiResponse<SessionSummary[]>> {
    return this.http.get<ApiResponse<SessionSummary[]>>(`${API_URL}/users/sessions`);
  }

  /**
   * Cierra una sesión.
   *
   * Cerrar la propia equivale a un logout: la siguiente petición con ese token
   * será rechazada, así que el componente debe redirigir al login.
   */
  revokeSession(idSesion: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${API_URL}/users/sessions/${idSesion}`
    );
  }

  /** Cambia el rol de un administrador. */
  cambiarRol(idAdmin: number, rol: 'root' | 'admin'): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${API_URL}/users/admins/${idAdmin}/rol`, { rol });
  }

  /** Activa o desactiva una cuenta; desactivarla cierra todas sus sesiones. */
  cambiarActivo(idAdmin: number, activo: boolean): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(`${API_URL}/users/admins/${idAdmin}/activo`, { activo });
  }

  /** Últimos eventos de auditoría. */
  listarAuditoria(limite = 50): Observable<ApiResponse<EventoAuditoria[]>> {
    return this.http.get<ApiResponse<EventoAuditoria[]>>(`${API_URL}/users/auditoria?limite=${limite}`);
  }
}
