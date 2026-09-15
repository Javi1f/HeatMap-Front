import { crearLimitador } from './limitar-frecuencia';

describe('crearLimitador', () => {
  it('ejecuta la primera acción de inmediato', () => {
    const limitar = crearLimitador(2000, () => 0);
    const accion = vi.fn();
    limitar(accion);
    expect(accion).toHaveBeenCalledTimes(1);
  });

  it('descarta las acciones dentro del intervalo y vuelve a ejecutar al cumplirse', () => {
    let reloj = 0;
    const limitar = crearLimitador(2000, () => reloj);
    const accion = vi.fn();

    limitar(accion);
    reloj = 1999;
    limitar(accion);
    reloj = 2000;
    limitar(accion);

    expect(accion).toHaveBeenCalledTimes(2);
  });
});
