/**
 * @file sensor-data.model.ts
 * @description Interfaces TypeScript que representan los datos emitidos por el
 * servidor a través del evento `sensor-data` de Socket.IO.
 *
 * Estas interfaces espejo exactamente el tipo `ProcessedSensorData` del backend
 * (módulo `sensor/services/data-processor.service.ts`). Si el backend modifica
 * la forma del payload, este archivo debe actualizarse en consecuencia.
 *
 * Todos los campos son `readonly` para garantizar inmutabilidad en el estado
 * de la UI y facilitar el tracking de cambios con Angular Signals.
 */

/**
 * Representa un dispositivo Wi-Fi individual detectado por un sensor.
 * Cada entrada corresponde a un dispositivo único identificado por su
 * dirección MAC dentro de una lectura de sensor.
 */
export interface SensorDevice {
  /**
   * Dirección MAC del dispositivo en formato `aa:bb:cc:dd:ee:ff`.
   * Si {@link randomized} es `true`, esta MAC es aleatorizada (Privacy MAC)
   * y no identifica de forma permanente al dispositivo físico.
   */
  readonly mac: string;

  /**
   * Received Signal Strength Indicator en dBm. Valores típicos:
   * - `>= -50` Excelente (muy cerca del sensor)
   * - `-50` a `-70` Buena
   * - `-70` a `-85` Aceptable
   * - `< -85` Débil (lejos o con obstáculos)
   */
  readonly rssi: number;

  /**
   * Canal Wi-Fi en el que se detectó el paquete (1–14 para 2.4 GHz,
   * 36–165 para 5 GHz).
   */
  readonly channel: number;

  /**
   * Tipo de trama detectada. Ejemplos:
   * - `"probe"` — Probe Request (el dispositivo busca redes conocidas)
   * - `"data"` — Trama de datos
   * - `"beacon"` — Beacon (normalmente de un AP, no un cliente)
   */
  readonly type: string;

  /** Número de paquetes capturados de este dispositivo en la lectura actual. */
  readonly packets: number;

  /**
   * Hora de la última trama capturada de este dispositivo,
   * en formato `HH:mm:ss` (hora local del sensor).
   */
  readonly last_seen: string;

  /**
   * `true` si la dirección MAC fue generada aleatoriamente por el sistema
   * operativo del dispositivo (MAC randomization / Privacy MAC).
   * Dispositivos modernos usan MACs aleatorias para proteger la privacidad.
   */
  readonly randomized: boolean;
}

/**
 * Payload completo del evento `sensor-data` emitido por el servidor Socket.IO.
 * Cada mensaje representa una lectura procesada de un único sensor, con el
 * agregado de todos los dispositivos detectados en ese instante.
 *
 * El {@link SocketService} recibe este objeto y lo propaga mediante el
 * observable `sensorData$`. El componente {@link PublicSection} lo consume
 * para actualizar la tabla en tiempo real.
 */
export interface SensorData {
  /**
   * Identificador único del sensor de hardware que generó la lectura.
   * Se usa como clave del mapa de lecturas en {@link PublicSection}.
   * Ejemplo: `"sensor-1"`, `"sensor-lab-a2"`.
   */
  readonly sensor_id: string;

  /**
   * Número total de dispositivos únicos detectados en esta lectura.
   * Equivale a `devices.length` pero viene precalculado por el backend.
   */
  readonly total_devices: number;

  /**
   * Hora legible de la lectura en formato `HH:mm:ss` (hora local del sensor).
   * Para ordenación o comparación precisa, usar {@link timestamp_raw}.
   */
  readonly timestamp: string;

  /**
   * Marca de tiempo Unix en segundos (epoch UTC).
   * Usar para ordenación, comparación de lecturas o cálculos de diferencia temporal.
   */
  readonly timestamp_raw: number;

  /** Bytes totales capturados por el sensor en esta lectura. */
  readonly bytes_received: number;

  /**
   * Lista de dispositivos individuales detectados en esta lectura.
   * El array es inmutable (`readonly`) para evitar mutaciones accidentales.
   */
  readonly devices: readonly SensorDevice[];

  /**
   * Marca de tiempo ISO 8601 de cuando el backend recibió y procesó el mensaje
   * del broker Kafka. Ej: `"2026-05-18T17:34:56.000Z"`.
   * Se usa en {@link PublicSection} para mostrar la hora de la última actualización.
   */
  readonly received_at: string;
}
