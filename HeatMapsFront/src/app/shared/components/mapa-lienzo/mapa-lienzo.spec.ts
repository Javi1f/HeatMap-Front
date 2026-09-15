import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapaDibujable } from '../../../core/models/mapa.model';
import { MapaLienzoComponent } from './mapa-lienzo';

/**
 * Contexto 2D falso: jsdom no dibuja, así que se registran las llamadas.
 * `getImageData` devuelve píxeles con opacidad para que el coloreado recorra
 * tanto los transparentes como los opacos.
 */
const contextoFalso = () => {
  const llamadas: { metodo: string; args: unknown[] }[] = [];
  /** Método del contexto que sólo anota la llamada. */
  const registrar = (metodo: string) => (...args: unknown[]) => { llamadas.push({ metodo, args }); };
  const ctx: Record<string, unknown> = {
    llamadas,
    createLinearGradient: () => ({ addColorStop: registrar('addColorStop') }),
    createRadialGradient: () => ({ addColorStop: registrar('addColorStop') }),
    getImageData: (_x: number, _y: number, ancho: number, alto: number) => {
      const data = new Uint8ClampedArray(ancho * alto * 4);
      for (let i = 3; i < data.length; i += 8) data[i] = 200;
      return { data };
    },
  };
  for (const metodo of ['setTransform', 'clearRect', 'fillRect', 'strokeRect', 'save', 'restore', 'beginPath', 'rect', 'clip',
    'moveTo', 'lineTo', 'stroke', 'arc', 'fill', 'fillText', 'translate', 'rotate', 'drawImage', 'putImageData']) {
    ctx[metodo] = registrar(metodo);
  }
  return ctx as Record<string, unknown> & { llamadas: { metodo: string; args: unknown[] }[] };
};

/** Componente anfitrión: da al lienzo un contenedor cuyo ancho se puede simular. */
@Component({
  standalone: true,
  imports: [MapaLienzoComponent],
  template: `<div class="marco"><app-mapa-lienzo [mapa]="mapa()" /></div>`,
})
class Anfitrion {
  /** Mapa que se entrega al lienzo. */
  mapa = signal<MapaDibujable | null>(null);
}

const MAPA: MapaDibujable = {
  nombre: 'Plazoleta', ancho: 2, alto: 1, ladoCelda: 0.5, columnas: 4, filas: 2,
  rejilla: [[0, 2, 0, 0], [0, 0, 0, 1]], maximo: 2, situados: 3,
  nodos: [
    { nombre: 'N1', x: 0, y: 0, aportoDatos: true },
    { nombre: 'N2', x: 2, y: 1, aportoDatos: false },
  ],
};

describe('MapaLienzoComponent', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let contextos: ReturnType<typeof contextoFalso>[];
  let anchoContenedor: number;
  let observado: (() => void) | null;
  let desconectar: ReturnType<typeof vi.fn>;

  /** Lienzo visible del componente. */
  const lienzo = () => fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
  /** Llamadas a un método en todos los contextos creados. */
  const llamadas = (metodo: string) => contextos.flatMap((contexto) => contexto.llamadas).filter((llamada) => llamada.metodo === metodo);

  beforeEach(() => {
    contextos = [];
    anchoContenedor = 600;
    observado = null;
    desconectar = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => {
      const ctx = contextoFalso();
      contextos.push(ctx);
      return ctx;
    }) as never);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => anchoContenedor);
    vi.stubGlobal('ResizeObserver', class {
      /** Guarda el aviso de cambio de tamaño para dispararlo a mano. */
      constructor(fn: () => void) { observado = fn; }
      /** Sin navegador real no hay nada que observar. */
      observe = vi.fn();
      /** Desconexión espiable. */
      disconnect = desconectar;
    });

    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sin mapa ajusta el tamaño pero no dibuja nada', () => {
    expect(lienzo().style.width).toBe('600px');
    expect(llamadas('fillRect')).toHaveLength(0);
    expect(lienzo().getAttribute('aria-label')).toBe('Mapa de calor sin datos');
  });

  it('respeta la proporción del plano y describe el mapa para lectores de pantalla', () => {
    fixture.componentInstance.mapa.set(MAPA);
    fixture.detectChanges();
    // (600 - 2·26) · 1/2 + 2·26
    expect(lienzo().style.height).toBe(`${Math.round(548 / 2) + 52}px`);
    expect(lienzo().getAttribute('aria-label')).toBe('Mapa de calor de Plazoleta: 3 dispositivos situados');
  });

  it('dibuja plano, una mancha por celda ocupada, nodos y cotas', () => {
    fixture.componentInstance.mapa.set(MAPA);
    fixture.detectChanges();

    expect(llamadas('drawImage')).toHaveLength(1);
    expect(llamadas('putImageData')).toHaveLength(1);
    const textos = llamadas('fillText').map((llamada) => llamada.args[0]);
    expect(textos).toEqual(expect.arrayContaining(['N1', 'N2', '2 m', '1 m']));
    // Dos nodos, cada uno con halo y punto, más las manchas de las dos celdas con conteo.
    expect(llamadas('arc').length).toBe(2 * 2 + 2);
  });

  it('sin conteos no pinta calor', () => {
    fixture.componentInstance.mapa.set({ ...MAPA, maximo: 0, rejilla: [[0, 0, 0, 0], [0, 0, 0, 0]] });
    fixture.detectChanges();
    expect(llamadas('drawImage')).toHaveLength(0);
    expect(llamadas('fillText').length).toBeGreaterThan(0);
  });

  it('en pantallas estrechas usa el margen pequeño', () => {
    anchoContenedor = 320;
    window.dispatchEvent(new Event('resize'));
    fixture.componentInstance.mapa.set(MAPA);
    fixture.detectChanges();
    expect(lienzo().style.height).toBe(`${Math.round((320 - 32) / 2) + 32}px`);
  });

  it('redibuja sólo cuando cambia el ancho', () => {
    fixture.componentInstance.mapa.set(MAPA);
    fixture.detectChanges();
    const antes = contextos.length;

    observado?.();
    expect(contextos.length).toBe(antes);

    anchoContenedor = 800;
    observado?.();
    expect(contextos.length).toBeGreaterThan(antes);

    anchoContenedor = 0;
    const tras = contextos.length;
    window.dispatchEvent(new Event('resize'));
    expect(contextos.length).toBe(tras);
  });

  it('sin contexto 2D no falla', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    fixture.componentInstance.mapa.set(MAPA);
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('si el lienzo auxiliar no da contexto, dibuja el plano sin calor', () => {
    let pedidos = 0;
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation((() => {
      pedidos++;
      if (pedidos > 1) return null;
      const ctx = contextoFalso();
      contextos.push(ctx);
      return ctx;
    }) as never);
    fixture.componentInstance.mapa.set(MAPA);
    fixture.detectChanges();
    expect(pedidos).toBe(2);
    const ultimo = contextos[contextos.length - 1];
    expect(ultimo.llamadas.some((llamada) => llamada.metodo === 'drawImage')).toBe(false);
    expect(ultimo.llamadas.some((llamada) => llamada.metodo === 'fillText')).toBe(true);
  });

  it('desconecta el observador al destruirse', () => {
    fixture.destroy();
    expect(desconectar).toHaveBeenCalled();
  });
});
