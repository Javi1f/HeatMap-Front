/**
 * @file tabla-zonas.ts
 * @description Tabla de ocupación consolidada por espacio.
 *
 * Recibe las zonas ya cargadas y solo las presenta; la consulta y el refresco
 * siguen en el dashboard.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ZoneOccupancy } from '../../../core/services/metrics.service';

/** Barra de aforo, cuando la zona declara uno. */
interface Aforo {
  readonly ancho: number;
  readonly texto: string;
}

/** Una fila, con todo el texto ya resuelto. */
interface FilaZona {
  readonly idZona: string;
  readonly nombre: string;
  readonly unicos: number;
  readonly estables: number;
  readonly claseNivel: string;
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

@Component({
  selector: 'app-tabla-zonas',
  standalone: true,
  imports: [],
  templateUrl: './tabla-zonas.html',
  styleUrls: ['../tablas-comunes.css', './tabla-zonas.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaZonasComponent {
  /** Zonas a mostrar, tal como las devuelve la API de métricas. */
  readonly zonas = input.required<ZoneOccupancy[]>();

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
      claseNivel: `level-${zona.nivelOcupacion}`,
      aforo: zona.capacidadMax
        ? {
            ancho: Math.min(zona.porcentajeAforo ?? 0, 100),
            texto: `${zona.porcentajeAforo} % de ${zona.capacidadMax}`,
          }
        : null,
      actualizado: horaLocal(zona.actualizadoEn),
    })),
  );
}

