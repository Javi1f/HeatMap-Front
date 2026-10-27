/**
 * @file fondo-constelacion.ts
 * @description Fondo de la página «¿Qué es PlaceAt?» (`/acerca`): un cielo
 * con estrellas y constelaciones que reemplaza al radar global sólo en esa
 * ruta — no es un elemento más encima del fondo, es el fondo.
 *
 * El campo se siembra con un PRNG determinista — la página queda idéntica
 * entre sesiones y temas — y dibuja dos capas:
 *
 *   · estrellas sueltas que titilan despacio (algunas, del color primario);
 *   · constelaciones: cadenas de 4 a 6 estrellas unidas por líneas finas,
 *     con un vértice encendido, que respiran como un grupo.
 *
 * Todo deriva apenas: la escena nunca compite con el relato. Es decorativo:
 * no recibe eventos ni lo anuncian los lectores de pantalla. Con «reducir
 * movimiento» no hay bucle: el cielo se dibuja una vez, quieto.
 */

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  viewChild,
} from '@angular/core';

/** PRNG determinista: el cielo queda igual entre sesiones y temas. */
const mulberry32 = (semilla: number): (() => number) => {
  let a = semilla;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Reconstruye un color como `rgba` con nueva opacidad (#rrggbb o rgb/rgba). */
const rgba = (color: string, alfa: number): string => {
  const s = color.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const v = m[1].split(/[,\s/]+/).filter(Boolean).map((parte) => parseFloat(parte));
    return `rgba(${v[0]}, ${v[1]}, ${v[2]}, ${alfa})`;
  }
  return s;
};

/** Lee una variable CSS del lienzo con valor de respaldo. */
const token = (estilo: CSSStyleDeclaration, nombre: string, porDefecto: string): string =>
  estilo.getPropertyValue(nombre).trim() || porDefecto;

/** Estrella suelta del campo. */
interface Estrella {
  x: number; y: number;          // posición en fracción del cielo
  r: number;                     // radio del núcleo, en píxeles
  base: number;                  // brillo de reposo
  fase: number;                  // desfasaje personal del titilar
  velocidad: number;             // rapidez del titilar
  acento: boolean;               // color primario: la marca en el cielo
}

/** Constelación: una cadena unida por líneas, que deriva como un grupo. */
interface Constelacion {
  ancla: { x: number; y: number };
  vertices: { x: number; y: number }[];
  fase: number;
  /** Índice del vértice encendido (-1: ninguno). */
  acento: number;
}

/** Paleta leída de las variables CSS del lienzo. */
interface Paleta {
  estrella: string;
  acento: string;
  linea: string;
}

/** Dibuja el cielo: constelaciones y campo suelto, en el mismo plano. */
class Cielo {
  private ctx: CanvasRenderingContext2D;
  ancho = 0; alto = 0;
  paleta: Paleta;
  private estrellas: Estrella[] = [];
  private constelaciones: Constelacion[] = [];
  /** Sprites pregenerados: un disco suave por color, reusado cada cuadro. */
  private sprites = new Map<string, HTMLCanvasElement>();

  constructor(lienzo: HTMLCanvasElement) {
    this.ctx = lienzo.getContext('2d') as CanvasRenderingContext2D;
    this.paleta = this.leerPaleta(lienzo);
    this.sembrar();
  }

  /** Lee la paleta desde el propio elemento del lienzo. */
  private leerPaleta(lienzo: HTMLCanvasElement): Paleta {
    const e = getComputedStyle(lienzo);
    return {
      estrella: token(e, '--es-estrella', '#B9C6E2'),
      acento:   token(e, '--color-primary', '#FF7A1A'),
      linea:    token(e, '--es-linea', 'rgba(150, 170, 230, 0.16)'),
    };
  }

  /** Relee la paleta (cambio de tema) sin reconstruir el campo. */
  releerPaleta(lienzo: HTMLCanvasElement): void {
    this.paleta = this.leerPaleta(lienzo);
    this.sprites.clear();
  }

  /** Siembra el campo y las constelaciones con el PRNG determinista. */
  private sembrar(): void {
    const azar = mulberry32(20261013);

    this.estrellas = Array.from({ length: 150 }, () => ({
      x: azar(), y: azar(),
      r: 0.7 + azar() * 1.3,
      base: 0.22 + azar() * 0.55,
      fase: azar() * Math.PI * 2,
      velocidad: 0.5 + azar() * 1.2,
      acento: azar() < 0.07,
    }));

    // Constelaciones: cadenas con dirección con memoria — cada paso gira
    // poco respecto del anterior, así que se leen como figuras enlazadas,
    // no como garabatos.
    this.constelaciones = Array.from({ length: 7 }, () => {
      const ancla = { x: 0.07 + azar() * 0.86, y: 0.09 + azar() * 0.82 };
      const paso = 4 + Math.floor(azar() * 4);       // 4..7 vértices
      let direccion = azar() * Math.PI * 2;
      const vertices: { x: number; y: number }[] = [];
      let x = 0; let y = 0;
      for (let k = 0; k < paso; k++) {
        x += Math.cos(direccion) * (0.03 + azar() * 0.045);
        y += Math.sin(direccion) * (0.025 + azar() * 0.04);
        direccion += (azar() - 0.5) * 1.1;
        vertices.push({ x, y });
      }
      return {
        ancla,
        vertices,
        fase: azar() * Math.PI * 2,
        acento: azar() < 0.55 ? Math.floor(azar() * vertices.length) : -1,
      };
    });
  }

  /** Sprite de disco: núcleo con halo, pregenerado y reusado. */
  private sprite(color: string): HTMLCanvasElement {
    const previo = this.sprites.get(color);
    if (previo) return previo;
    const s = document.createElement('canvas');
    s.width = 48; s.height = 48;
    const c = s.getContext('2d') as CanvasRenderingContext2D;
    const g = c.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, rgba(color, 0.9));
    g.addColorStop(0.3, rgba(color, 0.35));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, 48, 48);
    this.sprites.set(color, s);
    return s;
  }

  /** Un cuadro: cielo limpio, constelaciones y luego el campo suelto. */
  dibujar(t: number): void {
    const { ctx, ancho: w, alto: h, paleta: p } = this;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);

    for (const c of this.constelaciones) {
      // Deriva compartida: la cadena respira como un grupo, sin estirarse.
      const ox = Math.sin(t * 0.05 + c.fase) * 6;
      const oy = Math.cos(t * 0.043 + c.fase) * 5;
      const pts = c.vertices.map((v) => ({
        x: (c.ancla.x + v.x) * w + ox,
        y: (c.ancla.y + v.y) * h + oy,
      }));
      if (pts.length < 2) continue;
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = p.linea;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.stroke();

      pts.forEach((pt, k) => {
        const esAcento = k === c.acento;
        const tam = (esAcento ? 11 : 8) * (0.9 + 0.1 * (Math.sin(t * 1.2 + c.fase + k * 1.7) + 1) / 2);
        ctx.globalAlpha = esAcento ? 0.5 : 0.3;
        ctx.drawImage(
          this.sprite(esAcento ? p.acento : p.estrella),
          pt.x - tam / 2, pt.y - tam / 2, tam, tam,
        );
      });
    }
    ctx.globalAlpha = 1;

    for (const e of this.estrellas) {
      const titilar = 0.75 + 0.25 * Math.sin(t * e.velocidad + e.fase);
      const tam = e.r * 7;
      ctx.globalAlpha = e.base * titilar;
      ctx.drawImage(
        this.sprite(e.acento ? p.acento : p.estrella),
        e.x * w - tam / 2, e.y * h - tam / 2, tam, tam,
      );
    }
    ctx.globalAlpha = 1;
  }

  /** Ajusta el lienzo a su contenedor, a la densidad real. */
  redimensionar(anchoCss: number, altoCss: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const lienzo = this.ctx.canvas;
    lienzo.width = Math.round(anchoCss * dpr);
    lienzo.height = Math.round(altoCss * dpr);
    lienzo.style.width = `${anchoCss}px`;
    lienzo.style.height = `${altoCss}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ancho = anchoCss;
    this.alto = altoCss;
  }
}

/** Fondo decorativo de constelación, detrás de todo el contenido. */
@Component({
  selector: 'app-fondo-constelacion',
  standalone: true,
  template: `<canvas #cielo></canvas>`,
  styleUrl: './fondo-constelacion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class FondoConstelacion implements AfterViewInit, OnDestroy {
  /** El lienzo del cielo. */
  private readonly cieloRef = viewChild.required<ElementRef<HTMLCanvasElement>>('cielo');

  /** Motor del cielo, creado cuando la vista existe. */
  private cielo: Cielo | null = null;

  /** Identificador del cuadro animado en curso. */
  private rafId: number | null = null;

  /** Observadores: tamaño y tema. */
  private observadorTamano: ResizeObserver | null = null;
  private observadorTema: MutationObserver | null = null;

  /** `true` si el sistema pidió reducir el movimiento. */
  private movimientoReducido = false;

  ngAfterViewInit(): void {
    this.movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lienzo = this.cieloRef().nativeElement;

    this.cielo = new Cielo(lienzo);
    this.ajustar();

    this.observadorTamano = new ResizeObserver(() => {
      this.ajustar();
      if (this.movimientoReducido) this.cielo?.dibujar(0);
    });
    // El anfitrión mide exactamente la ventana (fixed inset 0).
    this.observadorTamano.observe(lienzo.parentElement as HTMLElement);

    // El cambio de tema relee la paleta sin reconstruir el campo.
    this.observadorTema = new MutationObserver(() => {
      this.cielo?.releerPaleta(lienzo);
      if (this.movimientoReducido) this.cielo?.dibujar(0);
    });
    this.observadorTema.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    if (this.movimientoReducido) this.cielo.dibujar(0);
    else this.arrancar();
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.observadorTamano?.disconnect();
    this.observadorTema?.disconnect();
  }

  /** Ajusta el lienzo al tamaño del anfitrión. */
  private ajustar(): void {
    const anfitrion = this.cieloRef().nativeElement.parentElement as HTMLElement;
    this.cielo?.redimensionar(anfitrion.clientWidth, anfitrion.clientHeight);
  }

  /** Arranca el bucle de animación. */
  private arrancar(): void {
    if (this.rafId !== null) return;
    const cuadro = () => {
      this.rafId = requestAnimationFrame(cuadro);
      this.cielo?.dibujar(performance.now() / 1000);
    };
    this.rafId = requestAnimationFrame(cuadro);
  }
}
