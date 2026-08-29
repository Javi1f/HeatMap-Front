/**
 * @file dashboard.ts
 * @description Panel de métricas de ocupación (`/admin/dashboard`).
 *
 * Sustituye al antiguo dashboard, que gestionaba la lista blanca de correos y
 * ahora vive en `/admin/users`. Aquí se muestra lo que el sistema realmente
 * produce: ocupación por zona, salud de la red de nodos y alertas de
 * aglomeración.
 *
 * ## De dónde sale cada dato
 *
 * | Bloque                | Origen                                  |
 * |-----------------------|-----------------------------------------|
 * | Tarjetas de cabecera  | `captura` en la ventana reciente        |
 * | Ocupación por zona    | `ocupacion_agregada` (última ventana)   |
 * | Salud de nodos        | `sensor.ultimaConexion`                 |
 * | Alertas               | `alerta` sin resolver                   |
 *
 * Las tarjetas y la tabla de zonas **no miden lo mismo**: las primeras
 * describen los últimos minutos leyendo detecciones crudas, la segunda la
 * última ventana ya consolidada. Pueden diferir, y por eso cada bloque indica
 * su propia marca temporal.
 *
 * ## Refresco
 * Sondeo cada {@link REFRESH_INTERVAL_MS}. No se usa el WebSocket de sensores
 * porque estas cifras son agregados sobre la base de datos, no el flujo crudo
 * que consume la sección pública.
 *
 * ## Acceso
 * Requiere autenticación; protegido por {@link authGuard} en las rutas.
 */

import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Alerta,
  MetricsOverview,
  MetricsService,
  SensingParameters,
  SensorHealth,
  ZoneOccupancy,
} from '../../../core/services/metrics.service';
import { MetricCardComponent, MetricTone } from './metric-card';
import { describeHttpError } from '../../../core/http-error';

/**
 * Periodo de refresco de las métricas, en milisegundos.
 *
 * Un minuto es holgado a propósito: la ocupación por zona procede de ventanas
 * que el backend consolida cada cinco minutos, así que pedirla más a menudo
 * devuelve exactamente los mismos números y solo gasta cuota del limitador.
 * Los indicadores de «ahora» sí cambian de forma continua, y con este periodo
 * siguen siendo suficientemente frescos.
 */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * Componente del dashboard de métricas.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MetricCardComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, OnDestroy {
  /** Origen de todos los bloques de esta pantalla. */
  private metricsService = inject(MetricsService);

  /** Identificador del temporizador de refresco. */
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  /** Indicadores de cabecera. `null` mientras no haya llegado la primera carga. */
  overview = signal<MetricsOverview | null>(null);

  /** Ocupación actual de cada zona activa. */
  zones = signal<ZoneOccupancy[]>([]);

  /** Estado de cada nodo de captura. */
  sensors = signal<SensorHealth[]>([]);

  /** Alertas de aglomeración abiertas. */
  alerts = signal<Alerta[]>([]);

  /** Parámetros de sensado con los que se calcularon las métricas. */
  parameters = signal<SensingParameters | null>(null);

  /** `true` durante la primera carga; los refrescos posteriores son silenciosos. */
  isLoading = signal<boolean>(true);

  /** Mensaje de error de la carga, vacío si todo fue bien. */
  error = signal<string>('');

  /** Id de la alerta que se está resolviendo, para el spinner de su fila. */
  resolvingAlertId = signal<string | null>(null);

  /** Momento de la última actualización correcta. */
  lastUpdated = signal<Date | null>(null);

  /**
   * `true` cuando no hay ningún nodo emitiendo.
   *
   * Se destaca en la UI porque cambia cómo hay que leer el resto: con la red
   * caída, los ceros de ocupación significan «no se sabe», no «vacío».
   */
  redCaida = computed(() => {
    const o = this.overview();
    return o !== null && o.sensoresTotal > 0 && o.sensoresEnLinea === 0;
  });

  /** `true` si no hay ningún nodo registrado todavía. */
  sinNodos = computed(() => this.overview()?.sensoresTotal === 0);

  /** Carga inicial y arranque del sondeo periodico. */
  ngOnInit(): void {
    this.loadAll();
    this.refreshTimer = setInterval(() => this.loadAll(true), REFRESH_INTERVAL_MS);
  }

  /**
   * Detiene el sondeo al salir de la pantalla; sin esto el intervalo seguiria
   * pidiendo metricas de un componente ya destruido.
   */
  ngOnDestroy(): void {
    if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
  }

  /**
   * Carga todos los bloques del dashboard.
   *
   * @param silent - `true` en los refrescos automáticos, para no mostrar el
   *   spinner ni borrar los datos ya visibles mientras llega la respuesta.
   */
  loadAll(silent = false): void {
    if (!silent) {
      this.isLoading.set(true);
      this.error.set('');
    }

    this.metricsService.overview().subscribe({
      next: (res) => {
        this.overview.set(res.data);
        this.lastUpdated.set(new Date());
        this.isLoading.set(false);
        this.error.set('');
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudieron cargar las métricas.'));
        this.isLoading.set(false);
      }
    });

    this.metricsService.zones().subscribe({ next: (res) => this.zones.set(res.data) });
    this.metricsService.sensors().subscribe({ next: (res) => this.sensors.set(res.data) });
    this.metricsService.alerts().subscribe({ next: (res) => this.alerts.set(res.data) });

    if (this.parameters() === null) {
      this.metricsService.parameters().subscribe({ next: (res) => this.parameters.set(res.data) });
    }
  }

  /** Marca una alerta como resuelta y la retira de la lista. */
  resolveAlert(alerta: Alerta): void {
    this.resolvingAlertId.set(alerta.idAlerta);

    this.metricsService.resolveAlert(alerta.idAlerta).subscribe({
      next: () => {
        this.alerts.update(list => list.filter(a => a.idAlerta !== alerta.idAlerta));
        this.resolvingAlertId.set(null);
        this.loadAll(true);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudo resolver la alerta.'));
        this.resolvingAlertId.set(null);
      }
    });
  }

  /**
   * Tono de la tarjeta de nodos en línea.
   *
   * Ninguno en línea es un fallo (rojo); alguno caído, un aviso; todos
   * emitiendo, correcto.
   */
  sensorTone(): MetricTone {
    const o = this.overview();
    if (!o || o.sensoresTotal === 0) return 'neutral';
    if (o.sensoresEnLinea === 0) return 'danger';
    return o.sensoresEnLinea < o.sensoresTotal ? 'warn' : 'ok';
  }

  /** Tono de la tarjeta de alertas: cualquier alerta abierta es un aviso. */
  alertTone(): MetricTone {
    return (this.overview()?.alertasAbiertas ?? 0) > 0 ? 'warn' : 'ok';
  }

  /**
   * Tono de la tarjeta de MAC aleatorizadas.
   *
   * Un porcentaje muy alto degrada la fiabilidad del conteo: cada MAC rotada
   * puede contarse como un dispositivo distinto, así que el número de
   * dispositivos únicos se infla.
   */
  randomTone(): MetricTone {
    const pct = this.overview()?.porcentajeRandomizadas ?? 0;
    if (pct >= 80) return 'warn';
    return 'neutral';
  }

  /** Clase CSS de la barra de aforo según el nivel de ocupación. */
  levelClass(nivel: string): string {
    return `level-${nivel}`;
  }

  /**
   * Anchura de la barra de aforo, acotada al 100 % para que un exceso de
   * ocupación no desborde la celda.
   */
  aforoWidth(zone: ZoneOccupancy): number {
    return Math.min(zone.porcentajeAforo ?? 0, 100);
  }

  /** Formatea un valor que puede no existir todavía. */
  fmt(value: number | null | undefined, suffix = ''): string {
    if (value === null || value === undefined) return '—';
    return `${value}${suffix}`;
  }
}
