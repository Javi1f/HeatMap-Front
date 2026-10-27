/**
 * @file cotizacion.service.ts
 * @description Cliente de la API de cotización: las dos caras del módulo.
 *
 *  - `POST /api/cotizacion` es público: el formulario de la web envía la
 *    solicitud sin sesión y recibe el identificador y la estimación.
 *  - `/api/cotizaciones` es del panel: lista, detalle, ciclo comercial,
 *    borrado y el documento .json de cada solicitud.
 *
 * Como el resto de la API, el transporte va cifrado de extremo a extremo;
 * este servicio no conoce los detalles: los interceptores lo hacen.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl as API_URL } from '../config';
import { EstimacionCotizacion, TipoRecinto } from '../estimacion-nodos';

/** Envoltorio estándar de las respuestas de la API. */
export interface RespuestaCotizacion<T> {
  success: boolean;
  data: T;
}

/** Requisitos especiales que el formulario pregunta. */
export interface Requisitos {
  camaras: boolean;
  analisisRed: boolean;
  seguridadPrivada: boolean;
  ventilacionRemota: boolean;
  notas?: string;
}

/** Solicitud tal como la envía el formulario público. */
export interface SolicitudCotizacionPayload {
  tipoRecinto: TipoRecinto;
  organizacion: string;
  nombreContacto: string;
  correoContacto: string;
  telefonoContacto?: string;
  areaM2: number;
  aforoMinimo: number;
  aforoMaximo: number;
  eventosAnuales: number;
  requisitos: Requisitos;
  /** Autorización del tratamiento de datos (art. 9, Ley 1581 de 2012). */
  aceptaDatos: true;
}

/** Respuesta al visitante que acaba de enviar su solicitud. */
export interface SolicitudCreada {
  idSolicitud: string;
  estimacion: EstimacionCotizacion;
}

/** Estados del ciclo comercial, en orden de avance. */
export const ESTADOS_SOLICITUD = ['nueva', 'en-revision', 'contactada', 'cerrada', 'descartada'] as const;

/** Estado de una solicitud en el ciclo comercial. */
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

/** Etiqueta legible de cada estado, para chips y filtros del panel. */
export const ETIQUETAS_ESTADO: Record<EstadoSolicitud, string> = {
  nueva: 'Nueva',
  'en-revision': 'En revisión',
  contactada: 'Contactada',
  cerrada: 'Cerrada',
  descartada: 'Descartada',
};

/** Resumen de una solicitud, tal como llega al listado del panel. */
export interface SolicitudResumen {
  idSolicitud: string;
  tipoRecinto: TipoRecinto;
  organizacion: string;
  nombreContacto: string;
  areaM2: number;
  aforoMinimo: number;
  aforoMaximo: number;
  eventosAnuales: number;
  nodos: number;
  estado: EstadoSolicitud;
  fechaCreacion: string;
}

/** Solicitud abierta en el panel, con el contacto descifrado por el backend. */
export interface SolicitudDetalle extends SolicitudResumen {
  correoContacto: string;
  telefonoContacto: string | null;
  datos: Record<string, unknown>;
  estimacion: EstimacionCotizacion;
  notasComerciales: string | null;
  ipOrigen: string | null;
}

/** Documento .json descargable de una solicitud. */
export interface DocumentoSolicitud {
  idSolicitud: string;
  version: number;
  recibida: string;
  estado: EstadoSolicitud;
  solicitud: Record<string, unknown>;
  estimacion: EstimacionCotizacion;
  notasComerciales: string | null;
}

/** Servicio del módulo de cotización: una clase, dos caras. */
@Injectable({ providedIn: 'root' })
export class CotizacionService {
  /** Cliente HTTP con los interceptores de cifrado y sesión aplicados. */
  private http = inject(HttpClient);

  /** Envía la solicitud desde el formulario público, sin sesión. */
  enviar(payload: SolicitudCotizacionPayload): Observable<RespuestaCotizacion<SolicitudCreada>> {
    return this.http.post<RespuestaCotizacion<SolicitudCreada>>(`${API_URL}/cotizacion`, payload);
  }

  /** Solicitudes del panel, filtradas por estado si se indica. */
  listar(estado?: EstadoSolicitud): Observable<RespuestaCotizacion<SolicitudResumen[]>> {
    const filtro = estado ? `?estado=${encodeURIComponent(estado)}` : '';
    return this.http.get<RespuestaCotizacion<SolicitudResumen[]>>(`${API_URL}/cotizaciones${filtro}`);
  }

  /** Detalle de una solicitud, con el contacto descifrado por el backend. */
  obtener(id: string): Observable<RespuestaCotizacion<SolicitudDetalle>> {
    return this.http.get<RespuestaCotizacion<SolicitudDetalle>>(`${API_URL}/cotizaciones/${id}`);
  }

  /** Mueve la solicitud por su ciclo comercial, con notas opcionales. */
  cambiarEstado(
    id: string,
    estado: EstadoSolicitud,
    notas?: string,
  ): Observable<RespuestaCotizacion<SolicitudDetalle>> {
    return this.http.patch<RespuestaCotizacion<SolicitudDetalle>>(
      `${API_URL}/cotizaciones/${id}/estado`,
      { estado, ...(notas !== undefined ? { notas } : {}) },
    );
  }

  /** Elimina una solicitud del panel. */
  eliminar(id: string): Observable<RespuestaCotizacion<{ message: string }>> {
    return this.http.delete<RespuestaCotizacion<{ message: string }>>(`${API_URL}/cotizaciones/${id}`);
  }

  /** Documento .json de la solicitud, tal como lo conserva el backend. */
  documento(id: string): Observable<RespuestaCotizacion<DocumentoSolicitud>> {
    return this.http.get<RespuestaCotizacion<DocumentoSolicitud>>(`${API_URL}/cotizaciones/${id}/documento`);
  }
}

/** Dispara la descarga de un objeto como archivo .json en el navegador. */
export const descargarJson = (nombre: string, contenido: unknown): void => {
  const blob = new Blob([JSON.stringify(contenido, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${nombre}.json`;
  enlace.click();
  URL.revokeObjectURL(url);
};
