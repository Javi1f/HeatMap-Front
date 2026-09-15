/**
 * @file dashboard.ts
 * @description Panel de métricas de ocupación (`/admin/dashboard`).
 *
 * Sustituye al antiguo dashboard, que gestionaba la lista blanca de correos y
 * ahora vive en `/admin/users`. Aquí se muestra lo que el sistema realmente
 * produce: ocupación por zona, salud de la red de nodos y
 * aglomeración.
 *
 * ## De dónde sale cada dato
 *
 * | Bloque                | Origen                                  |
 * |-----------------------|-----------------------------------------|
 * | Tarjetas de cabecera  | `captura` en la ventana reciente        |
 * | Ocupación por zona    | `ocupacion_agregada` (última ventana)   |
 * | Salud de nodos        | `sensor.ultimaConexion`                 |
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
  MetricsOverview,
  MetricsService,
  SensingParameters,
  SensorHealth,
  ZoneOccupancy,
} from '../../../core/services/metrics.service';
import { AvisosDashboardComponent } from '../avisos-dashboard/avisos-dashboard';
import { IndicadoresDashboardComponent } from '../indicadores-dashboard/indicadores-dashboard';
import { TablaZonasComponent } from '../tabla-zonas/tabla-zonas';
import { TablaNodosComponent } from '../tabla-nodos/tabla-nodos';
import { describeHttpError } from '../../../core/http-error';
import { SocketService } from '../../../socket/socket.service';
import { crearLimitador } from '../../../core/limitar-frecuencia';
import { Subscription } from 'rxjs';

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

/** Intervalo mínimo entre recargas provocadas por lecturas en vivo, en milisegundos. */
const RECARGA_EN_VIVO_MS = 2_000;

/**
 * Componente del dashboard de métricas.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    AvisosDashboardComponent,
    IndicadoresDashboardComponent,
    TablaZonasComponent,
    TablaNodosComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, OnDestroy {
  /** Origen de todos los bloques de esta pantalla. */
  private metricsService = inject(MetricsService);

  /** Identificador del temporizador de refresco. */
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  /** Lecturas en vivo del WebSocket. */
  private readonly socketService = inject(SocketService);

  /** Suscripción a las lecturas, que se cierra al salir. */
  private lecturas: Subscription | null = null;

  /**
   * Recarga el panel como mucho cada {@link RECARGA_EN_VIVO_MS} al llegar
   * lecturas: el sondeo de 60 s solo no reflejaría los cambios en 5 s.
   */
  private recargarEnVivo = crearLimitador(RECARGA_EN_VIVO_MS);

  /** Indicadores de cabecera. `null` mientras no haya llegado la primera carga. */
  overview = signal<MetricsOverview | null>(null);

  /** Ocupación actual de cada zona activa. */
  zones = signal<ZoneOccupancy[]>([]);

  /** Estado de cada nodo de captura. */
  sensors = signal<SensorHealth[]>([]);

  /** Parámetros de sensado con los que se calcularon las métricas. */
  parameters = signal<SensingParameters | null>(null);

  /** `true` durante la primera carga; los refrescos posteriores son silenciosos. */
  isLoading = signal<boolean>(true);

  /** Mensaje de error de la carga, vacío si todo fue bien. */
  error = signal<string>('');

  /** Momento de la última actualización correcta. */
  lastUpdated = signal<Date | null>(null);

  /**
   * `true` cuando no hay ningún nodo emitiendo.
   *
   * Se destaca en la UI porque cambia cómo hay que leer el resto: con la red
   * caída, los ceros de ocupación significan «no se sabe», no «vacío».
   */
  redCaida = computed(() => {
    const resumen = this.overview();
    return resumen !== null && resumen.sensoresTotal > 0 && resumen.sensoresEnLinea === 0;
  });

  /** `true` si no hay ningún nodo registrado todavía. */
  sinNodos = computed(() => this.overview()?.sensoresTotal === 0);

  /** Carga inicial y arranque del sondeo periodico. */
  ngOnInit(): void {
    this.loadAll();
    this.refreshTimer = setInterval(() => this.loadAll(true), REFRESH_INTERVAL_MS);
    this.lecturas = this.socketService.sensorData$.subscribe(() =>
      this.recargarEnVivo(() => this.loadAll(true)),
    );
  }

  /**
   * Detiene el sondeo al salir de la pantalla; sin esto el intervalo seguiria
   * pidiendo metricas de un componente ya destruido.
   */
  ngOnDestroy(): void {
    if (this.refreshTimer !== null) clearInterval(this.refreshTimer);
    this.lecturas?.unsubscribe();
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

    if (this.parameters() === null) {
      this.metricsService.parameters().subscribe({ next: (res) => this.parameters.set(res.data) });
    }
  }

  /** Texto de la ventana de agregación para la cabecera de la sección. */
  ventanaTexto = computed(() => {
    const parametros = this.parameters();
    return parametros ? `${parametros.ventanaAgregacionMinutos} min` : '—';
  });

  /**
   * Pie con los parámetros de sensado.
   *
   * Se compone aquí y no en la plantilla para que el texto quede en un solo
   * sitio, con su advertencia incluida.
   */
  pieParametros = computed(() => {
    const parametros = this.parameters();
    if (!parametros) return '';
    return `Distancia estimada con RSSI₀ = ${parametros.rssiReferencia} dBm`
         + ` y n = ${parametros.exponenteAtenuacion}.`
         + ' Estos valores requieren calibración por espacio; hasta entonces las distancias'
         + ' son orientativas.';
  });
}

