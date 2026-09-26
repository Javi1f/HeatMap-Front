import { activarFoco } from './foco';

describe('activarFoco', () => {
  let tarjeta: HTMLElement;
  let hijo: HTMLElement;
  let detener: () => void;

  /** Movimiento del puntero sobre un elemento, con el tipo de puntero indicado. */
  const mover = (destino: EventTarget, x: number, y: number, pointerType = 'mouse') => {
    const evento = new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(evento, 'pointerType', { value: pointerType });
    destino.dispatchEvent(evento);
  };

  beforeEach(() => {
    tarjeta = document.createElement('div');
    tarjeta.className = 'foco';
    hijo = document.createElement('span');
    tarjeta.appendChild(hijo);
    document.body.appendChild(tarjeta);
    vi.spyOn(tarjeta, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50 } as DOMRect);
  });

  afterEach(() => {
    detener?.();
    tarjeta.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('escribe la posición del cursor relativa a la tarjeta', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    detener = activarFoco(document);

    mover(hijo, 160.4, 90.6);

    expect(tarjeta.style.getPropertyValue('--mx')).toBe('60px');
    expect(tarjeta.style.getPropertyValue('--my')).toBe('41px');
  });

  it('agrupa los movimientos de un mismo fotograma y aplica el último', () => {
    const cuadros: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((cuadro: FrameRequestCallback) => cuadros.push(cuadro)));
    detener = activarFoco(document);

    mover(hijo, 110, 60);
    mover(hijo, 130, 70);
    expect(cuadros).toHaveLength(1);
    expect(tarjeta.style.getPropertyValue('--mx')).toBe('');

    cuadros[0](0);
    expect(tarjeta.style.getPropertyValue('--mx')).toBe('30px');
  });

  it('ignora los toques, lo que no está sobre una tarjeta y lo que no es un elemento', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    detener = activarFoco(document);

    mover(hijo, 160, 90, 'touch');
    mover(document.body, 160, 90);
    mover(document, 160, 90);

    expect(tarjeta.style.getPropertyValue('--mx')).toBe('');
  });

  it('al detenerse deja de escuchar', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    activarFoco(document)();

    mover(hijo, 160, 90);

    expect(tarjeta.style.getPropertyValue('--mx')).toBe('');
  });
});
