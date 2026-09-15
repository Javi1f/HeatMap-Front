/**
 * @file cabecera-lugar.ts
 * @description Nombre del espacio y su distintivo de ocupación.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ZonaPublica, claseNivel, etiquetaNivel } from '../../../core/services/publico.service';

/** Distintivo de nivel, ya resuelto. */
interface NivelVista {
  readonly clase: string;
  readonly etiqueta: string;
}

/** Cabecera del espacio seleccionado: nombre, descripción y nivel de ocupación. */
@Component({
  selector: 'app-cabecera-lugar',
  standalone: true,
  imports: [],
  templateUrl: './cabecera-lugar.html',
  styleUrl: './cabecera-lugar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabeceraLugarComponent {
  /** Espacio que se está mostrando. */
  readonly zona = input.required<ZonaPublica>();

  /**
   * Dispositivos ya situados en el plano.
   *
   * Decide si el distintivo se calla: ver más abajo.
   */
  readonly situados = input<number>(0);

  /**
   * Distintivo de nivel, o `null` si no procede mostrarlo.
   *
   * Se calla cuando diría «Sin datos» habiendo mapa con detecciones: el nivel
   * sale de las ventanas ya consolidadas y el mapa de lo captado hace un rato,
   * así que al arrancar puede haber manchas y todavía ningún nivel, y el
   * distintivo contradiría al mapa que tiene al lado.
   */
  readonly nivel = computed<NivelVista | null>(() => {
    const valor = this.zona().nivelOcupacion;
    if (valor === 'sin datos' && this.situados() > 0) return null;
    return { clase: claseNivel(valor), etiqueta: etiquetaNivel(valor) };
  });
}
