/**
 * @file reportes.service.ts
 * @description Cliente de `/api/reportes`: definiciones guardadas de reportes
 * de ocupación y su exportación a CSV.
 *
 * ## Qué se guarda
 * El backend persiste la *definición* del reporte (tipo, rango y zona), nunca
 * su resultado: los datos se recalculan al abrirlo. Por eso un reporte que se
 * consulta semanas después refleja el histórico tal como está entonces.
 *
 * ## La descarga no es una respuesta de archivo
 * El endpoint de CSV devuelve el contenido como texto dentro de la respuesta
 * cifrada normal, y es este servicio quien construye la descarga en el
 * navegador. Así la ruta no necesita quedar exenta del cifrado que protege al
 * resto de la API.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { apiUrl as API_URL } from '../config';
import { ApiResponse } from './metrics.service';

/** Clases de reporte que el backend sabe generar. */
export type TipoReporte = 'serie_temporal' | 'resumen_por_zona' | 'alertas';

/** Etiquetas legibles de cada tipo, para los desplegables y las tablas. */
export const ETIQUETAS_TIPO: Record<TipoReporte, string> = {
  serie_temporal: 'Serie temporal',
  resumen_por_zona: 'Resumen por zona',
  alertas: 'Alertas',
};

/** Definición de reporte tal como aparece en el listado. */
export interface ReporteResumen {
  /** Identificador del reporte. */
  idReporte: string;

  /** Clase de reporte. */
  tipoReporte: TipoReporte;

  /** Nombre de la zona, o `null` si abarca todas. */
  zona: string | null;

  /** Inicio del rango consultado, en ISO. */
  rangoInicio: string;

  /** Fin del rango consultado, en ISO. */
  rangoFin: string;

  /** Momento en que se guardó la definición, en ISO. */
  fechaGeneracion: string;
}

/** Reporte con sus datos ya calculados. */
export interface ReporteGenerado extends ReporteResumen {
  /** Cabeceras de la tabla, en orden. */
  columnas: string[];

  /** Filas de datos, alineadas con `columnas`. */
  filas: (string | number)[][];

  /** Número de filas. */
  total: number;
}

/** Cuerpo de la petición de creación. */
export interface CrearReporte {
  /** Clase de reporte solicitada. */
  tipoReporte: TipoReporte;

  /** Inicio del rango, en ISO. */
  rangoInicio: string;

  /** Fin del rango, en ISO. */
  rangoFin: string;

  /** Zona a la que se acota; omitida abarca todas. */
  idZona?: string;
}

/** Contenido de la exportación a CSV. */
export interface ExportacionCsv {
  /** Nombre de archivo sugerido. */
  nombreArchivo: string;

  /** Contenido completo del CSV, con BOM. */
  contenido: string;
}

/**
 * Servicio singleton de reportes.
 */
@Injectable({ providedIn: 'root' })
export class ReportesService {
  /** Cliente HTTP con los interceptores de auth y cifrado ya aplicados. */
  private http = inject(HttpClient);

  /** Guarda una definición y devuelve su primer cálculo. */
  crear(body: CrearReporte): Observable<ApiResponse<ReporteGenerado>> {
    return this.http.post<ApiResponse<ReporteGenerado>>(`${API_URL}/reportes`, body);
  }

  /** Definiciones guardadas, sin calcular sus datos. */
  listar(): Observable<ApiResponse<ReporteResumen[]>> {
    return this.http.get<ApiResponse<ReporteResumen[]>>(`${API_URL}/reportes`);
  }

  /** Recupera un reporte con sus datos recalculados. */
  obtener(id: string): Observable<ApiResponse<ReporteGenerado>> {
    return this.http.get<ApiResponse<ReporteGenerado>>(`${API_URL}/reportes/${id}`);
  }

  /** Elimina una definición guardada. */
  eliminar(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${API_URL}/reportes/${id}`);
  }

  /**
   * Descarga el reporte como CSV.
   *
   * Pide el contenido al backend y dispara la descarga en el navegador como
   * efecto lateral, de modo que el componente solo tiene que suscribirse.
   */
  descargarCsv(id: string): Observable<ApiResponse<ExportacionCsv>> {
    return this.http
      .get<ApiResponse<ExportacionCsv>>(`${API_URL}/reportes/${id}/csv`)
      .pipe(tap((res) => descargar(res.data.nombreArchivo, res.data.contenido)));
  }
}

/**
 * Provoca la descarga de un archivo de texto en el navegador.
 *
 * El enlace se crea, se pulsa y se retira sin llegar a mostrarse. La URL del
 * blob se libera después: sin `revokeObjectURL` el contenido quedaría retenido
 * en memoria hasta recargar la página, y un reporte grande no es pequeño.
 *
 * @param nombreArchivo - Nombre con el que se guarda.
 * @param contenido     - Texto completo del archivo.
 */
function descargar(nombreArchivo: string, contenido: string): void {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  URL.revokeObjectURL(url);
}
