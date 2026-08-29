/**
 * @file metric-card.ts
 * @description Tarjeta de un indicador del dashboard.
 *
 * Es puramente presentacional: recibe el valor ya formateado por el padre y no
 * consulta nada. Mantenerla tonta permite reutilizarla para métricas de
 * naturaleza muy distinta (conteos, porcentajes, dBm) sin que la tarjeta tenga
 * que saber de dónde sale cada una.
 */

import { Component, Input } from '@angular/core';

/** Intención visual de la tarjeta, que tiñe el icono y el borde. */
export type MetricTone = 'neutral' | 'ok' | 'warn' | 'danger';

/**
 * Tarjeta de un indicador del dashboard.
 */
@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [],
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.css'
})
export class MetricCardComponent {
  /** Nombre del indicador. */
  @Input({ required: true }) label!: string;

  /** Valor ya formateado, incluida su unidad si la tiene. */
  @Input({ required: true }) value!: string;

  /** Icono de Material Icons que acompaña al indicador. */
  @Input({ required: true }) icon!: string;

  /**
   * Aclaración de qué mide exactamente el número.
   *
   * No es decorativa: un conteo de dispositivos no es un conteo de personas, y
   * la diferencia debe estar visible junto al dato, no enterrada en la
   * documentación.
   */
  @Input() hint = '';

  /** Intención visual. Por defecto neutra. */
  @Input() tone: MetricTone = 'neutral';
}
