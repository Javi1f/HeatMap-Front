/**
 * @file pie.ts
 * @description Pie legal persistente de la aplicación.
 *
 * Se monta una sola vez en el shell (`app.html`) y queda al final de todas las
 * páginas: reúne los enlaces a los documentos del apartado legal —política de
 * privacidad, aviso legal, términos y condiciones y política de cookies— y el
 * rótulo del proyecto. Es la pieza que hace hallables los documentos sin que
 * el menú lateral cargue con enlaces de cortesía.
 */

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OndasComponent } from '../animacion/ondas';

/**
 * Enlace de un documento legal dentro del pie.
 */
interface EntradaLegal {
  /** Rótulo visible del enlace. */
  texto: string;
  /** Ruta Angular del documento. */
  ruta: string;
}

/** Pie legal. Superficie fija del shell, presente en todas las rutas. */
@Component({
  selector: 'app-pie',
  standalone: true,
  imports: [RouterLink, OndasComponent],
  templateUrl: './pie.html',
  styleUrl: './pie.css',
})
export class PieComponent {
  /** Documentos y páginas del pie, en el orden de lectura. */
  readonly entradas: EntradaLegal[] = [
    { texto: 'Qué es PlaceAt', ruta: '/acerca'           },
    { texto: 'Privacidad',     ruta: '/legal/privacidad' },
    { texto: 'Aviso legal',    ruta: '/legal/aviso'      },
    { texto: 'Términos',       ruta: '/legal/terminos'   },
    { texto: 'Cookies',        ruta: '/legal/cookies'    },
  ];
}
