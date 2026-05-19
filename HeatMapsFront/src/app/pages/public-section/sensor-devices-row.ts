/**
 * @file sensor-devices-row.ts
 * @description Componente de fila de dispositivos expandida en la tabla de sensores.
 *
 * Renderiza la celda `<td colspan="6">` con la sub-tabla de dispositivos
 * detectados por un sensor en su última lectura. Se aplica como atributo
 * (`[appSensorDevicesRow]`) sobre el `<tr class="devices-row">` definido
 * en el template del componente padre, manteniendo así la estructura semántica
 * correcta del DOM de tabla.
 *
 * ## Responsabilidad
 * Aísla la sub-tabla de dispositivos (con su propio `@for` y `@if`/`@else`)
 * del template principal de {@link PublicSection}, reduciendo la complejidad
 * ciclomática de dicho template.
 *
 * @see {@link PublicSection} — componente padre que controla la expansión.
 * @see {@link SensorData} — forma del payload que recibe como `@Input`.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensorData } from '../../socket/sensor-data.model';

/**
 * Devuelve la clase CSS de calidad para un valor RSSI dado.
 * Función local para evitar dependencia circular con `public-section.ts`.
 *
 * @param rssi - Valor RSSI en dBm.
 * @returns Nombre de la clase CSS: `rssi-excellent` | `rssi-good` | `rssi-fair` | `rssi-poor`.
 */
function rssiClass(rssi: number): string {
  if (rssi >= -50) return 'rssi-excellent';
  if (rssi >= -70) return 'rssi-good';
  if (rssi >= -85) return 'rssi-fair';
  return 'rssi-poor';
}

/**
 * Componente de fila expandida (selector de atributo) para la sub-tabla de dispositivos.
 *
 * Uso en el template padre:
 * ```html
 * @if (isExpanded(sensor.sensor_id)) {
 *   <tr class="devices-row" appSensorDevicesRow [sensor]="sensor"></tr>
 * }
 * ```
 */
@Component({
  selector: '[appSensorDevicesRow]',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sensor-devices-row.html'
})
export class SensorDevicesRowComponent {
  /** Lectura del sensor cuya lista de dispositivos se muestra en esta fila. */
  @Input() sensor!: SensorData;

  /**
   * Puente de plantilla para la función de utilidad {@link rssiClass}.
   * Expone la función pura de módulo al contexto del template del componente.
   */
  readonly rssiClass = rssiClass;
}
