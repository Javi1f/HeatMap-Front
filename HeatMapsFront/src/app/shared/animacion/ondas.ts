/**
 * @file ondas.ts
 * @description Emisor con ondas que se expanden: la señal de un nodo que escucha.
 *
 * Es decorativo y se oculta a los lectores de pantalla. El dibujo y la
 * animación viven en `.ondas` (`styles/componentes.css`), así que el mismo
 * adorno puede escribirse a mano en HTML donde no convenga un componente.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Emisor con ondas concéntricas, para señalar algo que está recibiendo datos. */
@Component({
  selector: 'app-ondas',
  standalone: true,
  template: '<i></i><i></i><i></i><b></b>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ondas',
    'aria-hidden': 'true',
    '[class.ondas-quieta]': 'quieta()',
    '[style.--ondas-tam]': 'tam()',
    '[style.--ondas-color]': 'color()',
  },
})
export class OndasComponent {
  /** Diámetro del emisor, en cualquier unidad CSS. */
  readonly tam = input('12px');

  /** Color de las ondas; por defecto el primario del tema. */
  readonly color = input<string | null>(null);

  /** `true` para mostrar solo el punto, sin ondas: la señal no está en directo. */
  readonly quieta = input(false);
}
