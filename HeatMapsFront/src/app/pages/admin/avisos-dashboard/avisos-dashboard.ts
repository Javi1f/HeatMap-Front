/**
 * @file avisos-dashboard.ts
 * @description Avisos de cabecera del panel: fallo de carga y estado de la red.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Aviso sobre el estado de la red de nodos. */
interface AvisoRed {
  readonly clase: string;
  readonly icono: string;
  readonly texto: string;
}

@Component({
  selector: 'app-avisos-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './avisos-dashboard.html',
  styleUrl: './avisos-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvisosDashboardComponent {
  /** Mensaje de error de la carga; vacío si fue bien. */
  readonly error = input<string>('');

  /** `true` si no hay ningún nodo registrado todavía. */
  readonly sinNodos = input<boolean>(false);

  /** `true` si hay nodos pero ninguno está emitiendo. */
  readonly redCaida = input<boolean>(false);

  /** Se emite al pulsar «Reintentar». */
  readonly reintentar = output<void>();

  /**
   * Aviso sobre la red, o `null` si no hay nada que advertir.
   *
   * Los dos estados se excluyen —sin nodos registrados o registrados pero
   * callados— y resolverlos aquí deja la plantilla con una sola pregunta.
   */
  readonly estadoRed = computed<AvisoRed | null>(() => {
    if (this.sinNodos()) {
      return {
        clase: 'alert-info',
        icono: 'sensors_off',
        texto: 'Todavía no hay nodos de captura registrados. Los nodos aparecen solos en cuanto'
             + ' publican su primera lectura en el bróker.',
      };
    }
    if (this.redCaida()) {
      return {
        clase: 'alert-error',
        icono: 'wifi_off',
        texto: 'Ningún nodo está emitiendo. Los conteos de abajo son los últimos conocidos:'
             + ' un cero significa «sin datos», no «espacio vacío».',
      };
    }
    return null;
  });
}

