/**
 * @file fondo-radar.ts
 * @description Fondo de toda la aplicación: un radar que barre la pantalla.
 *
 * El centro del radar está en la esquina inferior derecha, fuera de la vista.
 * Desde ahí salen anillos y radios que cruzan la página, un haz recorre el
 * cuarto visible de izquierda a arriba, y los ecos —puntos de dispositivos—
 * se encienden cuando el haz pasa sobre ellos y se apagan despacio.
 *
 * Es decorativo: no recibe eventos ni lo anuncian los lectores de pantalla.
 * Con «reducir movimiento» el haz desaparece y los ecos quedan quietos.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Ángulo del haz al empezar y al terminar cada pasada, en grados horarios desde arriba. */
export const BARRIDO_DESDE = 255;
export const BARRIDO_HASTA = 372;

/** Segundos que tarda el haz en cruzar la pantalla. */
export const PERIODO_S = 12;

/** Eco del fondo, ya situado. */
export interface EcoFondo {
  /** Distancia al borde derecho. */
  derecha: string;
  /** Distancia al borde inferior. */
  abajo: string;
  /** Diámetro en píxeles. */
  tam: number;
  /** Segundos hasta que el haz lo alcanza. */
  retraso: number;
  /** Tono del eco. */
  tono: 'primario' | 'ambar' | 'rojo';
}

/**
 * Sitúa un eco por su dirección desde el centro del radar (grados horarios
 * desde arriba, entre 270 —a la izquierda— y 360 —arriba—) y su distancia en
 * `vmax`, y calcula cuándo lo alcanza el haz.
 */
export const ecoFondo = (angulo: number, distancia: number, tam: number, tono: EcoFondo['tono'] = 'primario'): EcoFondo => {
  const rad = (angulo * Math.PI) / 180;
  /** Distancia en `vmax` con dos decimales. */
  const redondear = (valor: number): string => `${Math.round(valor * 100) / 100}vmax`;
  return {
    derecha: redondear(-Math.sin(rad) * distancia),
    abajo: redondear(Math.cos(rad) * distancia),
    tam,
    retraso: Math.round(((angulo - BARRIDO_DESDE) / (BARRIDO_HASTA - BARRIDO_DESDE)) * PERIODO_S * 100) / 100,
    tono,
  };
};

/**
 * Ecos del fondo: sueltos, en parejas y en un par de grupos, como los que
 * dibuja el mapa. Las distancias cubren desde cerca de la esquina hasta el
 * extremo opuesto de una pantalla ancha.
 */
const ECOS: readonly EcoFondo[] = [
  ecoFondo(274, 38, 7),
  ecoFondo(276, 40, 5, 'ambar'),
  ecoFondo(281, 72, 6),
  ecoFondo(288, 22, 5, 'ambar'),
  ecoFondo(293, 96, 8, 'rojo'),
  ecoFondo(295, 99, 6),
  ecoFondo(297, 95, 5),
  ecoFondo(304, 55, 6),
  ecoFondo(312, 80, 7, 'ambar'),
  ecoFondo(318, 34, 5),
  ecoFondo(326, 62, 9, 'rojo'),
  ecoFondo(328, 65, 6),
  ecoFondo(331, 60, 5, 'ambar'),
  ecoFondo(339, 88, 6),
  ecoFondo(346, 45, 7),
  ecoFondo(352, 74, 5, 'ambar'),
  ecoFondo(357, 28, 6),
];

/** Fondo decorativo de radar, detrás de todo el contenido. */
@Component({
  selector: 'app-fondo-radar',
  standalone: true,
  template: `
    <div class="anillos"></div>
    <div class="barrido"></div>
    @for (eco of ecos; track $index) {
      <i class="eco"
         [class]="'eco-' + eco.tono"
         [style.right]="eco.derecha"
         [style.bottom]="eco.abajo"
         [style.width.px]="eco.tam"
         [style.height.px]="eco.tam"
         [style.animation-delay.s]="eco.retraso"></i>
    }
  `,
  styleUrl: './fondo-radar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class FondoRadarComponent {
  /** Ecos a dibujar. */
  protected readonly ecos = ECOS;
}
