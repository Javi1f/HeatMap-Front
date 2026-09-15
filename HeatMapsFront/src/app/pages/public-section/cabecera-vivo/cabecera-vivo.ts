/**
 * @file cabecera-vivo.ts
 * @description Portada de la sección pública con la cifra de dispositivos.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Cifra a mostrar y de dónde sale. */
interface Contador {
  readonly texto: string;
  readonly enDirecto: boolean;
}

/** Periodo que abarca el conteo cuando no llega en directo; vacío si se desconoce. */
const textoVentana = (minutos: number | null): string => (minutos ? `en los últimos ${minutos} min` : '');

/** Titular de la vista pública con el contador de dispositivos en vivo. */
@Component({
  selector: 'app-cabecera-vivo',
  standalone: true,
  imports: [],
  templateUrl: './cabecera-vivo.html',
  styleUrl: './cabecera-vivo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabeceraVivoComponent {
  /** Dispositivos a anunciar, o `null` si todavía no hay cifra. */
  readonly valor = input<number | null>(null);

  /** `true` si la cifra procede de lecturas que llegan ahora mismo. */
  readonly enDirecto = input<boolean>(false);

  /** Minutos de la ventana, para matizar la cifra cuando no es en directo. */
  readonly ventanaMinutos = input<number | null>(null);

  /**
   * Texto de la cifra, o `null` si no hay nada que anunciar.
   *
   * Se compone aquí para que la plantilla pregunte una sola vez en lugar de
   * encadenar comprobaciones sobre el valor y su procedencia.
   */
  readonly contador = computed<Contador | null>(() => {
    const valor = this.valor();
    if (valor === null) return null;

    const enDirecto = this.enDirecto();
    const cuando = enDirecto ? 'ahora' : textoVentana(this.ventanaMinutos());
    return { texto: `${valor} dispositivos ${cuando}`.trim(), enDirecto };
  });
}
