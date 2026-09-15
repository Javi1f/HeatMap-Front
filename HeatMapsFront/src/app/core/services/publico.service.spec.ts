import { claseNivel, etiquetaNivel } from './publico.service';

describe('niveles de ocupación', () => {
  it('habla de dispositivos, no de personas', () => {
    expect(etiquetaNivel('alta')).toBe('Muchos dispositivos');
    expect(etiquetaNivel('baja')).toBe('Pocos dispositivos');
  });

  it('devuelve el nivel tal cual si no lo conoce', () => {
    expect(etiquetaNivel('otro')).toBe('otro');
  });

  it('convierte los espacios en guiones para formar una sola clase CSS', () => {
    expect(claseNivel('sin datos')).toBe('nivel-sin-datos');
    expect(claseNivel('media')).toBe('nivel-media');
  });
});
