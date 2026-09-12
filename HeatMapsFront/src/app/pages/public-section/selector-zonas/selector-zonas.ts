/**
 * @file selector-zonas.ts
 * @description Pastillas para cambiar de espacio en la sección pública.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ZonaPublica, claseNivel } from '../../../core/services/publico.service';

/** Una pastilla, ya resuelta. */
interface Opcion {
  readonly idZona: string;
  readonly nombre: string;
  readonly claseNivel: string;
  readonly activa: boolean;
}

@Component({
  selector: 'app-selector-zonas',
  standalone: true,
  imports: [],
  templateUrl: './selector-zonas.html',
  styleUrl: './selector-zonas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorZonasComponent {
  /** Espacios entre los que elegir. */
  readonly zonas = input.required<ZonaPublica[]>();

  /** Identificador del espacio mostrado ahora mismo. */
  readonly seleccionada = input<string>('');

  /** Se emite con el identificador del espacio elegido. */
  readonly seleccionar = output<string>();

  /** Pastillas listas para recorrer. */
  readonly opciones = computed<Opcion[]>(() =>
    this.zonas().map((zona) => ({
      idZona: zona.idZona,
      nombre: zona.nombre,
      claseNivel: claseNivel(zona.nivelOcupacion),
      activa: zona.idZona === this.seleccionada(),
    })),
  );
}
