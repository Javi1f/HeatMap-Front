/**
 * @file cifra.directive.ts
 * @description Muestra un texto con cifra y hace que el número cuente hasta su valor.
 *
 * `<span [appCifra]="'127 dispositivos'"></span>` pinta «127 dispositivos»,
 * pero el 127 sube desde el valor anterior (o desde cero la primera vez) en
 * menos de un segundo. Solo se anima el primer número del texto; lo demás
 * —unidades, palabras— se deja tal cual.
 *
 * El elemento anfitrión debe estar vacío: la directiva escribe su contenido.
 *
 * Con «reducir movimiento» activado, o donde no hay fotogramas (pruebas,
 * pestañas en segundo plano), el texto aparece directamente con su valor final.
 */

import { DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';

/** Duración de la cuenta, en milisegundos. */
const DURACION_MS = 900;

/**
 * Primer número de un texto, con signo, decimales con punto o coma y, si los
 * tiene, miles separados por un espacio fino («48 213»).
 */
const NUMERO = /-?\d{1,3}(?:\u202F\d{3})+(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/;

/** Separador de miles que reconoce y reproduce la directiva. */
const MILES = '\u202F';

/** Curva de salida: rápida al principio, suave al llegar. */
const suavizar = (t: number): number => 1 - (1 - t) ** 3;

/** `true` si el entorno permite animar y el usuario no pidió reducir el movimiento. */
const puedeAnimar = (): boolean =>
  typeof requestAnimationFrame === 'function'
  && typeof matchMedia === 'function'
  && !matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Número leído de un texto, con lo necesario para volver a escribirlo igual. */
interface Lectura {
  /** Valor numérico. */
  valor: number;
  /** Cifras decimales que tenía. */
  decimales: number;
  /** Separador decimal que usaba. */
  separador: string;
  /** `true` si separaba los miles. */
  agrupado: boolean;
  /** Texto encontrado, para sustituirlo. */
  literal: string;
}

/** Lee el primer número de un texto, o `null` si no lo tiene. */
export const leerCifra = (texto: string): Lectura | null => {
  const hallado = NUMERO.exec(texto);
  if (!hallado) return null;

  const literal = hallado[0];
  const separador = literal.includes(',') ? ',' : '.';
  const [, parteDecimal = ''] = literal.split(separador);
  return {
    valor: Number(literal.replaceAll(MILES, '').replace(',', '.')),
    decimales: parteDecimal.length,
    separador,
    agrupado: literal.includes(MILES),
    literal,
  };
};

/** Escribe un valor con los decimales y el separador de la lectura original. */
const escribir = (valor: number, lectura: Lectura): string => {
  const [entera, decimal] = valor.toFixed(lectura.decimales).split('.');
  const miles = lectura.agrupado ? entera.replace(/\B(?=(\d{3})+(?!\d))/g, MILES) : entera;
  return decimal === undefined ? miles : `${miles}${lectura.separador}${decimal}`;
};

/** Muestra una cifra contando desde el valor anterior hasta el nuevo. */
@Directive({
  selector: '[appCifra]',
  standalone: true,
})
export class CifraDirective {
  /** Texto final que debe mostrarse. */
  readonly appCifra = input.required<string>();

  /** Elemento donde se pinta la cifra. */
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Último valor mostrado, desde el que arranca la siguiente cuenta. */
  private anterior = 0;

  /** Fotograma pendiente, para cancelarlo si llega otro valor o se destruye. */
  private cuadro = 0;

  /** Vuelve a pintar cada vez que cambia el texto y cancela la cuenta al destruirse. */
  constructor() {
    effect(() => this.mostrar(this.appCifra()));
    inject(DestroyRef).onDestroy(() => this.detener());
  }

  /** Pinta el texto, contando si procede. */
  private mostrar(texto: string): void {
    this.detener();
    const lectura = leerCifra(texto);
    const desde = this.anterior;

    if (!lectura || !puedeAnimar() || desde === lectura.valor) {
      this.pintar(texto);
      if (lectura) this.anterior = lectura.valor;
      return;
    }

    const inicio = performance.now();
    /** Fotograma de la cuenta: pinta el valor intermedio y pide el siguiente. */
    const paso = (ahora: number): void => {
      const avance = Math.min(1, (ahora - inicio) / DURACION_MS);
      const valor = desde + (lectura.valor - desde) * suavizar(avance);
      this.pintar(texto.replace(lectura.literal, escribir(valor, lectura)));

      if (avance < 1) {
        this.cuadro = requestAnimationFrame(paso);
        return;
      }
      this.cuadro = 0;
      this.pintar(texto);
    };

    this.anterior = lectura.valor;
    this.cuadro = requestAnimationFrame(paso);
  }

  /** Cancela la cuenta en curso, si la hay. */
  private detener(): void {
    if (this.cuadro) cancelAnimationFrame(this.cuadro);
    this.cuadro = 0;
  }

  /** Escribe el texto en el anfitrión. */
  private pintar(texto: string): void {
    this.anfitrion.nativeElement.textContent = texto;
  }
}
