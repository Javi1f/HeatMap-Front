/**
 * @file aviso-mapa.ts
 * @description Aviso bajo el plano, ya resuelto por quien lo usa.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Aviso a mostrar bajo el mapa. */
export interface AvisoMapa {
  readonly clase: string;
  readonly icono: string;
  readonly texto: string;
  readonly reintentable: boolean;
}

@Component({
  selector: 'app-aviso-mapa',
  standalone: true,
  imports: [],
  templateUrl: './aviso-mapa.html',
  styleUrl: './aviso-mapa.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvisoMapaComponent {
  /** Aviso a mostrar, o `null` si no hay nada que advertir. */
  readonly aviso = input<AvisoMapa | null>(null);

  /** Se emite al pulsar «Reintentar». */
  readonly reintentar = output<void>();
}
