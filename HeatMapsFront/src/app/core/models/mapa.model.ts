/**
 * @file mapa.model.ts
 * @description Forma del mapa de calor, compartida por la vista pública y la
 * del panel.
 *
 * Vive aquí y no en el servicio de métricas porque lo consumen dos pantallas
 * con permisos distintos: la pública, que cualquiera puede abrir, y la de
 * administración. El componente que lo dibuja no debe saber de cuál viene.
 *
 * Es deliberadamente el **mínimo común**: solo lo que hace falta para dibujar.
 * El mapa que sirve el panel trae además campos de diagnóstico, y esos se
 * declaran en su propio servicio en lugar de aquí, para que la vista pública no
 * pueda acabar mostrándolos por descuido.
 */

/** Nodo de captura tal como se dibuja sobre el plano. */
export interface NodoDibujable {
  /** Etiqueta que se pinta junto al nodo. */
  nombre: string;

  /** Metros desde el borde izquierdo. */
  x: number;

  /** Metros desde el borde inferior. */
  y: number;

  /** `true` si aportó detecciones a la ventana representada. */
  aportoDatos: boolean;
}

/** Lo mínimo que el lienzo necesita para dibujar un mapa de calor. */
export interface MapaDibujable {
  /** Nombre del espacio. */
  nombre: string;

  /** Anchura de la zona en metros. */
  ancho: number;

  /** Altura de la zona en metros. */
  alto: number;

  /** Lado de cada celda en metros. */
  ladoCelda: number;

  /** Número de columnas de la rejilla. */
  columnas: number;

  /** Número de filas de la rejilla. */
  filas: number;

  /**
   * Conteo por celda. `rejilla[0]` es la fila inferior del espacio (`y = 0`);
   * el lienzo tiene el origen arriba, así que al dibujar se invierte el eje.
   */
  rejilla: number[][];

  /** Mayor conteo de una celda, para normalizar la escala de color. */
  maximo: number;

  /** Dispositivos situados en el plano. */
  situados: number;

  /**
   * Dispositivos detectados que no se pudieron situar.
   *
   * Situar uno exige que al menos dos nodos lo vean a la vez. Con un solo
   * nodo emitiendo, todas las detecciones caen aquí: hay gente, pero no se
   * sabe dónde. Sirve para no anunciar que no hay nadie, que es otra cosa.
   *
   * Opcional: un backend anterior a este campo no lo envía.
   */
  sinPosicion?: number;

  /** Nodos con su posición. */
  nodos: NodoDibujable[];
}
