/**
 * @file tabla-nodos.ts
 * @description Tabla del estado de la red de nodos de captura.
 *
 * Recibe los nodos ya cargados y solo los presenta: no consulta la API ni
 * decide cuándo refrescar, de eso sigue encargándose el dashboard.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SensorHealth } from '../../../core/services/metrics.service';

/** Una fila, con todo el texto ya resuelto. */
interface FilaNodo {
  readonly idSensor: string;
  readonly nombre: string;
  readonly zona: string;
  readonly ultimaLectura: string;
  readonly estado: string;
  readonly clasePildora: string;
  readonly enLinea: boolean;
}

/**
 * Traduce los minutos transcurridos a un texto legible.
 *
 * «Nunca» y «hace menos de un minuto» son casos aparte: un nodo recién
 * registrado y uno que acaba de emitir no se distinguen mirando un número.
 */
const textoUltimaLectura = (minutos: number | null): string => {
  if (minutos === null) return 'Nunca';
  if (minutos < 1) return 'Hace menos de 1 min';
  return `Hace ${minutos} min`;
};

/** Tabla con el estado de cada nodo de captura. */
@Component({
  selector: 'app-tabla-nodos',
  standalone: true,
  imports: [],
  templateUrl: './tabla-nodos.html',
  styleUrls: ['../tablas-comunes.css', './tabla-nodos.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaNodosComponent {
  /** Nodos a mostrar, tal como los devuelve la API de métricas. */
  readonly nodos = input.required<SensorHealth[]>();

  /**
   * Filas listas para pintar.
   *
   * El texto y la píldora se resuelven aquí y no en la plantilla porque una
   * decisión escrita en TypeScript se puede leer y probar; repartida en ramas
   * de plantilla, no.
   */
  readonly filas = computed<FilaNodo[]>(() =>
    this.nodos().map((nodo) => ({
      idSensor: nodo.idSensor,
      nombre: nodo.nombre,
      zona: nodo.zona ?? '—',
      ultimaLectura: textoUltimaLectura(nodo.minutosDesdeUltimaLectura),
      estado: nodo.enLinea ? 'En línea' : 'Sin señal',
      clasePildora: nodo.enLinea ? 'pill-ok' : 'pill-warn',
      enLinea: nodo.enLinea,
    })),
  );
}

