/**
 * @file indicadores.ts
 * @description Indicadores de estado para las tablas del panel: señal y medidor.
 *
 * Sustituyen a las píldoras de color. Se leen como instrumentos: cuántas
 * barras de señal tiene un nodo o una cuenta, cuántos segmentos de un medidor
 * están encendidos. La forma dice lo mismo que el color, así que el estado se
 * distingue también sin percibir colores, y el texto al lado lo confirma para
 * los lectores de pantalla (las barras y los segmentos se les ocultan).
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Tono de un indicador. */
export type Tono = 'ok' | 'aviso' | 'peligro' | 'neutro';

/**
 * Barras de señal con su texto: `▂▄▆█ En línea`.
 *
 * Con `vivo`, las barras encendidas recorren un pulso de izquierda a derecha,
 * como un equipo que está recibiendo.
 */
@Component({
  selector: 'app-senal',
  standalone: true,
  template: `
    <span class="barras" aria-hidden="true">
      @for (barra of barrasTotales; track barra) {
        <i [class.encendida]="barra <= barras()"></i>
      }
    </span>
    <span class="texto">{{ texto() }}</span>
  `,
  styleUrl: './indicadores.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'senal',
    '[class]': "'tono-' + tono()",
    '[class.vivo]': 'vivo()',
  },
})
export class SenalComponent {
  /** Barras encendidas, de 0 a 4. */
  readonly barras = input.required<number>();

  /** Color del estado. */
  readonly tono = input<Tono>('neutro');

  /** Texto del estado; es lo que leen los lectores de pantalla. */
  readonly texto = input.required<string>();

  /** `true` si el dato llega en este momento. */
  readonly vivo = input(false);

  /** Las cuatro posiciones de barra. */
  protected readonly barrasTotales = [1, 2, 3, 4];
}

/**
 * Medidor de segmentos: `▮▮▯ media` o `▮▮▮▮▮▮▯▯▯▯ 63 % de 200`.
 *
 * Los segmentos se encienden uno tras otro al aparecer. El texto es opcional:
 * sin él, el medidor lleva una etiqueta accesible con los segmentos llenos.
 */
@Component({
  selector: 'app-medidor',
  standalone: true,
  template: `
    <span class="segmentos" aria-hidden="true">
      @for (segmento of posiciones(); track segmento) {
        <i [class.encendido]="segmento <= llenos()" [style.animation-delay.ms]="segmento * 45"></i>
      }
    </span>
    @if (texto()) {
      <span class="texto">{{ texto() }}</span>
    } @else {
      <span class="solo-lector">{{ llenos() }} de {{ total() }}</span>
    }
  `,
  styleUrl: './indicadores.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'medidor',
    '[class]': "'tono-' + tono()",
  },
})
export class MedidorComponent {
  /** Segmentos encendidos. */
  readonly llenos = input.required<number>();

  /** Segmentos en total. */
  readonly total = input(3);

  /** Color del medidor. */
  readonly tono = input<Tono>('neutro');

  /** Texto que acompaña al medidor. */
  readonly texto = input('');

  /** Posiciones de 1 a `total`. */
  protected readonly posiciones = computed(() => Array.from({ length: this.total() }, (_, i) => i + 1));
}
