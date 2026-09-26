/**
 * @file tabla-zonas.ts
 * @description Tabla de ocupación consolidada por espacio.
 *
 * Recibe las zonas ya cargadas y solo las presenta; la consulta y el refresco
 * siguen en el dashboard.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ZoneOccupancy } from '../../../core/services/metrics.service';
import { MedidorComponent, Tono } from '../../../shared/indicadores/indicadores';

/** Segmentos del medidor de aforo: uno por cada 10 %. */
const SEGMENTOS_AFORO = 10;

/** Nivel de ocupación tal como lo dibuja su medidor de tres segmentos. */
interface Nivel {
  readonly llenos: number;
  readonly tono: Tono;
  readonly texto: string;
}

/** Medidor para cada nivel: baja enciende uno, media dos, alta los tres. */
const NIVELES: Record<ZoneOccupancy['nivelOcupacion'], Nivel> = {
  baja:  { llenos: 1, tono: 'ok',      texto: 'baja' },
  media: { llenos: 2, tono: 'aviso',   texto: 'media' },
  alta:  { llenos: 3, tono: 'peligro', texto: 'alta' },
};

/** Medidor de aforo, cuando la zona declara uno. */
interface Aforo {
  /** Porcentaje acotado a 100, para no desbordar el medidor. */
  readonly ancho: number;
  /** Segmentos encendidos de {@link SEGMENTOS_AFORO}. */
  readonly llenos: number;
  readonly texto: string;
}

/** Una fila, con todo el texto ya resuelto. */
interface FilaZona {
  readonly idZona: string;
  readonly nombre: string;
  readonly unicos: number;
  readonly estables: number;
  readonly nivel: Nivel;
  readonly aforo: Aforo | null;
  readonly actualizado: string;
}

/**
 * Hora local en formato `HH:mm`, o un guion si no hay marca.
 *
 * Se formatea a mano en lugar de con `DatePipe`: instanciarlo con una
 * configuración regional exige cargar sus datos con `registerLocaleData`, y sin
 * ellos lanza y se lleva por delante el renderizado de todo el panel.
 */
const horaLocal = (iso: string | null): string => {
    if (!iso) return '—';
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return '—';
    const hora = String(fecha.getHours()).padStart(2, '0');
    const minuto = String(fecha.getMinutes()).padStart(2, '0');
    return `${hora}:${minuto}`;
};

/** Tabla con la ocupación consolidada de cada zona y su aforo. */
@Component({
  selector: 'app-tabla-zonas',
  standalone: true,
  imports: [MedidorComponent],
  templateUrl: './tabla-zonas.html',
  styleUrls: ['../tablas-comunes.css', './tabla-zonas.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaZonasComponent {
  /** Zonas a mostrar, tal como las devuelve la API de métricas. */
  readonly zonas = input.required<ZoneOccupancy[]>();

  /** Segmentos del medidor de aforo, para la plantilla. */
  protected readonly segmentosAforo = SEGMENTOS_AFORO;

  /**
   * Filas listas para pintar.
   *
   * El aforo se resuelve a un objeto o a `null`, de modo que la plantilla
   * pregunta una sola vez en lugar de repetir la comprobación por cada dato
   * que depende de él. Su anchura se acota al 100 % para que un exceso de
   * ocupación no desborde la celda.
   */
  readonly filas = computed<FilaZona[]>(() =>
    this.zonas().map((zona) => ({
      idZona: zona.idZona,
      nombre: zona.nombre,
      unicos: zona.dispositivosUnicos,
      estables: zona.dispositivosEstables,
      nivel: NIVELES[zona.nivelOcupacion],
      aforo: zona.capacidadMax
        ? {
            ancho: Math.min(zona.porcentajeAforo ?? 0, 100),
            llenos: Math.round(Math.min(zona.porcentajeAforo ?? 0, 100) / SEGMENTOS_AFORO),
            texto: `${zona.porcentajeAforo} % de ${zona.capacidadMax}`,
          }
        : null,
      actualizado: horaLocal(zona.actualizadoEn),
    })),
  );
}

