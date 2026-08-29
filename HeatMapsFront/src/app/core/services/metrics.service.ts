/**
 * @file metrics.service.ts
 * @description Cliente de `/api/metrics`, la fuente de datos del dashboard.
 *
 * Todos los endpoints requieren autenticación; el {@link AuthInterceptor}
 * añade la cabecera y el {@link CryptoInterceptor} cifra los payloads.
 *
 * ## Origen de los datos
 * Las tarjetas de cabecera salen de `captura` (ventana reciente, «ahora
 * mismo»); la ocupación por zona y las series salen de `ocupacion_agregada`,
 * que el backend consolida en ventanas cerradas. Por eso el estado inmediato y
 * la ocupación por zona pueden diferir en unos minutos: no miden lo mismo.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl as API_URL } from '../config';

/** Envoltorio estándar de las respuestas de la API. */
export interface ApiResponse<T> {
  /** Siempre `true` en respuestas exitosas. */
  success: boolean;
  /** Carga útil de la respuesta. */
  data: T;
}

/** Tarjetas de cabecera del dashboard. */
export interface MetricsOverview {
  /**
   * MAC distintas vistas en la ventana reciente. No equivale al número de
   * personas: un mismo teléfono con MAC rotada puede contarse varias veces.
   */
  dispositivosAhora: number;

  /** Tramas capturadas en esa misma ventana, sumando todos los nodos. */
  detecciones: number;

  /**
   * Porcentaje de las MAC distintas que estaban aleatorizadas. Cuanto más
   * alto, menos fiable es `dispositivosAhora` como conteo.
   */
  porcentajeRandomizadas: number;

  /** Potencia media de las detecciones en dBm, o `null` si no hubo ninguna. */
  rssiPromedio: number | null;

  /** Número de zonas marcadas como activas. */
  zonasActivas: number;

  /** Nodos de captura registrados, emitan o no. */
  sensoresTotal: number;

  /** Nodos que han emitido dentro del margen considerado saludable. */
  sensoresEnLinea: number;

  /** Alertas de aglomeración todavía sin resolver. */
  alertasAbiertas: number;

  /** Minutos que abarca la ventana usada para los indicadores de «ahora». */
  ventanaMinutos: number;
}

/** Ocupación actual de una zona. */
export interface ZoneOccupancy {
  /** Identificador de la zona. */
  idZona: string;

  /** Nombre legible del espacio. */
  nombre: string;

  /** Aforo declarado, o `null` si la institución no lo ha fijado. */
  capacidadMax: number | null;

  /** MAC distintas en la última ventana consolidada. Techo del conteo. */
  dispositivosUnicos: number;

  /** Subconjunto con MAC de fabricante. Suelo fiable del conteo. */
  dispositivosEstables: number;

  /** RSSI medio de la zona en dBm. */
  rssiPromedio: number | null;

  /** Nivel derivado del conteo frente al aforo. */
  nivelOcupacion: 'baja' | 'media' | 'alta';

  /** Ocupación sobre el aforo en porcentaje, o `null` si no hay aforo. */
  porcentajeAforo: number | null;

  /** Cierre ISO de la ventana consolidada, o `null` si aún no hay ninguna. */
  actualizadoEn: string | null;
}

/** Punto de la serie temporal de ocupación. */
export interface OccupancyPoint {
  /** Inicio ISO de la ventana que representa el punto. */
  intervaloInicio: string;

  /** Zona a la que pertenece el punto. */
  idZona: string;

  /** MAC distintas contadas en la ventana. */
  dispositivosUnicos: number;

  /** MAC de fabricante contadas en la ventana. */
  dispositivosEstables: number;

  /** Nivel de ocupación asignado a la ventana. */
  nivelOcupacion: string;
}

/** Estado de un nodo de captura. */
export interface SensorHealth {
  /** Identificador que el propio nodo publica en Kafka. */
  idSensor: string;

  /** Nombre legible del nodo. */
  nombre: string;

  /** Zona a la que está asignado, o `null` si no se ha resuelto. */
  zona: string | null;

  /** Estado operativo: activo, inactivo o en mantenimiento. */
  estado: string;

  /** Marca ISO de la última lectura recibida, o `null` si nunca emitió. */
  ultimaConexion: string | null;

  /** Minutos transcurridos desde esa lectura, o `null` si nunca emitió. */
  minutosDesdeUltimaLectura: number | null;

  /** `true` si emitió dentro del margen considerado saludable. */
  enLinea: boolean;
}

/** Alerta de aglomeración abierta. */
export interface Alerta {
  /** Identificador de la alerta. */
  idAlerta: string;

  /** Zona en la que se detectó la aglomeración. */
  idZona: string;

  /** Gravedad asignada al levantarla. */
  nivel: 'advertencia' | 'critica';

  /** Texto descriptivo con el conteo y el aforo que la motivaron. */
  mensaje: string;

  /** Marca ISO del momento en que se levantó. */
  timestampAlerta: string;

  /** `false` mientras siga abierta. */
  resuelta: boolean;

  /** Zona embebida por el backend cuando la resuelve en la consulta. */
  zona?: { nombre: string };
}

/** Parámetros de sensado en vigor. */
export interface SensingParameters {
  /** Duración de la ventana de consolidación, en minutos. */
  ventanaAgregacionMinutos: number;

  /** Potencia de referencia a un metro, en dBm. */
  rssiReferencia: number;

  /** Exponente de atenuación del entorno usado al estimar distancias. */
  exponenteAtenuacion: number;
}

/**
 * Servicio singleton de lectura de métricas.
 */
@Injectable({ providedIn: 'root' })
export class MetricsService {
  /** Cliente HTTP con los interceptores de auth y cifrado ya aplicados. */
  private http = inject(HttpClient);

  /** Indicadores de cabecera. */
  overview(): Observable<ApiResponse<MetricsOverview>> {
    return this.http.get<ApiResponse<MetricsOverview>>(`${API_URL}/metrics/overview`);
  }

  /** Ocupación actual de cada zona activa. */
  zones(): Observable<ApiResponse<ZoneOccupancy[]>> {
    return this.http.get<ApiResponse<ZoneOccupancy[]>>(`${API_URL}/metrics/zones`);
  }

  /**
   * Serie temporal de ocupación.
   *
   * @param hours  - Horas hacia atrás (el backend la acota a 168).
   * @param zoneId - Filtra por zona; omitido devuelve todas.
   */
  occupancy(hours = 6, zoneId?: string): Observable<ApiResponse<OccupancyPoint[]>> {
    const zona = zoneId ? `&zoneId=${encodeURIComponent(zoneId)}` : '';
    return this.http.get<ApiResponse<OccupancyPoint[]>>(
      `${API_URL}/metrics/occupancy?hours=${hours}${zona}`
    );
  }

  /** Salud de la red de nodos de captura. */
  sensors(): Observable<ApiResponse<SensorHealth[]>> {
    return this.http.get<ApiResponse<SensorHealth[]>>(`${API_URL}/metrics/sensors`);
  }

  /** Alertas de aglomeración sin resolver. */
  alerts(): Observable<ApiResponse<Alerta[]>> {
    return this.http.get<ApiResponse<Alerta[]>>(`${API_URL}/metrics/alerts`);
  }

  /** Marca una alerta como resuelta. */
  resolveAlert(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${API_URL}/metrics/alerts/${id}/resolve`,
      {}
    );
  }

  /** Parámetros de sensado con los que se calcularon las métricas. */
  parameters(): Observable<ApiResponse<SensingParameters>> {
    return this.http.get<ApiResponse<SensingParameters>>(`${API_URL}/metrics/parameters`);
  }
}
