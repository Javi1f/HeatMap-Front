import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CifraDirective, leerCifra } from './cifra.directive';

/** Anfitrión con un texto que se puede cambiar desde la prueba. */
@Component({
  standalone: true,
  imports: [CifraDirective],
  template: '<span [appCifra]="texto()"></span>',
})
class Anfitrion {
  /** Texto que recibe la directiva. */
  texto = signal('127 dispositivos');
}

describe('leerCifra', () => {
  it('lee el primer número con su signo, decimales y separador', () => {
    expect(leerCifra('-76.5 dBm')).toEqual({ valor: -76.5, decimales: 1, separador: '.', agrupado: false, literal: '-76.5' });
    expect(leerCifra('3,25 m y 4')).toEqual({ valor: 3.25, decimales: 2, separador: ',', agrupado: false, literal: '3,25' });
    expect(leerCifra('12 de 20')).toEqual({ valor: 12, decimales: 0, separador: '.', agrupado: false, literal: '12' });
    expect(leerCifra('48\u202F213 tramas')).toEqual({ valor: 48213, decimales: 0, separador: '.', agrupado: true, literal: '48\u202F213' });
  });

  it('sin número devuelve null', () => {
    expect(leerCifra('Sin datos')).toBeNull();
  });
});

describe('CifraDirective', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let cuadros: Map<number, FrameRequestCallback>;
  let siguiente: number;
  let ahora: number;
  let reducir: boolean;

  /** Texto visible del elemento. */
  const texto = () => (fixture.nativeElement as HTMLElement).querySelector('span')?.textContent;

  /** Avanza el reloj y ejecuta los fotogramas pendientes. */
  const avanzar = (ms: number) => {
    ahora += ms;
    const pendientes = [...cuadros.values()];
    cuadros.clear();
    pendientes.forEach((cuadro) => cuadro(ahora));
  };

  /** Crea el anfitrión y ejecuta la primera detección de cambios. */
  const crear = () => {
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  };

  beforeEach(() => {
    cuadros = new Map();
    siguiente = 1;
    ahora = 1000;
    reducir = false;
    vi.stubGlobal('requestAnimationFrame', vi.fn((cuadro: FrameRequestCallback) => {
      const id = siguiente++;
      cuadros.set(id, cuadro);
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => cuadros.delete(id)));
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reducir })));
    vi.spyOn(performance, 'now').mockImplementation(() => ahora);
  });

  afterEach(() => {
    fixture?.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('cuenta desde cero hasta el valor, conservando el resto del texto', () => {
    crear();
    avanzar(450);
    const intermedio = Number(texto()?.split(' ')[0]);
    expect(intermedio).toBeGreaterThan(0);
    expect(intermedio).toBeLessThan(127);
    expect(texto()).toMatch(/^\d+ dispositivos$/);

    avanzar(450);
    expect(texto()).toBe('127 dispositivos');
    expect(cuadros.size).toBe(0);
  });

  it('un valor nuevo cuenta desde el anterior y respeta decimales y separador', () => {
    crear();
    avanzar(900);

    fixture.componentInstance.texto.set('130,5 dispositivos');
    fixture.detectChanges();
    avanzar(1);
    const valor = Number(texto()?.split(' ')[0].replace(',', '.'));
    expect(valor).toBeGreaterThanOrEqual(127);
    expect(valor).toBeLessThan(130.5);
    expect(texto()).toMatch(/^\d+,\d dispositivos$/);

    avanzar(900);
    expect(texto()).toBe('130,5 dispositivos');
  });

  it('conserva los miles separados mientras cuenta', () => {
    fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.texto.set('48\u202F213 tramas');
    fixture.detectChanges();
    avanzar(450);
    expect(texto()).toMatch(/^\d{1,3}(\u202F\d{3})* tramas$/);
    avanzar(450);
    expect(texto()).toBe('48\u202F213 tramas');
  });

  it('si llega otro valor a mitad de la cuenta, cancela la anterior', () => {
    crear();
    avanzar(300);
    fixture.componentInstance.texto.set('5 dispositivos');
    fixture.detectChanges();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    avanzar(900);
    expect(texto()).toBe('5 dispositivos');
  });

  it('el mismo valor, un texto sin número o «reducir movimiento» se pintan al instante', () => {
    crear();
    avanzar(900);

    fixture.componentInstance.texto.set('127 dispositivos ahora');
    fixture.detectChanges();
    expect(texto()).toBe('127 dispositivos ahora');

    fixture.componentInstance.texto.set('Sin datos');
    fixture.detectChanges();
    expect(texto()).toBe('Sin datos');

    reducir = true;
    fixture.componentInstance.texto.set('40 dispositivos');
    fixture.detectChanges();
    expect(texto()).toBe('40 dispositivos');
    expect(cuadros.size).toBe(0);
  });

  it('sin fotogramas ni matchMedia pinta el valor final', () => {
    vi.stubGlobal('matchMedia', undefined);
    crear();
    expect(texto()).toBe('127 dispositivos');
  });

  it('al destruirse cancela la cuenta pendiente', () => {
    crear();
    fixture.destroy();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
