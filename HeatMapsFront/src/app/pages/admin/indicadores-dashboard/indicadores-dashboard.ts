/**
 * @file indicadores-dashboard.ts
 * @description Tarjetas de cabecera del panel.
 *
 * Las cinco se describen como datos y se recorren con un único bucle, en lugar
 * de repetir cinco veces el mismo marcado con distintos textos.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MetricCardComponent, MetricTone } from '../dashboard/metric-card';
import { MetricsOverview } from '../../../core/services/metrics.service';

/** Una tarjeta, ya resuelta. */
interface Tarjeta {
  readonly label: string;
  readonly value: string;
  readonly icon: string;
  readonly tone: MetricTone;
  readonly hint: string;
}

/** Formatea un valor que puede no existir todavía. */
const fmt = (valor: number | null | undefined, sufijo = ''): string =>
  valor === null || valor === undefined ? '—' : `${valor}${sufijo}`;

/**
 * Tono de la tarjeta de nodos.
 *
 * Ninguno en línea es un fallo; alguno caído, un aviso; todos emitiendo,
 * correcto.
 */
const tonoNodos = (resumen: MetricsOverview): MetricTone => {
  if (resumen.sensoresTotal === 0) return 'neutral';
  if (resumen.sensoresEnLinea === 0) return 'danger';
  return resumen.sensoresEnLinea < resumen.sensoresTotal ? 'warn' : 'ok';
};

@Component({
  selector: 'app-indicadores-dashboard',
  standalone: true,
  imports: [MetricCardComponent],
  templateUrl: './indicadores-dashboard.html',
  styleUrl: './indicadores-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicadoresDashboardComponent {
  /** Indicadores de cabecera tal como los devuelve la API. */
  readonly resumen = input.required<MetricsOverview>();

  /**
   * Las cinco tarjetas, listas para recorrer.
   *
   * La de MAC aleatorizadas se marca como aviso a partir del 80 %: por encima
   * de ese punto el conteo de únicos deja de ser fiable, porque cada dirección
   * rotada puede contarse como un dispositivo distinto.
   */
  readonly tarjetas = computed<Tarjeta[]>(() => {
    const metricas = this.resumen();
    return [
      {
        label: 'Dispositivos ahora',
        value: metricas.dispositivosAhora.toString(),
        icon: 'smartphone',
        tone: 'neutral',
        hint: `Presentes en los últimos ${metricas.ventanaMinutos} min, sin puntos de acceso ni señales de fuera. No equivale a personas.`,
      },
      {
        label: 'Detecciones',
        value: metricas.detecciones.toString(),
        icon: 'graphic_eq',
        tone: 'neutral',
        hint: 'Todas las tramas capturadas en la ventana, sin filtrar',
      },
      {
        label: 'MAC aleatorizadas',
        value: `${metricas.porcentajeRandomizadas} %`,
        icon: 'shuffle',
        tone: metricas.porcentajeRandomizadas >= 80 ? 'warn' : 'neutral',
        hint: 'Cuanto más alto, más se infla el conteo de únicos',
      },
      {
        label: 'RSSI medio',
        value: fmt(metricas.rssiPromedio, ' dBm'),
        icon: 'network_check',
        tone: 'neutral',
        hint: 'Potencia media de los dispositivos presentes',
      },
      {
        label: 'Nodos en línea',
        value: `${metricas.sensoresEnLinea} / ${metricas.sensoresTotal}`,
        icon: 'router',
        tone: tonoNodos(metricas),
        hint: 'Nodos que han emitido en los últimos minutos',
      },
    ];
  });
}

