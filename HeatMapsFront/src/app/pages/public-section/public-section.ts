/**
 * @file public-section.ts
 * @description Sección pública de monitoreo de sensores en tiempo real (`/public`).
 *
 * Muestra una tabla que se actualiza automáticamente con los datos emitidos
 * por el backend a través de Socket.IO cada vez que llega una lectura del
 * broker Kafka. No requiere autenticación.
 *
 * ## Estrategia de actualización
 * Se mantiene un `Map<sensor_id, SensorData>` indexado por ID de sensor.
 * Cada mensaje de `sensor-data` sobreescribe la entrada del sensor correspondiente,
 * de modo que la tabla siempre muestra la **lectura más reciente por sensor**,
 * sin acumular histórico en memoria.
 *
 * ## Tabla expandible
 * La fila principal de cada sensor es clicable (también accesible por teclado)
 * y expande una sub-tabla con el detalle de todos los dispositivos detectados
 * en esa lectura. Solo un sensor puede estar expandido a la vez.
 *
 * ## Ciclo de vida de las suscripciones
 * Las suscripciones a `SocketService.sensorData$` y `connected$` se agrupan
 * en un único `Subscription` compuesto para simplificar el cleanup en `ngOnDestroy`.
 *
 * @see {@link SocketService} — fuente de los datos en tiempo real.
 * @see {@link SensorData} — forma del payload del evento `sensor-data`.
 */

import { Component, OnInit, OnDestroy, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SocketService } from '../../socket/socket.service';
import { SensorData, SensorDevice } from '../../socket/sensor-data.model';

/**
 * Componente de la sección pública de monitoreo de sensores.
 * Accesible sin autenticación; consume el WebSocket de {@link SocketService}.
 */
@Component({
  selector: 'app-public-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-section.html',
  styleUrl: './public-section.css',
})
export class PublicSection implements OnInit, OnDestroy {
  private readonly socketService = inject(SocketService);

  /**
   * Suscripciones compuestas a los observables del socket.
   * Se cancela completa en `ngOnDestroy` para evitar fugas de memoria.
   */
  private readonly subscriptions = new Subscription();

  /** `true` cuando el WebSocket está conectado al servidor. */
  readonly isConnected = signal<boolean>(false);

  /**
   * Fecha y hora de la última lectura recibida.
   * `null` mientras no se haya recibido ningún dato.
   */
  readonly lastUpdated = signal<Date | null>(null);

  /**
   * Mapa privado indexado por `sensor_id` con la última lectura de cada sensor.
   * Se actualiza en cada mensaje de `sensor-data`; los datos se acumulan por sensor
   * pero solo se guarda la lectura más reciente de cada uno.
   *
   * Privado: los componentes externos solo acceden a través de `sensorList`.
   */
  private readonly sensorMap = signal<ReadonlyMap<string, SensorData>>(new Map());

  /**
   * Lista ordenada de las últimas lecturas por sensor, derivada de `sensorMap`.
   * Se usa directamente en el `@for` del template para renderizar las filas.
   */
  readonly sensorList = computed(() => Array.from(this.sensorMap().values()));

  /**
   * ID del sensor cuya fila de dispositivos está actualmente expandida.
   * `null` cuando ninguna fila está expandida.
   * Solo un sensor puede estar expandido a la vez.
   */
  readonly expandedSensorId = signal<string | null>(null);

  ngOnInit(): void {
    // Suscribirse al estado de conexión del WebSocket
    this.subscriptions.add(
      this.socketService.connected$.subscribe(connected => {
        this.isConnected.set(connected);
      })
    );

    // Suscribirse al flujo de datos de sensores
    this.subscriptions.add(
      this.socketService.sensorData$.subscribe(data => {
        // Sobreescribir la entrada del sensor con la lectura más reciente
        this.sensorMap.update(map => new Map(map).set(data.sensor_id, data));
        this.lastUpdated.set(new Date(data.received_at));
      })
    );
  }

  /**
   * Alterna la expansión de la fila de dispositivos de un sensor.
   * Si el sensor ya estaba expandido, lo colapsa. Solo uno puede estar abierto.
   *
   * @param sensorId - ID del sensor cuya fila se quiere expandir/colapsar.
   */
  toggleExpand(sensorId: string): void {
    this.expandedSensorId.update(id => (id === sensorId ? null : sensorId));
  }

  /**
   * Comprueba si la fila de dispositivos de un sensor está expandida.
   *
   * @param sensorId - ID del sensor a verificar.
   * @returns `true` si la fila del sensor está expandida.
   */
  isExpanded(sensorId: string): boolean {
    return this.expandedSensorId() === sensorId;
  }

  /**
   * Formatea un número de bytes a una cadena legible con la unidad apropiada.
   *
   * @param bytes - Número de bytes a formatear.
   * @returns Cadena con la unidad: `"1023 B"`, `"1.5 KB"`, `"2.34 MB"`, etc.
   */
  formatBytes(bytes: number): string {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1_048_576)  return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(2)} MB`;
  }

  /**
   * Calcula el RSSI promedio de todos los dispositivos de una lectura.
   *
   * @param data - Lectura del sensor con la lista de dispositivos.
   * @returns El RSSI promedio redondeado al entero más cercano,
   *          o `null` si la lectura no contiene dispositivos.
   */
  averageRssi(data: SensorData): number | null {
    if (data.devices.length === 0) return null;
    const sum = data.devices.reduce((acc: number, d: SensorDevice) => acc + d.rssi, 0);
    return Math.round(sum / data.devices.length);
  }

  /**
   * Devuelve la clase CSS de calidad para un valor RSSI dado.
   * Las clases están definidas en `public-section.css` y aplican colores distintivos.
   *
   * | Rango dBm     | Clase CSS        | Calidad    |
   * |---------------|------------------|------------|
   * | `>= -50`      | `rssi-excellent` | Excelente  |
   * | `-50` a `-70` | `rssi-good`      | Buena      |
   * | `-70` a `-85` | `rssi-fair`      | Aceptable  |
   * | `< -85`       | `rssi-poor`      | Débil      |
   *
   * @param rssi - Valor RSSI en dBm (número negativo).
   * @returns Nombre de la clase CSS correspondiente a la calidad de la señal.
   */
  rssiClass(rssi: number): string {
    if (rssi >= -50) return 'rssi-excellent';
    if (rssi >= -70) return 'rssi-good';
    if (rssi >= -85) return 'rssi-fair';
    return 'rssi-poor';
  }

  /** Cancela todas las suscripciones al socket para evitar fugas de memoria. */
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
