/**
 * @file acerca.ts
 * @description Página «¿Qué es PlaceAt?» (`/acerca`).
 *
 * La página no explica el mecanismo: lo ejecuta. Un único lienzo, pegajoso
 * durante todo el primer acto, dibuja el viaje completo de una señal —del aire
 * a la decisión— mientras la columna de relato activa cada etapa con el scroll.
 * Siete escenas comparten el mismo plano y se funden entre sí según la
 * posición del centro del viewport:
 *
 *   0 · héroe         señales derivando y un nodo que pulsa
 *   1 · el problema   el plano casi apagado: el espacio como incógnita
 *   2 · el aire       cada dispositivo emite probe requests
 *   3 · el nodo       el barrido captura y marca MAC aleatorizadas
 *   4 · el borde      la identidad muere: HMAC-SHA256 dentro del nodo
 *   5 · el flujo      paquetes cifrados hacia el procesamiento
 *   6 · el mapa       el plano se enciende con la rampa real del mapa
 *
 * El dibujo lee los colores de variables CSS (como `mapa-lienzo`), así que
 * sigue al tema claro u oscuro sin duplicar la paleta en TypeScript. Con
 * «reducir movimiento» no hay bucle de animación: cada escena se dibuja una
 * vez, estática, cuando la etapa cambia.
 */

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/* ══ Datos del relato ═══════════════════════════════════════════════ */

/** Cifra de la encuesta propia que abre el relato del problema. */
interface CifraEncuesta {
  /** Valor numérico al que llega el conteo. */
  valor: number;
  /** Decimales a mostrar (el separador se pinta como coma). */
  decimales: number;
  /** Unidad que acompaña a la cifra. */
  sufijo: string;
  /** Qué mide, en la voz de quien lo vive. */
  lectura: string;
}

/** Etapa del viaje de la señal. */
interface EtapaViaje {
  /** Numeral de la etapa, en mono. */
  numero: string;
  /** Nombre corto de la etapa, para el riel. */
  etapa: string;
  /** Titular del paso. */
  titulo: string;
  /** Cuerpo del paso. */
  cuerpo: string;
}

/** Capacidad declarada de la plataforma. */
interface Capacidad {
  icono: string;
  nombre: string;
  detalle: string;
}

/** Principio de privacidad o límite declarado. */
interface Principio {
  nombre: string;
  detalle: string;
}

/** Cifras de la encuesta propia (n = 41, Bogotá D.C., 2026). */
const CIFRAS: CifraEncuesta[] = [
  { valor: 70.73, decimales: 2, sufijo: ' %',   lectura: 'considera normal hacer filas para ingresar' },
  { valor: 78.05, decimales: 2, sufijo: ' %',   lectura: 'percibe pérdida de tiempo frecuente en el proceso' },
  { valor: 11.78, decimales: 2, sufijo: ' min', lectura: 'de tiempo promedio registrado para ingresar a un espacio' },
  { valor: 70,    decimales: 0, sufijo: ' %',   lectura: 'aún depende de métodos manuales o formularios físicos' },
];

/** Las cinco etapas del viaje, en el orden del pipeline real. */
const ETAPAS: EtapaViaje[] = [
  {
    numero: '01', etapa: 'El aire',
    titulo: 'Cada celular habla solo.',
    cuerpo: 'Los teléfonos emiten constantemente probe requests: señales públicas buscando redes conocidas. No llevan datos personales, no hay que instalar nada y nadie tiene que hacer nada diferente. El espacio ya transmite su propia ocupación — solo nadie la estaba escuchando.',
  },
  {
    numero: '02', etapa: 'El nodo',
    titulo: 'Un nodo de bajo costo pone a escuchar la red.',
    cuerpo: 'Una Raspberry Pi con Kismet en modo monitor captura la dirección, el canal y la intensidad (RSSI) de cada señal. El bit U/L del estándar IEEE 802 revela cuáles direcciones son aleatorizadas: el sistema las marca para no contar al mismo dispositivo dos veces. Hardware commodity, sin obra civil.',
  },
  {
    numero: '03', etapa: 'El borde',
    titulo: 'La identidad muere antes de salir del nodo.',
    cuerpo: 'Dentro del nodo, cada dirección pasa por HMAC-SHA256 antes de viajar. El sistema nunca guarda ni transmite un identificador en claro: lo que sale del borde ya es un token sin dueño. La privacidad no es una política al final del proceso — es el primer paso.',
  },
  {
    numero: '04', etapa: 'El flujo',
    titulo: 'El flujo viaja cifrado y se vuelve ocupación.',
    cuerpo: 'Las lecturas llegan cifradas —SSL/TLS en el canal y AES-256-GCM en la API y los campos— a Apache Kafka, que retiene el flujo para reprocesar ventanas históricas. El back-end deduplica, agrega por ventanas de tiempo y estima la ocupación por zona: del orden de 500 detecciones por lectura y unas 50 lecturas por minuto, sin quedarse atrás.',
  },
  {
    numero: '05', etapa: 'El mapa',
    titulo: 'El espacio deja de ser una incógnita.',
    cuerpo: 'La intensidad de la señal, calibrada en campo, ubica la densidad sobre el plano del espacio. El resultado es un mapa de calor que se actualiza por WebSocket sin recargar la página, y un conteo estimado por zona. La información útil llega en segundos, no en el reporte del día siguiente.',
  },
];

/** Las ocho capacidades declaradas de la plataforma. */
const CAPACIDADES: Capacidad[] = [
  { icono: 'wifi_tethering',       nombre: 'Detección pasiva',        detalle: 'Sin apps ni cámaras: el espacio se mide a sí mismo.' },
  { icono: 'whatshot',             nombre: 'Mapas de calor',          detalle: 'Densidad por zona, en tiempo cercano al real.' },
  { icono: 'tag',                  nombre: 'Conteo estimado',         detalle: 'Dispositivos por espacio, con agregación temporal.' },
  { icono: 'bolt',                 nombre: 'Tiempo real',             detalle: 'El mapa se actualiza en vivo por WebSocket.' },
  { icono: 'lock',                 nombre: 'Privacidad por diseño',   detalle: 'Anonimización en el borde; nada identifica personas.' },
  { icono: 'history',              nombre: 'Retención de historial',  detalle: 'Kafka permite reprocesar y comparar períodos.' },
  { icono: 'admin_panel_settings', nombre: 'Acceso controlado',       detalle: 'JWT, roles y cifrado AES-256-GCM de las señales.' },
  { icono: 'tune',                 nombre: 'Operación simple',        detalle: 'Nodos de bajo costo y despliegue web, sin obra civil.' },
];

/** Principios de privacidad por diseño. */
const PRINCIPIOS: Principio[] = [
  { nombre: 'Minimización',            detalle: 'Solo los campos estrictamente necesarios: dirección temporal, canal, intensidad y último visto.' },
  { nombre: 'Anonimización en el borde', detalle: 'Los identificadores se enmascaran dentro del nodo, antes de salir de él.' },
  { nombre: 'No identificación',       detalle: 'El sistema cuenta dispositivos por zona; jamás los vincula a individuos.' },
  { nombre: 'Cumplimiento normativo',  detalle: 'Ley 1581 de 2012 (Habeas Data), GDPR como referente y OWASP IoT Top 10.' },
];

/** Límites declarados con honestidad. */
const LIMITES: Principio[] = [
  { nombre: 'Contamos dispositivos, no personas', detalle: 'La MAC aleatoria cambia cada pocos minutos: el conteo individual tiene un límite estructural. Lo gestionamos con agregación temporal, deduplicación y modelos por zona.' },
  { nombre: 'La precisión se define en campo',    detalle: 'La propagación de la señal y los umbrales de densidad no se deducen de la literatura: se miden en cada espacio.' },
  { nombre: 'Desempeño medido, no prometido',     detalle: 'La validación de precisión y latencia concluyó con el proyecto: sobre 9,5 millones de capturas reales del piloto, el conteo logró sensibilidad del 100 % y exactitud del 99,7 %, con error medio de posición de 2,2 m y latencia mediana de 1,5 s.' },
];

/* ══ Motor del lienzo ═══════════════════════════════════════════════ */

/** Rampa de color del mapa, de menor a mayor ocupación. Es la misma del
 *  `mapa-lienzo`: aquí es dato, no adorno. */
const RAMPA: [number, string][] = [
  [0.0,  'rgba(56, 132, 196, 0)'],
  [0.15, 'rgba(56, 132, 196, 0.55)'],
  [0.4,  'rgba(74, 168, 132, 0.72)'],
  [0.62, 'rgba(214, 176, 54, 0.82)'],
  [0.82, 'rgba(232, 140, 40, 0.9)'],
  [1.0,  'rgba(208, 62, 32, 0.95)'],
];

/** PRNG determinista: las escenas quedan igual entre sesiones y temas. */
const mulberry32 = (semilla: number): (() => number) => {
  let a = semilla;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Interpolación con freno natural (ease-out cúbico). */
const suavizar = (x: number): number => 1 - Math.pow(1 - x, 3);

/** Paleta leída de las variables CSS del lienzo. */
interface Paleta {
  reticula: string;
  texto: string;
  cota: string;
  senal: string;
  primario: string;
  /** Base del plano del mapa (escena final), translúcida. */
  plano: string;
}

/** Lee un token del lienzo con valor de respaldo. */
const token = (estilo: CSSStyleDeclaration, nombre: string, porDefecto: string): string =>
  estilo.getPropertyValue(nombre).trim() || porDefecto;

/** Reconstruye un color como `rgba` con nueva opacidad (#rrggbb o rgb/rgba).
 *  Los halos desvanecen hacia SU capa de fondo, no hacia negro: sobre papel
 *  el negro translúcido deja manchas grises. */
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

/** Una señal: dónde reposa, cómo se mueve y si su MAC es aleatorizada. */
interface Senal {
  x: number; y: number;          // posición base, en fracción del plano
  vx: number; vy: number;        // deriva, en fracción por segundo
  fase: number;                  // desfasaje personal para ciclos y anillos
  aleatoria: boolean;            // MAC aleatorizada (bit U/L): se dibuja hueca
}

/** Tabla de 256 colores, una entrada por nivel de opacidad acumulada. */
const tablaDeColor = (): [number, number, number, number][] => {
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
    tabla.push([datos[i * 4], datos[i * 4 + 1], datos[i * 4 + 2], datos[i * 4 + 3]]);
  }
  return tabla;
};

/** Fragmentos de token anónimo que muestra la escena del borde. */
const FRAGMENTOS_HASH = [
  '9f·86', 'a3·c2', '7e·11', 'c4·5d', '21·9a',
  '58·d3', '0b·77', 'e9·20', '3d·64', '82·f5',
];

/** Tramo punteado que conecta dos tarjetas consecutivas del relato. */
interface Via {
  /** Trazado SVG del tramo. */
  d: string;
  /** Punto de partida (borde inferior de la tarjeta anterior). */
  ax: number; ay: number;
  /** Punto de llegada (borde superior de la tarjeta siguiente). */
  bx: number; by: number;
}

/** Dibuja las siete escenas del viaje sobre un mismo plano. */
class MotorEscenas {
  /** Contexto 2D del lienzo visible. */
  private ctx: CanvasRenderingContext2D;
  /** Ancho y alto del lienzo, en píxeles CSS. */
  ancho = 0; alto = 0;
  /** Paleta vigente, releída cuando cambia el tema o el tamaño. */
  paleta: Paleta;
  /** Señales de la escena, con posiciones deterministas. */
  private senales: Senal[] = [];
  /** Tabla de color del calor, precalculada una vez. */
  private tabla = tablaDeColor();
  /** Lienzo auxiliar de baja resolución para acumular intensidad. */
  private aux = document.createElement('canvas');
  private auxCtx: CanvasRenderingContext2D | null;

  constructor(lienzo: HTMLCanvasElement) {
    this.ctx = lienzo.getContext('2d') as CanvasRenderingContext2D;
    this.aux.width = 192;
    this.aux.height = 108;
    this.auxCtx = this.aux.getContext('2d');
    this.paleta = this.leerPaleta(lienzo);
    this.sembrar();
  }

  /** El foco del fenómeno: el centro de la zona libre a la derecha del
   *  panel del relato. Así la acción del lienzo nunca queda detrás del
   *  vidrio, sea cual sea el ancho. */
  private focoX(): number {
    const w = this.ancho;
    const relleno = Math.min(48, Math.max(24, w * 0.05));
    const anchoPanel = Math.min(520, (w - relleno * 2) * 0.5);
    const libreInicio = relleno + anchoPanel;
    return libreInicio + (w - relleno - libreInicio) * 0.55;
  }

  /** Posición del nodo: en el foco del fenómeno (escritorio) o centrado
   *  arriba en móvil. */
  private nodo(): { x: number; y: number } {
    if (this.ancho >= 760) return { x: this.focoX(), y: this.alto * 0.5 };
    return { x: this.ancho * 0.5, y: this.alto * 0.4 };
  }

  /** Lee la paleta desde el propio elemento del lienzo. */
  private leerPaleta(lienzo: HTMLCanvasElement): Paleta {
    const e = getComputedStyle(lienzo);
    return {
      reticula: token(e, '--ev-reticula', 'rgba(150,170,230,0.07)'),
      texto:    token(e, '--ev-texto', '#C9D1E4'),
      cota:     token(e, '--ev-cota', '#7E88A0'),
      senal:    token(e, '--ev-senal', '#8FA6CE'),
      primario: token(e, '--color-primary', '#FF7A1A'),
      plano:    token(e, '--ev-plano', 'rgba(4, 7, 13, 0.55)'),
    };
  }

  /** Relee la paleta (cambio de tema) desde el elemento del lienzo. */
  releerPaleta(lienzo: HTMLCanvasElement): void {
    this.paleta = this.leerPaleta(lienzo);
  }

  /** Siembra las señales con el PRNG determinista. */
  private sembrar(): void {
    const azar = mulberry32(20261013);
    this.senales = Array.from({ length: 42 }, () => ({
      x: 0.06 + azar() * 0.88,
      y: 0.08 + azar() * 0.84,
      vx: (azar() - 0.5) * 0.012,
      vy: (azar() - 0.5) * 0.01,
      fase: azar() * Math.PI * 2,
      aleatoria: azar() < 0.32,
    }));
  }

  /* ── Utilidades de dibujo ─────────────────────────────────────── */

  /** El plano ya no pinta fondo: el lienzo es transparente y detrás vive el
   *  cielo de constelaciones (el fondo único de la página). Aquí sólo queda
   *  el resplandor cálido que orienta la escena. */
  private plano(): void {
    const { ctx, ancho: w, alto: h } = this;
    const resplandor = ctx.createRadialGradient(w * 0.62, h * 0.55, 0, w * 0.62, h * 0.55, Math.max(w, h) * 0.7);
    resplandor.addColorStop(0, 'rgba(255, 122, 26, 0.05)');
    resplandor.addColorStop(1, 'rgba(255, 122, 26, 0)');
    ctx.fillStyle = resplandor;
    ctx.fillRect(0, 0, w, h);
  }

  /** Una señal como punto suave; `brillo` la enciende, `hueca` la deja en aro. */
  private punto(s: Senal, px: number, py: number, brillo: number, hueca: boolean, alfa: number): void {
    const { ctx, paleta: p } = this;
    const radio = 2.2 + brillo * 1.6;
    ctx.globalAlpha = alfa * (0.5 + brillo * 0.5);
    if (hueca) {
      ctx.beginPath();
      ctx.arc(px, py, radio + 1.4, 0, Math.PI * 2);
      ctx.strokeStyle = p.senal;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      const halo = ctx.createRadialGradient(px, py, 0, px, py, radio * 4);
      halo.addColorStop(0, p.senal);
      halo.addColorStop(1, rgba(p.senal, 0));
      ctx.globalAlpha = alfa * (0.28 + brillo * 0.5);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, radio * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alfa * (0.55 + brillo * 0.45);
      ctx.fillStyle = brillo > 0.6 ? p.primario : p.senal;
      ctx.beginPath();
      ctx.arc(px, py, radio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** El nodo: un disco con halo, vivo o en reposo. */
  private marcaNodo(n: { x: number; y: number }, pulso: number, alfa: number): void {
    const { ctx, paleta: p } = this;
    ctx.globalAlpha = alfa * 0.25;
    const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 46 + pulso * 10);
    halo.addColorStop(0, p.primario);
    halo.addColorStop(1, rgba(p.primario, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 46 + pulso * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alfa;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = p.primario;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = rgba(p.texto, 0.8);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Rótulo mono del lienzo. */
  private rotulo(texto: string, x: number, y: number, alfa: number, alinear: CanvasTextAlign = 'left'): void {
    const { ctx, paleta: p } = this;
    ctx.globalAlpha = alfa;
    ctx.fillStyle = p.texto;
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = alinear;
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, x, y);
    ctx.globalAlpha = 1;
  }

  /** Anillo expandiéndose y desvaneciéndose (una onda de radar). */
  private anillo(x: number, y: number, fase: number, radioMax: number, alfa: number, color?: string): void {
    const { ctx, paleta: p } = this;
    if (fase <= 0 || fase >= 1) return;
    ctx.globalAlpha = alfa * (1 - fase) * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, 4 + fase * radioMax, 0, Math.PI * 2);
    ctx.strokeStyle = color ?? p.primario;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ── Escena 0 · héroe: señales que derivan y un nodo que pulsa ── */

  private escenaHero(t: number, alfa: number): void {
    const n = this.nodo();
    for (const s of this.senales) {
      const px = (((s.x + s.vx * t * 0.35) % 1) + 1) % 1 * this.ancho;
      const py = (((s.y + s.vy * t * 0.35) % 1) + 1) % 1 * this.alto;
      const d = Math.hypot(px - n.x, py - n.y);
      const cerca = Math.max(0, 1 - d / 220);
      this.punto(s, px, py, cerca * (0.6 + 0.4 * Math.sin(t * 1.4 + s.fase)), false, alfa);
    }
    const periodo = 2.6;
    for (let k = 0; k < 3; k++) {
      this.anillo(n.x, n.y, ((t / periodo) + k / 3) % 1, 120, alfa);
    }
    this.marcaNodo(n, Math.sin(t * 2) * 0.5 + 0.5, alfa);
  }

  /* ── Escena 1 · el problema: el plano casi apagado ────────────── */

  private escenaVacio(t: number, alfa: number): void {
    const { ctx, ancho: w, alto: h, paleta: p } = this;
    // El plano del espacio, apenas insinuado: la incógnita antes del dato.
    const pw = Math.min(w * 0.62, 640);
    const ph = pw * (11.84 / 21);
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    const respirar = 0.5 + 0.5 * Math.sin(t * 0.7);
    ctx.globalAlpha = alfa * (0.25 + respirar * 0.2);
    ctx.strokeStyle = p.reticula;
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);
    const paso = pw / 10;
    ctx.beginPath();
    for (let i = 1; i < 10; i++) {
      ctx.moveTo(px + i * paso, py);
      ctx.lineTo(px + i * paso, py + ph);
    }
    for (let j = 1; j < 5; j++) {
      ctx.moveTo(px, py + j * (ph / 5));
      ctx.lineTo(px + pw, py + j * (ph / 5));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Señales casi apagadas: el dato existe, nadie lo lee.
    for (const s of this.senales) {
      const pxs = s.x * w;
      const pys = s.y * h;
      this.punto(s, pxs, pys, 0, false, alfa * 0.16);
    }
  }

  /* ── Escena 2 · el aire: cada señal emite su probe request ────── */

  private escenaAire(t: number, alfa: number): void {
    const { ctx, paleta: p } = this;
    const n = this.nodo();
    // El escogido para explicar: la señal más lejana del nodo. Al leerla,
    // el rótulo vive lejos de la etiqueta del propio nodo y no la roza.
    const anclaX = n.x - Math.min(320, this.ancho * 0.42);
    const anclaY = Math.max(60, n.y - Math.min(180, this.alto * 0.24));
    let escogida = -1;
    let menor = Infinity;
    this.senales.forEach((s, k) => {
      const qx = (s.x * 0.92 + 0.03) * this.ancho;
      const qy = (s.y * 0.9 + 0.05) * this.alto;
      const d = Math.hypot(qx - anclaX, qy - anclaY);
      if (d < menor) { menor = d; escogida = k; }
    });

    this.senales.forEach((s, i) => {
      const px = (s.x * 0.92 + 0.03) * this.ancho + Math.sin(t * 0.5 + s.fase) * 6;
      const py = (s.y * 0.9 + 0.05) * this.alto + Math.cos(t * 0.4 + s.fase) * 5;
      const fase = (t * 0.4 + s.fase) % 1;
      this.anillo(px, py, fase, 54, alfa * 0.8, this.paleta.senal);
      this.punto(s, px, py, 0.25, s.aleatoria, alfa);
    });

    // El rótulo sale hacia fuera del nodo: si la señal escogida queda a la
    // derecha de él, la línea cuelga a la izquierda y no roza la etiqueta
    // del propio nodo.
    if (escogida >= 0) {
      const sr = this.senales[escogida];
      const px2 = (sr.x * 0.92 + 0.03) * this.ancho + Math.sin(t * 0.5 + sr.fase) * 6;
      const py2 = (sr.y * 0.9 + 0.05) * this.alto + Math.cos(t * 0.4 + sr.fase) * 5;
      const haciaFuera = px2 >= n.x;
      ctx.globalAlpha = alfa * 0.8;
      ctx.strokeStyle = p.cota;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (haciaFuera) {
        ctx.moveTo(px2 - 8, py2 - 8);
        ctx.lineTo(px2 - 34, py2 - 32);
        ctx.lineTo(px2 - 42, py2 - 32);
      } else {
        ctx.moveTo(px2 + 8, py2 - 8);
        ctx.lineTo(px2 + 34, py2 - 32);
        ctx.lineTo(px2 + 42, py2 - 32);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (haciaFuera) {
        this.rotulo('probe request', px2 - 46, py2 - 32, alfa * 0.9, 'right');
      } else {
        this.rotulo('probe request', px2 + 46, py2 - 32, alfa * 0.9);
      }
    }
    this.marcaNodo(n, 0.2, alfa * 0.55);
    this.rotulo('nodo de captura', n.x + 14, n.y + 18, alfa * 0.75);
  }

  /* ── Escena 3 · el nodo: el barrido marca y captura ───────────── */

  private escenaNodo(t: number, alfa: number): void {
    const { ctx, paleta: p } = this;
    const n = this.nodo();
    const periodo = 4.2;
    const anguloBarrido = ((t % periodo) / periodo) * Math.PI * 2;

    // El sector del barrido, translúcido, con el borde que avanza bien marcado.
    ctx.globalAlpha = alfa;
    const radioBarrido = Math.min(this.ancho, this.alto) * 0.44;
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radioBarrido);
    g.addColorStop(0, rgba(p.primario, 0.1));
    g.addColorStop(1, rgba(p.primario, 0.02));
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.arc(n.x, n.y, radioBarrido, anguloBarrido - 0.5, anguloBarrido);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(n.x + Math.cos(anguloBarrido) * radioBarrido, n.y + Math.sin(anguloBarrido) * radioBarrido);
    ctx.strokeStyle = p.primario;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Cada señal destella cuando el barrido pasa por su ángulo.
    this.senales.forEach((s, i) => {
      const px = (s.x * 0.92 + 0.03) * this.ancho;
      const py = (s.y * 0.9 + 0.05) * this.alto;
      const angulo = Math.atan2(py - n.y, px - n.x);
      let delta = angulo - anguloBarrido;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      const recien = Math.max(0, 1 - Math.abs(delta) * 6);
      this.punto(s, px, py, recien, s.aleatoria, alfa);
      if (recien > 0.55) {
        ctx.globalAlpha = alfa * (recien - 0.55) * 1.4;
        ctx.strokeStyle = p.primario;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Las MAC aleatorizadas se marcan: una de ellas, rotulada.
      if (s.aleatoria && i === 9 && recien > 0.4) {
        this.rotulo('MAC aleatoria · bit U/L', px + 12, py - 16, alfa * recien);
      }
    });
    this.marcaNodo(n, 0.7, alfa);
  }

  /* ── Escena 4 · el borde: la identidad muere en el nodo ───────── */

  private escenaBorde(t: number, alfa: number): void {
    const { ctx, paleta: p } = this;
    const n = this.nodo();
    // Las señales convergen al nodo y ahí se disuelven.
    this.senales.forEach((s) => {
      const ciclo = (t * 0.3 + s.fase / (Math.PI * 2)) % 1;
      const origenX = (s.x * 0.92 + 0.03) * this.ancho;
      const origenY = (s.y * 0.9 + 0.05) * this.alto;
      const viaje = Math.min(1, ciclo / 0.62);
      const px = origenX + (n.x - origenX) * suavizar(viaje);
      const py = origenY + (n.y - origenY) * suavizar(viaje);
      this.punto(s, px, py, viaje * 0.7, false, alfa * (ciclo > 0.94 ? (1 - ciclo) / 0.06 : 1));
    });
    this.marcaNodo(n, 0.5 + 0.5 * Math.sin(t * 3), alfa);

    // Del nodo sale un hilo de tokens sin dueño.
    const salidaY = n.y;
    const salidaX = n.x + 18;
    const largo = Math.min(190, this.ancho - salidaX - 40);
    if (largo > 80) {
      ctx.globalAlpha = alfa;
      ctx.strokeStyle = p.cota;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.moveTo(salidaX, salidaY);
      ctx.lineTo(salidaX + largo, salidaY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      const tokens = 4;
      for (let j = 0; j < tokens; j++) {
        const fase = (t * 0.22 + j / tokens) % 1;
        const tx = salidaX + fase * largo;
        const aparicion = Math.min(1, fase / 0.12, (1 - fase) / 0.12);
        this.rotulo(FRAGMENTOS_HASH[(j + Math.floor(t * 0.22)) % FRAGMENTOS_HASH.length],
          tx, salidaY - 14, alfa * aparicion * 0.9, 'center');
      }
      this.rotulo('HMAC-SHA256 · dentro del nodo', salidaX, salidaY + 20, alfa * 0.85);
    }
  }

  /* ── Escena 5 · el flujo: paquetes cifrados hacia el procesamiento ── */

  private escenaFlujo(t: number, alfa: number): void {
    const { ctx, paleta: p } = this;
    const n = this.nodo();
    const bloqueAncho = 176;
    const bloqueAlto = 92;
    // El canal baja del nodo al bloque: cabe en cualquier ancho y se lee
    // como una cascada de datos.
    const bloqueX = n.x;
    const bloqueY = Math.min(n.y + 205, this.alto - bloqueAlto / 2 - 30);

    // El nodo sigue ahí: de él parte el canal.
    this.marcaNodo(n, 0.6, alfa);

    // Conduit: la ruta del canal, con un codo suave hacia el bloque.
    ctx.globalAlpha = alfa * 0.9;
    ctx.strokeStyle = p.cota;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.moveTo(n.x, n.y + 14);
    ctx.lineTo(n.x, bloqueY - bloqueAlto / 2 - 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Paquetes en tránsito, cayendo por el canal.
    const paquetes = 10;
    const caida = bloqueY - bloqueAlto / 2 - 10 - (n.y + 14);
    for (let j = 0; j < paquetes; j++) {
      const fase = (t * 0.2 + j / paquetes) % 1;
      const py = n.y + 14 + caida * fase;
      const aparicion = Math.min(1, fase / 0.08, (1 - fase) / 0.08);
      ctx.globalAlpha = alfa * aparicion;
      ctx.fillStyle = p.primario;
      ctx.beginPath();
      ctx.roundRect(bloqueX - 6, py - 4.5, 12, 9, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // El bloque de procesamiento con sus ventanas de agregación.
    ctx.globalAlpha = alfa;
    ctx.strokeStyle = p.cota;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(bloqueX - bloqueAncho / 2, bloqueY - bloqueAlto / 2, bloqueAncho, bloqueAlto, 8);
    ctx.stroke();
    const barras = 7;
    const ventana = (t * 0.28) % 1;
    const anchoBarra = (bloqueAncho - 32) / barras;
    for (let b = 0; b < barras; b++) {
      const llena = b / barras < ventana;
      const altura = llena ? 16 + ((b * 37) % 26) : 4;
      ctx.fillStyle = llena ? p.primario : p.cota;
      ctx.globalAlpha = alfa * (llena ? 0.85 : 0.4);
      ctx.fillRect(bloqueX - bloqueAncho / 2 + 16 + b * anchoBarra, bloqueY + bloqueAlto / 2 - 14 - altura, anchoBarra - 6, altura);
    }
    ctx.globalAlpha = alfa;
    ctx.fillStyle = p.texto;
    ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('procesamiento', bloqueX, bloqueY - bloqueAlto / 2 - 14);
    this.rotulo('SSL/TLS · Kafka', bloqueX + 14, (n.y + 14 + bloqueY) / 2, alfa * 0.85, 'left');
    ctx.globalAlpha = 1;
  }

  /* ── Escena 6 · el mapa: el plano se enciende con la rampa real ── */

  private escenaMapa(t: number, alfa: number): void {
    const { ctx, ancho: w, alto: h, paleta: p, auxCtx } = this;
    if (!auxCtx) return;
    const pw = Math.min(
      (w >= 760 ? 0.46 : 0.84) * w,
      560,
      2 * (w - this.focoX() - 20),
    );
    const ph = pw * (11.84 / 21);
    const px = w >= 760 ? this.focoX() - pw / 2 : (w - pw) / 2;
    const py = (h - ph) / 2;
    const escala = pw / 21;

    // Plano y retícula de un metro, como el mapa real.
    ctx.globalAlpha = alfa;
    ctx.fillStyle = p.plano;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = p.reticula;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 21; i++) {
      ctx.moveTo(px + i * escala, py);
      ctx.lineTo(px + i * escala, py + ph);
    }
    for (let j = 1; j < 12; j++) {
      ctx.moveTo(px, py + j * (ph / 11.84) * 1);
      ctx.lineTo(px + pw, py + j * (ph / 11.84) * 1);
    }
    ctx.stroke();
    ctx.strokeStyle = p.cota;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pw, ph);
    ctx.globalAlpha = 1;

    // El calor: intensidad acumulada en gris y vuelta color con la rampa.
    // Muchos focos chicos y superpuestos: se funden en campos orgánicos,
    // como el mapa real, en lugar de círculos aislados.
    auxCtx.clearRect(0, 0, this.aux.width, this.aux.height);
    const azar = mulberry32(77);
    const focos = Array.from({ length: 16 }, (_, i) => ({
      fx: 0.12 + azar() * 0.76,
      fy: 0.14 + azar() * 0.72,
      base: 0.35 + azar() * 0.5,
      fase: azar() * Math.PI * 2,
      principal: i < 3,
    }));
    for (const f of focos) {
      const intensidad = Math.max(0, Math.min(1, f.base + 0.18 * Math.sin(t * 0.6 + f.fase)));
      const cx = f.fx * this.aux.width;
      const cy = f.fy * this.aux.height;
      const radioAux = this.aux.width * (f.principal ? 0.11 : 0.07);
      const g = auxCtx.createRadialGradient(cx, cy, 0, cx, cy, radioAux);
      g.addColorStop(0, `rgba(0,0,0,${intensidad})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      auxCtx.fillStyle = g;
      auxCtx.beginPath();
      auxCtx.arc(cx, cy, radioAux, 0, Math.PI * 2);
      auxCtx.fill();
    }
    const imagen = auxCtx.getImageData(0, 0, this.aux.width, this.aux.height);
    const datos = imagen.data;
    for (let i = 0; i < datos.length; i += 4) {
      const a = datos[i + 3];
      if (a === 0) continue;
      const c = this.tabla[a];
      datos[i] = c[0]; datos[i + 1] = c[1]; datos[i + 2] = c[2]; datos[i + 3] = c[3];
    }
    auxCtx.putImageData(imagen, 0, 0);
    ctx.save();
    ctx.globalAlpha = alfa * 0.92;
    ctx.drawImage(this.aux, px, py, pw, ph);
    ctx.restore();

    // Los tres nodos sobre el plano, como en la sección pública.
    const nodos = [
      { x: 0.14, y: 0.76 }, { x: 0.86, y: 0.76 }, { x: 0.5, y: 0.06 },
    ];
    for (const nd of nodos) {
      const nx = px + nd.x * pw;
      const ny = py + nd.y * ph;
      ctx.globalAlpha = alfa;
      ctx.beginPath();
      ctx.arc(nx, ny, 6, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.plano, 0.35);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(nx, ny, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = p.primario;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = rgba(p.texto, 0.9);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Conteo estimado, vivo.
    const pasos = [38, 41, 44, 47, 45, 49, 52, 48];
    const valor = pasos[Math.floor(t / 1.8) % pasos.length];
    ctx.globalAlpha = alfa * 0.95;
    ctx.fillStyle = p.texto;
    ctx.font = '600 15px "Space Grotesk", "Inter", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`ocupación estimada · ${valor}`, px + pw, py - 12);
    ctx.globalAlpha = 1;

    // La rampa, como leyenda del dato.
    const leyendaY = py + ph + 26;
    const leyendaAncho = Math.min(190, pw * 0.5);
    const gL = ctx.createLinearGradient(px, 0, px + leyendaAncho, 0);
    for (const [parada, color] of RAMPA) gL.addColorStop(parada, color);
    ctx.globalAlpha = alfa * 0.9;
    ctx.fillStyle = gL;
    ctx.fillRect(px, leyendaY, leyendaAncho, 4);
    ctx.globalAlpha = alfa * 0.8;
    ctx.fillStyle = p.cota;
    ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('menos', px, leyendaY + 16);
    ctx.textAlign = 'right';
    ctx.fillText('más dispositivos', px + leyendaAncho, leyendaY + 16);
    ctx.globalAlpha = 1;
  }

  /* ── Orquestación ─────────────────────────────────────────────── */

  /** Un cuadro: fondo opaco y, sobre él, las escenas activas fundidas. */
  dibujar(escena: number, t: number): void {
    const { ctx } = this;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.ancho, this.alto);
    this.plano();
    const i = Math.max(0, Math.min(6, Math.floor(escena)));
    const f = Math.max(0, Math.min(1, escena - i));
    const escenas = [
      (tt: number, a: number) => this.escenaHero(tt, a),
      (tt: number, a: number) => this.escenaVacio(tt, a),
      (tt: number, a: number) => this.escenaAire(tt, a),
      (tt: number, a: number) => this.escenaNodo(tt, a),
      (tt: number, a: number) => this.escenaBorde(tt, a),
      (tt: number, a: number) => this.escenaFlujo(tt, a),
      (tt: number, a: number) => this.escenaMapa(tt, a),
    ];
    if (f < 0.02 || i === 6) {
      escenas[i](t, 1);
    } else {
      escenas[i](t, 1 - f);
      escenas[i + 1](t, f);
    }
  }

  /** Ajusta el tamaño del lienzo a su contenedor, a la densidad real. */
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

/* ══ Componente de la página ════════════════════════════════════════ */

/**
 * Página «¿Qué es PlaceAt?».
 *
 * No requiere autenticación. El contenido vive en el HTML (los pasos, las
 * cifras, los principios); el lienzo es ilustración del mismo relato y queda
 * fuera del árbol accesible.
 */
@Component({
  selector: 'app-acerca',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './acerca.html',
  styleUrl: './acerca.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Acerca implements AfterViewInit, OnDestroy {
  /** Datos del relato, expuestos a la plantilla. */
  readonly etapas = ETAPAS;
  readonly capacidades = CAPACIDADES;
  readonly principios = PRINCIPIOS;
  readonly limites = LIMITES;

  /** Valores vivos de las cifras (0 → valor final al entrar en vista). */
  private readonly valoresInternos = signal<number[]>(CIFRAS.map(() => 0));
  textoCifra(indice: number): string {
    const c = CIFRAS[indice];
    const v = this.valoresInternos()[indice];
    return `${v.toFixed(c.decimales).replace('.', ',')}${c.sufijo}`;
  }

  /** Qué mide la cifra, en la voz de quien lo vive. */
  lecturaCifra(indice: number): string {
    return CIFRAS[indice].lectura;
  }

  /** La cifra final ya formateada, para lectores de pantalla. */
  cifraFinal(indice: number): string {
    const c = CIFRAS[indice];
    return `${c.valor.toFixed(c.decimales).replace('.', ',')}${c.sufijo}`;
  }

  /** Etapa activa del viaje (0 = héroe, 1 = cifras, 2…6 = pasos). */
  readonly etapaActiva = signal(0);

  /** Referencias al DOM que el motor necesita. */
  private readonly lienzoRef = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private readonly escenarioRef = viewChild.required<ElementRef<HTMLElement>>('escenario');
  private readonly bloquesRef = viewChildren<ElementRef<HTMLElement>>('bloque');
  private readonly panelCifrasRef = viewChild<ElementRef<HTMLElement>>('panelCifras');
  /** Primer acto tras el relato: marca la frontera donde el lienzo se apaga. */
  private readonly actoPrivacidadRef = viewChild<ElementRef<HTMLElement>>('actoPrivacidad');

  /** El riel de conexión entre tarjetas: ancho del tramo punteado. */
  private readonly relatoRef = viewChild.required<ElementRef<HTMLElement>>('relato');
  private readonly panelesRef = viewChildren<ElementRef<HTMLElement>>('panel');
  protected readonly vias = signal<Via[]>([]);
  /** Observador del relato: recalcula los tramos al cambiar el tamaño. */
  private observadorVias: ResizeObserver | null = null;

  /** Motor de escenas, creado cuando la vista existe. */
  private motor: MotorEscenas | null = null;

  /** Identificador del cuadro animado en curso. */
  private rafId: number | null = null;

  /** Observadores: tamaño, visibilidad del lienzo, cifras y tema. */
  private observadorTamano: ResizeObserver | null = null;
  private observadorEscena: IntersectionObserver | null = null;
  private observadorCifras: IntersectionObserver | null = null;
  private observadorTema: MutationObserver | null = null;

  /** `true` si el sistema pidió reducir el movimiento. */
  private movimientoReducido = false;

  /** Última escena estática dibujada, para no redibujar en vano. */
  private ultimaEstatica = '';

  /** Momento de arranque de la animación de cifras. */
  private inicioCifras: number | null = null;
  private rafCifras: number | null = null;

  ngAfterViewInit(): void {
    this.movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lienzo = this.lienzoRef().nativeElement;
    const escenario = this.escenarioRef().nativeElement;

    this.motor = new MotorEscenas(lienzo);
    this.ajustarTamano();

    // El bucle sólo corre con el lienzo a la vista y sin «reducir movimiento».
    this.observadorEscena = new IntersectionObserver((entradas) => {
      const visible = entradas.some((e) => e.isIntersecting);
      if (visible && !this.movimientoReducido) this.arrancar();
      else this.detener();
      if (visible && this.movimientoReducido) this.dibujarEstatico();
    }, { rootMargin: '80px' });
    this.observadorEscena.observe(escenario);

    this.observadorTamano = new ResizeObserver(() => {
      this.ajustarTamano();
      if (this.movimientoReducido) this.dibujarEstatico();
    });
    this.observadorTamano.observe(escenario);

    // El cambio de tema relee la paleta sin reconstruir el motor.
    this.observadorTema = new MutationObserver(() => {
      this.motor?.releerPaleta(lienzo);
      if (this.movimientoReducido) this.dibujarEstatico();
    });
    this.observadorTema.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    // Las cifras cuentan al entrar en vista.
    const panelCifras = this.panelCifrasRef()?.nativeElement;
    if (panelCifras) {
      this.observadorCifras = new IntersectionObserver((entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          this.animarCifras();
          this.observadorCifras?.disconnect();
        }
      }, { threshold: 0.35 });
      this.observadorCifras.observe(panelCifras);
    }

    // El scroll sólo actualiza la etapa activa; el dibujo lee la posición en
    // cada cuadro, así que no necesita escuchar el scroll por su cuenta.
    if (this.movimientoReducido) {
      window.addEventListener('scroll', this.alHacerScrollEstatico, { passive: true });
      this.dibujarEstatico();
    } else {
      this.arrancar();
    }

    // El riel de conexión: mide los paneles y se recalcula al reflujo.
    this.recalcularVias();
    this.observadorVias = new ResizeObserver(() => this.recalcularVias());
    this.observadorVias.observe(this.relatoRef().nativeElement);
    (document as { fonts?: { ready: Promise<unknown> } }).fonts?.ready.then(() => this.recalcularVias());

    // El imán del relato: centra el paso activo cuando el scroll se detiene.
    if (!this.movimientoReducido) {
      window.addEventListener('scroll', this.asentar, { passive: true });
    }

    this.actualizarDesvanecer();
  }

  ngOnDestroy(): void {
    this.detener();
    if (this.rafCifras !== null) cancelAnimationFrame(this.rafCifras);
    this.observadorTamano?.disconnect();
    this.observadorEscena?.disconnect();
    this.observadorCifras?.disconnect();
    this.observadorTema?.disconnect();
    this.observadorVias?.disconnect();
    window.removeEventListener('scroll', this.alHacerScrollEstatico);
    window.removeEventListener('scroll', this.asentar);
    if (this.temporizadorCentrar !== null) clearTimeout(this.temporizadorCentrar);
  }

  /** Ajusta el lienzo al tamaño del escenario. */
  private ajustarTamano(): void {
    const escenario = this.escenarioRef().nativeElement;
    this.motor?.redimensionar(escenario.clientWidth, escenario.clientHeight);
  }

  /**
   * Mide las tarjetas y dibuja los tramos punteados que las enlazan.
   *
   * Cada tramo baja del borde inferior de una tarjeta al superior de la
   * siguiente, por la columna del riel numeral cuando el panel lo tiene
   * (los pasos) o por el centro del panel (las cifras). Si cambia de
   * columna, el tramo se curva — como una constelación enlazada.
   * Las coordenadas son relativas al relato; el SVG se dibuja encima.
   */
  private recalcularVias(): void {
    const relato = this.relatoRef().nativeElement;
    const paneles = this.panelesRef();
    if (paneles.length < 2) { this.vias.set([]); return; }
    const rRel = relato.getBoundingClientRect();
    const marcas = paneles.map((p) => {
      const r = p.nativeElement.getBoundingClientRect();
      const riel = p.nativeElement.querySelector('.paso-riel')?.getBoundingClientRect();
      return {
        centro: r.left + r.width / 2 - rRel.left,
        rielX: riel ? riel.left + riel.width / 2 - rRel.left : null,
        inferior: r.bottom - rRel.top,
        superior: r.top - rRel.top,
      };
    });
    const vias: Via[] = [];
    for (let i = 0; i < marcas.length - 1; i++) {
      const a = marcas[i];
      const b = marcas[i + 1];
      const ay = a.inferior + 16;
      const by = b.superior - 16;
      if (by - ay < 24) continue;
      const bx = b.rielX ?? b.centro;
      const ax = a.rielX ?? a.centro;
      const caida = by - ay;
      const d = Math.abs(ax - bx) < 4
        ? `M ${ax} ${ay} L ${bx} ${by}`
        : `M ${ax} ${ay} C ${ax} ${ay + caida * 0.45}, ${bx} ${by - caida * 0.45}, ${bx} ${by}`;
      vias.push({ d, ax, ay, bx, by });
    }
    this.vias.set(vias);
  }

  /** Arranca el bucle de animación. */
  private arrancar(): void {
    if (this.rafId !== null) return;
    const cuadro = () => {
      this.rafId = requestAnimationFrame(cuadro);
      this.dibujarCuadro();
    };
    this.rafId = requestAnimationFrame(cuadro);
  }

  /** Detiene el bucle de animación. */
  private detener(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Un cuadro: lee la escena flotante y la pinta; actualiza la etapa activa. */
  private dibujarCuadro(): void {
    if (!this.motor) return;
    const t = performance.now() / 1000;
    const escena = this.progresoEscena();
    this.motor.dibujar(escena, t);
    const etapa = Math.max(0, Math.min(6, Math.round(escena)));
    if (etapa !== this.etapaActiva()) this.etapaActiva.set(etapa);
    this.actualizarDesvanecer();
  }

  /**
   * Frontera del relato: cuando el acto siguiente entra en el viewport,
   * el lienzo se desvanece — el cielo de constelaciones sigue, la escena
   * del mapa no compite con el texto de los actos.
   */
  private actualizarDesvanecer(): void {
    const acto = this.actoPrivacidadRef()?.nativeElement;
    if (!acto) return;
    const cerca = acto.getBoundingClientRect().top < window.innerHeight * 0.92;
    this.escenarioRef().nativeElement.classList.toggle('desvanecer', cerca);
  }

  /** Escena estática para «reducir movimiento»: se dibuja al cambiar de etapa. */
  private dibujarEstatico(): void {
    if (!this.motor) return;
    const escena = Math.round(this.progresoEscena());
    const clave = `${escena}|${this.motor.ancho}x${this.motor.alto}`;
    if (clave === this.ultimaEstatica) return;
    this.ultimaEstatica = clave;
    this.motor.dibujar(escena, 8);
    if (escena !== this.etapaActiva()) this.etapaActiva.set(escena);
  }

  /** Receptor de scroll en modo estático. */
  private readonly alHacerScrollEstatico = (): void => {
    this.dibujarEstatico();
    this.actualizarDesvanecer();
  };

  /** Imán del scroll: temporizador del asentado tras dejar de rodar. */
  private temporizadorCentrar: number | null = null;

  /** `true` mientras un desplazamiento propio (botón «Así funciona») viaja. */
  private desplazandoPropio = false;

  /** Receptor del imán: asienta cuando el rueda se detiene. */
  private readonly asentar = (): void => {
    if (this.temporizadorCentrar !== null) clearTimeout(this.temporizadorCentrar);
    this.temporizadorCentrar = window.setTimeout(() => {
      this.temporizadorCentrar = null;
      this.alinearRelato();
    }, 150);
  };

  /**
   * El imán del relato: si al dejar de rodar el centro de atención quedó
   * cerca del centro exacto de la pantalla, desliza el resto — el paso
   * «se alinea solo», con un empujón corto, sin robarle el scroll al
   * usuario. Sólo corrige cuando estaba cerca (un tercio del viewport) y
   * nunca en móvil, donde el relato fluye sin etapas a pantalla completa.
   */
  private alinearRelato(): void {
    if (this.desplazandoPropio || window.innerWidth <= 768) return;
    const bloques = this.bloquesRef();
    if (bloques.length === 0) return;
    const centro = window.innerHeight / 2;
    let elegido: HTMLElement = bloques[0].nativeElement;
    let menor = Infinity;
    for (const b of bloques) {
      const r = b.nativeElement.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - centro);
      if (d < menor) { menor = d; elegido = b.nativeElement; }
    }
    const r = elegido.getBoundingClientRect();
    const delta = r.top + r.height / 2 - centro;
    if (Math.abs(delta) <= 10 || Math.abs(delta) > window.innerHeight * 0.3) return;
    window.scrollBy({ top: delta, behavior: 'smooth' });
  }

  /**
   * Escena flotante según el centro del viewport: los bloques del relato
   * (héroe, cifras y cinco pasos) son los anclajes; entre dos anclajes se
   * interpola linealmente para fundir las escenas.
   */
  private progresoEscena(): number {
    const bloques = this.bloquesRef();
    if (bloques.length === 0) return 0;
    // En móvil el relato lee bajo la banda del lienzo: el centro de
    // atención está más abajo del centro exacto del viewport.
    const centro = window.innerHeight * (window.innerWidth <= 768 ? 0.68 : 0.5);
    const mids = bloques.map((b) => {
      const r = b.nativeElement.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    if (centro <= mids[0]) return 0;
    const ultima = mids.length - 1;
    if (centro >= mids[ultima]) return ultima;
    for (let i = 0; i < ultima; i++) {
      if (centro < mids[i + 1]) {
        return i + (centro - mids[i]) / (mids[i + 1] - mids[i]);
      }
    }
    return ultima;
  }

  /** Anima las cifras de 0 a su valor, con freno natural. */
  private animarCifras(): void {
    if (this.movimientoReducido) {
      this.valoresInternos.set(CIFRAS.map((c) => c.valor));
      return;
    }
    if (this.inicioCifras !== null) return;
    this.inicioCifras = performance.now();
    const duracion = 1400;
    const cuadro = () => {
      const t = Math.min(1, (performance.now() - this.inicioCifras!) / duracion);
      const k = suavizar(t);
      this.valoresInternos.set(CIFRAS.map((c) => c.valor * k));
      if (t < 1) this.rafCifras = requestAnimationFrame(cuadro);
      else this.rafCifras = null;
    };
    this.rafCifras = requestAnimationFrame(cuadro);
  }

  /** Lleva la vista al primer acto del relato (el botón «Así funciona»). */
  irAlRelato(): void {
    this.desplazandoPropio = true;
    const bloques = this.bloquesRef();
    const destino = bloques[1]?.nativeElement;
    destino?.scrollIntoView({
      behavior: this.movimientoReducido ? 'auto' : 'smooth',
      block: 'start',
    });
    window.setTimeout(() => (this.desplazandoPropio = false), 800);
  }
}
