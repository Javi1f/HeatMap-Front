import { TestBed } from '@angular/core/testing';
import { BARRIDO_DESDE, BARRIDO_HASTA, ecoFondo, FondoRadarComponent, PERIODO_S } from './fondo-radar';

describe('ecoFondo', () => {
  it('sitúa el eco desde la esquina: a 270° queda a la izquierda y a 360° encima', () => {
    expect(ecoFondo(270, 40, 6)).toMatchObject({ derecha: '40vmax', abajo: '0vmax' });
    expect(ecoFondo(360, 40, 6)).toMatchObject({ derecha: '0vmax', abajo: '40vmax' });
    expect(ecoFondo(315, 10, 6)).toMatchObject({ derecha: '7.07vmax', abajo: '7.07vmax', tono: 'primario' });
  });

  it('el haz alcanza cada eco cuando su ángulo llega al del eco', () => {
    expect(ecoFondo(BARRIDO_DESDE, 10, 5).retraso).toBe(0);
    expect(ecoFondo(BARRIDO_HASTA, 10, 5).retraso).toBe(PERIODO_S);
  });
});

describe('FondoRadarComponent', () => {
  it('dibuja anillos, haz y ecos dentro de la pasada, oculto a los lectores de pantalla', () => {
    const vista = TestBed.createComponent(FondoRadarComponent);
    vista.detectChanges();
    const anfitrion = vista.nativeElement as HTMLElement;
    const ecos = anfitrion.querySelectorAll<HTMLElement>('.eco');

    expect(anfitrion.getAttribute('aria-hidden')).toBe('true');
    expect(anfitrion.querySelector('.anillos')).not.toBeNull();
    expect(anfitrion.querySelector('.barrido')).not.toBeNull();
    expect(ecos.length).toBeGreaterThan(10);
    for (const eco of ecos) {
      const retraso = parseFloat(eco.style.animationDelay);
      expect(retraso).toBeGreaterThanOrEqual(0);
      expect(retraso).toBeLessThanOrEqual(PERIODO_S);
      expect(eco.className).toMatch(/eco-(primario|ambar|rojo)/);
    }
  });
});
