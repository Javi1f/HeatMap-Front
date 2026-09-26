/**
 * @file foco.ts
 * @description Hace que el borde de las tarjetas `.foco` se encienda bajo el cursor.
 *
 * Un único oyente en el documento sirve a todas las tarjetas: escribe en la
 * que está bajo el puntero su posición relativa (`--mx`, `--my`) y el CSS
 * dibuja el resplandor ahí (ver `.foco` en `styles/componentes.css`).
 *
 * **Por qué un oyente global y no una directiva por tarjeta**: las tarjetas
 * viven en muchos componentes; con un oyente basta con añadir la clase en la
 * plantilla, sin importar nada. Y como se registra a mano, fuera de la
 * plantilla, mover el ratón no programa ninguna detección de cambios.
 */

/** Programa un trabajo para el próximo fotograma, o lo ejecuta ya si no hay fotogramas. */
const programar = (trabajo: () => void): number => {
  if (typeof requestAnimationFrame !== 'function') {
    trabajo();
    return 0;
  }
  return requestAnimationFrame(trabajo);
};

/**
 * Empieza a seguir el cursor sobre las tarjetas `.foco` del documento.
 *
 * Como mucho actualiza una vez por fotograma, aunque lleguen varios
 * movimientos entre medias. Los toques no cuentan: en una pantalla táctil no
 * hay cursor que seguir, y el CSS ya oculta el efecto ahí.
 *
 * @param doc - Documento que escuchar.
 * @returns Función que deja de escuchar.
 */
export const activarFoco = (doc: Document): (() => void) => {
  let ultimo: PointerEvent | null = null;
  let pendiente = false;

  /** Lleva la posición del último puntero a la tarjeta que tiene debajo. */
  const aplicar = (): void => {
    pendiente = false;
    const evento = ultimo;
    const origen = evento?.target;
    if (!evento || !(origen instanceof Element)) return;

    const tarjeta = origen.closest<HTMLElement>('.foco');
    if (!tarjeta) return;

    const caja = tarjeta.getBoundingClientRect();
    tarjeta.style.setProperty('--mx', `${Math.round(evento.clientX - caja.left)}px`);
    tarjeta.style.setProperty('--my', `${Math.round(evento.clientY - caja.top)}px`);
  };

  /** Guarda el movimiento y agrupa los de un mismo fotograma. */
  const alMover = (evento: Event): void => {
    const puntero = evento as PointerEvent;
    if (puntero.pointerType === 'touch') return;
    ultimo = puntero;
    if (pendiente) return;
    pendiente = true;
    programar(aplicar);
  };

  doc.addEventListener('pointermove', alMover, { passive: true });
  return () => doc.removeEventListener('pointermove', alMover);
};
