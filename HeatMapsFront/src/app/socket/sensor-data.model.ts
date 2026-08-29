/**
 * @file sensor-data.model.ts
 * @description Forma del evento `sensor-data` que emite el servidor.
 *
 * ## Solo un resumen
 * El canal de Socket.IO no exige autenticación: cualquiera que abra una
 * conexión recibe lo que se emita. Por eso el servidor difunde el conteo por
 * nodo y **nunca** el detalle de los dispositivos detectados. Publicar sus
 * direcciones permitiría a cualquier visitante seguir a una persona por el
 * espacio.
 *
 * Si alguna vez este tipo necesita crecer, comprueba antes que el campo nuevo
 * no identifique a nadie: lo que se declare aquí es lo que el mundo puede leer.
 */

/** Resumen de una lectura de un nodo de captura. */
export interface ResumenSensor {
  /**
   * Identificador del nodo que emitió la lectura.
   * Se usa como clave para quedarse con su conteo más reciente.
   */
  readonly sensor_id: string;

  /** Dispositivos distintos detectados en esa lectura. */
  readonly total_devices: number;

  /** Hora legible de la lectura, en formato `HH:mm:ss`. */
  readonly timestamp: string;

  /** Momento en que el backend la recibió, en ISO 8601. */
  readonly received_at: string;
}
