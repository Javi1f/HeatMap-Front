/**
 * @file limitar-frecuencia.ts
 * @description Ejecuta una acción como mucho una vez por intervalo.
 *
 * Los nodos emiten lecturas cada pocos segundos por el WebSocket. Recargar el
 * mapa con cada una saturaría la API; recargarlo solo con el sondeo de 30 s
 * incumpliría el tiempo de respuesta de 5 s. Limitar la frecuencia deja las dos
 * cosas en su sitio.
 */

/** Acción limitada: la llamada se descarta si no ha pasado el intervalo desde la última ejecución. */
export type AccionLimitada = (accion: () => void) => void;

/**
 * Crea un limitador de frecuencia.
 *
 * @param intervaloMs - Tiempo mínimo entre dos ejecuciones.
 * @param ahora       - Reloj, inyectable para las pruebas.
 */
export const crearLimitador = (intervaloMs: number, ahora: () => number = Date.now): AccionLimitada => {
  let ultima = Number.NEGATIVE_INFINITY;
  return (accion) => {
    const momento = ahora();
    if (momento - ultima < intervaloMs) return;
    ultima = momento;
    accion();
  };
};
