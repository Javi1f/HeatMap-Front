/**
 * @file mapa-lienzo.ts
 * @description Dibuja un mapa de calor sobre el plano de una zona.
 *
 * ## Por qué un lienzo y no SVG
 * Un mapa de calor necesita mezclar cientos de manchas translúcidas y volver a
 * colorear el resultado según la intensidad acumulada. En SVG eso son cientos
 * de nodos en el DOM y un filtro por encima; en un lienzo es una pasada de
 * píxeles.
 *
 * ## Cómo se construye
 * En dos fases, que es la técnica habitual de los mapas de calor:
 *
 * 1. **Intensidad**: cada celda con conteo pinta un degradado radial en escala
 *    de grises sobre un lienzo auxiliar. Al solaparse, las opacidades se suman
 *    solas y las concentraciones vecinas se funden en una sola mancha.
 * 2. **Color**: se recorre el mapa de píxeles y se sustituye cada nivel de
 *    opacidad por un color de la rampa. Pintar directamente en color no
 *    funcionaría: al superponerse, los colores se mezclarían entre sí en vez de
 *    sumar intensidad.
 */

import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { MapaDibujable } from '../../../core/models/mapa.model';

/**
 * Rampa de color de la intensidad, de menor a mayor ocupación.
 *
 * Arranca en un azul frío y termina en el naranja de la marca pasando por
 * verde y ámbar: el recorrido tiene contraste suficiente para leerse en ambos
 * temas, y el extremo cálido coincide con el color con el que la aplicación ya
 * señala lo que reclama atención.
 */
const RAMPA: [number, string][] = [
  [0.0, 'rgba(56, 132, 196, 0)'],
  [0.15, 'rgba(56, 132, 196, 0.55)'],
  [0.4, 'rgba(74, 168, 132, 0.72)'],
  [0.62, 'rgba(214, 176, 54, 0.82)'],
  [0.82, 'rgba(232, 140, 40, 0.9)'],
  [1.0, 'rgba(208, 62, 32, 0.95)'],
];

/** Radio de cada mancha, en múltiplos del lado de celda. */
const RADIO_EN_CELDAS = 3.2;

/**
 * Margen alrededor del plano, en píxeles CSS del lienzo.
 *
 * En un teléfono el lienzo ronda los 300px de ancho: con el margen de
 * escritorio, los dos bordes se llevaban una quinta parte del espacio y el
 * plano quedaba en poco más de 190px para 17,64 m reales. El margen estrecho
 * sigue dejando sitio a las cotas de los dos ejes.
 */
const MARGEN_AMPLIO = 26;
const MARGEN_ESTRECHO = 16;

/** Ancho de lienzo por debajo del cual se usa el margen estrecho. */
const ANCHO_ESTRECHO = 420;

@Component({
  selector: 'app-mapa-lienzo',
  standalone: true,
  imports: [],
  templateUrl: './mapa-lienzo.html',
  styleUrl: './mapa-lienzo.css'
})
export class MapaLienzoComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Mapa a representar. `null` deja el lienzo vacío. */
  @Input() mapa: MapaDibujable | null = null;

  /** Referencia al lienzo visible. */
  @ViewChild('lienzo') lienzoRef!: ElementRef<HTMLCanvasElement>;

  /** `true` una vez que la vista existe y se puede dibujar. */
  private listo = false;

  /** Margen en vigor, recalculado en cada dibujado según el ancho disponible. */
  private margen = MARGEN_AMPLIO;

  /** Vigila el ancho del contenedor para redibujar cuando cambia. */
  private observador: ResizeObserver | null = null;

  /** Ancho con el que se hizo el último dibujado, en píxeles CSS. */
  private anchoDibujado = 0;

  ngAfterViewInit(): void {
    this.listo = true;
    this.dibujar();
    this.vigilarTamano();
  }

  ngOnChanges(): void {
    if (this.listo) this.dibujar();
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    this.observador = null;
  }

  /**
   * Redibuja al cambiar el tamaño de la ventana.
   *
   * Convive con el observador de más abajo a propósito. El evento de ventana
   * puede llegar antes de que el diseño se reajuste, y el observador no cubre
   * todos los navegadores; entre los dos, ninguno de los dos casos deja el
   * plano dibujado a la medida anterior. `redibujarSiCambio` descarta las
   * llamadas redundantes, así que sobrar no cuesta nada.
   */
  @HostListener('window:resize')
  onResize(): void {
    this.redibujarSiCambio();
  }

  /**
   * Vigila el ancho del contenedor.
   *
   * Cubre además los cambios que no vienen de la ventana y que por tanto no
   * disparan `window:resize`: abrir el menú lateral, plegar un panel o que
   * aparezca la barra de desplazamiento.
   */
  private vigilarTamano(): void {
    const contenedor = this.lienzoRef?.nativeElement?.parentElement;
    if (!contenedor || typeof ResizeObserver === 'undefined') return;

    this.observador = new ResizeObserver(() => this.redibujarSiCambio());
    this.observador.observe(contenedor);
  }

  /** Redibuja sólo si el ancho disponible cambió de verdad. */
  private redibujarSiCambio(): void {
    if (!this.listo) return;
    const contenedor = this.lienzoRef?.nativeElement?.parentElement;
    if (!contenedor) return;

    const ancho = contenedor.clientWidth;
    if (ancho === 0 || ancho === this.anchoDibujado) return;
    this.dibujar();
  }

  /**
   * Dibuja el plano, el calor y los nodos.
   *
   * Se ejecuta entero en cada llamada en lugar de actualizar por partes: el
   * coste es de milisegundos y evita toda la clase de errores en que el lienzo
   * conserva restos de un dibujo anterior.
   */
  private dibujar(): void {
    const canvas = this.lienzoRef?.nativeElement;
    const mapa = this.mapa;
    if (!canvas) return;

    const contenedor = canvas.parentElement;
    if (!contenedor) return;

    // El plano manda en la proporción: el alto se deduce del ancho disponible
    // para que un espacio de 17,64 x 9,10 m no salga deformado.
    const proporcion = mapa ? mapa.alto / mapa.ancho : 0.5;
    const anchoCss = contenedor.clientWidth;
    this.margen = anchoCss < ANCHO_ESTRECHO ? MARGEN_ESTRECHO : MARGEN_AMPLIO;
    this.anchoDibujado = anchoCss;
    const altoCss = Math.round((anchoCss - this.margen * 2) * proporcion) + this.margen * 2;

    // El lienzo se dibuja a la resolución real de la pantalla y se muestra al
    // tamaño CSS; sin esto, en pantallas de alta densidad se ve borroso.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(anchoCss * dpr);
    canvas.height = Math.round(altoCss * dpr);
    canvas.style.width = `${anchoCss}px`;
    canvas.style.height = `${altoCss}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, anchoCss, altoCss);

    if (!mapa) return;

    const anchoPlano = anchoCss - this.margen * 2;
    const altoPlano = altoCss - this.margen * 2;
    const escala = anchoPlano / mapa.ancho;

    this.dibujarPlano(ctx, anchoPlano, altoPlano, escala);

    if (mapa.maximo > 0) {
      this.dibujarCalor(ctx, mapa, escala, anchoPlano, altoPlano);
    }

    this.dibujarNodos(ctx, mapa, escala, altoPlano);
    this.dibujarEscalaMetros(ctx, mapa, escala, altoPlano);
  }

  /** Fondo y borde del espacio. */
  private dibujarPlano(
    ctx: CanvasRenderingContext2D,
    ancho: number,
    alto: number,
    escala: number,
  ): void {
    const estilo = getComputedStyle(this.lienzoRef.nativeElement);
    const fondo = estilo.getPropertyValue('--plano-fondo').trim() || '#1a1f27';
    const borde = estilo.getPropertyValue('--plano-borde').trim() || '#39424f';
    const retic = estilo.getPropertyValue('--plano-reticula').trim() || 'rgba(255,255,255,0.05)';

    ctx.fillStyle = fondo;
    ctx.fillRect(this.margen, this.margen, ancho, alto);

    // Retícula de un metro. Da referencia de tamaño sin competir con el calor,
    // que se dibuja encima: leer «ese grupo ocupa unos tres metros» es más útil
    // que ver una mancha flotando en un rectángulo vacío.
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.margen, this.margen, ancho, alto);
    ctx.clip();
    ctx.strokeStyle = retic;
    ctx.lineWidth = 1;

    for (let x = escala; x < ancho; x += escala) {
      const px = Math.round(this.margen + x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, this.margen);
      ctx.lineTo(px, this.margen + alto);
      ctx.stroke();
    }
    for (let y = escala; y < alto; y += escala) {
      const py = Math.round(this.margen + alto - y) + 0.5;
      ctx.beginPath();
      ctx.moveTo(this.margen, py);
      ctx.lineTo(this.margen + ancho, py);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = borde;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.margen, this.margen, ancho, alto);
  }

  /**
   * Pinta la intensidad en un lienzo auxiliar y la vuelca ya coloreada.
   */
  private dibujarCalor(
    ctx: CanvasRenderingContext2D,
    mapa: MapaDibujable,
    escala: number,
    ancho: number,
    alto: number,
  ): void {
    const aux = document.createElement('canvas');
    aux.width = Math.max(1, Math.round(ancho));
    aux.height = Math.max(1, Math.round(alto));
    const auxCtx = aux.getContext('2d');
    if (!auxCtx) return;

    const radio = mapa.ladoCelda * RADIO_EN_CELDAS * escala;

    for (let fila = 0; fila < mapa.filas; fila++) {
      for (let col = 0; col < mapa.columnas; col++) {
        const valor = mapa.rejilla[fila][col];
        if (valor === 0) continue;

        // Centro de la celda en metros y su equivalente en el lienzo. El eje Y
        // se invierte: la fila 0 es la parte inferior del espacio.
        const cx = (col + 0.5) * mapa.ladoCelda * escala;
        const cy = alto - (fila + 0.5) * mapa.ladoCelda * escala;

        const intensidad = Math.min(valor / mapa.maximo, 1);
        const degradado = auxCtx.createRadialGradient(cx, cy, 0, cx, cy, radio);
        degradado.addColorStop(0, `rgba(0,0,0,${intensidad})`);
        degradado.addColorStop(1, 'rgba(0,0,0,0)');

        auxCtx.fillStyle = degradado;
        auxCtx.beginPath();
        auxCtx.arc(cx, cy, radio, 0, Math.PI * 2);
        auxCtx.fill();
      }
    }

    colorear(auxCtx, aux.width, aux.height);
    ctx.drawImage(aux, this.margen, this.margen);
  }

  /** Marca cada nodo de captura sobre el plano. */
  private dibujarNodos(
    ctx: CanvasRenderingContext2D,
    mapa: MapaDibujable,
    escala: number,
    alto: number,
  ): void {
    const estilo = getComputedStyle(this.lienzoRef.nativeElement);
    const activo = estilo.getPropertyValue('--nodo-activo').trim() || '#e8640c';
    const inactivo = estilo.getPropertyValue('--nodo-inactivo').trim() || '#6b7481';
    const texto = estilo.getPropertyValue('--plano-texto').trim() || '#c8cfd9';

    for (const nodo of mapa.nodos) {
      const x = this.margen + nodo.x * escala;
      const y = this.margen + alto - nodo.y * escala;
      const color = nodo.aportoDatos ? activo : inactivo;

      // Halo, para que el nodo se distinga aunque caiga sobre una mancha.
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();

      ctx.fillStyle = texto;
      ctx.font = '600 12px "Roboto", system-ui, sans-serif';
      ctx.textAlign = nodo.x > mapa.ancho / 2 ? 'right' : 'left';
      ctx.textBaseline = nodo.y > mapa.alto / 2 ? 'top' : 'bottom';
      const dx = nodo.x > mapa.ancho / 2 ? -11 : 11;
      const dy = nodo.y > mapa.alto / 2 ? 8 : -8;
      ctx.fillText(nodo.nombre, x + dx, y + dy);
    }
  }

  /** Rotula las medidas del espacio en los dos ejes. */
  private dibujarEscalaMetros(
    ctx: CanvasRenderingContext2D,
    mapa: MapaDibujable,
    escala: number,
    alto: number,
  ): void {
    const estilo = getComputedStyle(this.lienzoRef.nativeElement);
    ctx.fillStyle = estilo.getPropertyValue('--plano-cota').trim() || '#8a929e';
    ctx.font = '500 11px "Roboto", system-ui, sans-serif';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${mapa.ancho} m`, this.margen + (mapa.ancho * escala) / 2, this.margen + alto + 7);

    ctx.save();
    ctx.translate(this.margen - 8, this.margen + alto / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${mapa.alto} m`, 0, 0);
    ctx.restore();
  }
}

/**
 * Sustituye la opacidad acumulada por el color de la rampa.
 *
 * Recorre el mapa de píxeles una sola vez y usa una tabla de 256 entradas
 * precalculada, en lugar de interpolar en cada píxel.
 */
function colorear(ctx: CanvasRenderingContext2D, ancho: number, alto: number): void {
  const imagen = ctx.getImageData(0, 0, ancho, alto);
  const px = imagen.data;
  const tabla = tablaDeColor();

  for (let i = 0; i < px.length; i += 4) {
    const alfa = px[i + 3];
    if (alfa === 0) continue;
    const c = tabla[alfa];
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = c[3];
  }

  ctx.putImageData(imagen, 0, 0);
}

/** Tabla precalculada de 256 colores, uno por nivel de opacidad. */
function tablaDeColor(): [number, number, number, number][] {
  const aux = document.createElement('canvas');
  aux.width = 256;
  aux.height = 1;
  const ctx = aux.getContext('2d');
  if (!ctx) return new Array(256).fill([0, 0, 0, 0]);

  const degradado = ctx.createLinearGradient(0, 0, 256, 0);
  for (const [parada, color] of RAMPA) degradado.addColorStop(parada, color);
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, 256, 1);

  const datos = ctx.getImageData(0, 0, 256, 1).data;
  const tabla: [number, number, number, number][] = [];
  for (let i = 0; i < 256; i++) {
    const o = i * 4;
    tabla.push([datos[o], datos[o + 1], datos[o + 2], datos[o + 3]]);
  }
  return tabla;
}
