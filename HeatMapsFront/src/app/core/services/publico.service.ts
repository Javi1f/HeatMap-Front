/**
 * @file publico.service.ts
 * @description Cliente de `/api/publico`: lo que cualquiera puede consultar sin
 * iniciar sesión.
 *
 * ## Qué trae y qué no
 * Solo ocupación agregada por celda y la geometría del espacio. Ninguna
 * respuesta de este servicio contiene direcciones MAC —ni siquiera
 * anonimizadas—, identificadores de dispositivo, medidas por dispositivo ni
 * identificadores internos de los nodos. Esa garantía la sostiene el backend,
 * que construye la respuesta pública campo a campo en lugar de recortar la
 * interna.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl as API_URL } from '../config';
import { MapaDibujable } from '../models/mapa.model';

/** Envoltorio estándar de las respuestas de la API. */
export interface RespuestaPublica<T> {
  /** Siempre `true` en respuestas correctas. */
  success: boolean;
  /** Carga útil. */
  data: T;
}

/**
 * Etiquetas de cada nivel de ocupación.
 *
 * Hablan de dispositivos y no de personas porque es lo único que el sistema
 * mide. Decir «poca gente» daría por contado un salto —de aparato a persona—
 * que aquí nadie ha dado.
 */
const ETIQUETA_NIVEL: Record<string, string> = {
  baja: 'Pocos dispositivos',
  media: 'Bastantes dispositivos',
  alta: 'Muchos dispositivos',
  'sin datos': 'Sin datos',
};

/** Texto legible de un nivel de ocupación. */
export const etiquetaNivel = (nivel: string): string => ETIQUETA_NIVEL[nivel] ?? nivel;

/**
 * Clase CSS de un nivel de ocupación.
 *
 * El nivel llega como `sin datos`, con espacio, y un atributo `class` se parte
 * por los espacios: componerlo tal cual daba dos clases sueltas (`nivel-sin` y
 * `datos`) y ninguna regla llegaba a aplicarse, así que el distintivo salía
 * transparente y con el borde en blanco.
 */
export const claseNivel = (nivel: string): string => `nivel-${nivel.replace(/\s+/g, '-')}`;

/** Espacio consultable desde la vista pública. */
export interface ZonaPublica {
  /** Identificador de la zona, necesario para pedir su mapa. */
  idZona: string;

  /** Nombre del espacio. */
  nombre: string;

  /** Descripción breve, si la tiene. */
  descripcion: string | null;

  /**
   * Nivel de ocupación de la última ventana consolidada.
   *
   * Llega como categoría y no como número: sirve para decidir a qué espacio ir,
   * y un conteo exacto daría una precisión que la estimación por RSSI no tiene.
   */
  nivelOcupacion: 'baja' | 'media' | 'alta' | 'sin datos';
}

/** Mapa de ocupación de un espacio, sin datos de dispositivo. */
export interface MapaPublico extends MapaDibujable {
  /** Minutos que abarca la ventana representada. */
  ventanaMinutos: number;

  /** Fin de la ventana, en ISO. */
  hasta: string;
}

/**
 * Servicio singleton de la vista pública.
 *
 * No añade cabecera de autenticación: sus rutas no la piden. El interceptor de
 * cifrado sí actúa, igual que en el resto de la API.
 */
@Injectable({ providedIn: 'root' })
export class PublicoService {
  /** Cliente HTTP con el interceptor de cifrado aplicado. */
  private http = inject(HttpClient);

  /** Espacios que se pueden consultar. */
  zonas(): Observable<RespuestaPublica<ZonaPublica[]>> {
    return this.http.get<RespuestaPublica<ZonaPublica[]>>(`${API_URL}/publico/zonas`);
  }

  /**
   * Mapa de ocupación de un espacio.
   *
   * @param zonaId  - Espacio a representar.
   * @param minutos - Ventana hacia atrás desde ahora.
   */
  mapa(zonaId: string, minutos = 5): Observable<RespuestaPublica<MapaPublico>> {
    return this.http.get<RespuestaPublica<MapaPublico>>(
      `${API_URL}/publico/mapa?zonaId=${encodeURIComponent(zonaId)}&minutos=${minutos}`
    );
  }
}
