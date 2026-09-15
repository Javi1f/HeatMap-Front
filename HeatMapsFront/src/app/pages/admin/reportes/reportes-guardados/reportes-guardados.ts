/**
 * @file reportes-guardados.ts
 * @description Lista de definiciones de reporte guardadas, con sus acciones.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ETIQUETAS_TIPO, ReporteResumen } from '../../../../core/services/reportes.service';

/** Tarjeta con los reportes guardados: abrir, descargar y eliminar cada uno. */
@Component({
  selector: 'app-reportes-guardados',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './reportes-guardados.html',
  styleUrls: ['../reportes.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportesGuardadosComponent {
  /** Definiciones guardadas. */
  readonly guardados = input.required<ReporteResumen[]>();

  /** `true` mientras se carga la lista. */
  readonly cargando = input<boolean>(false);

  /** Reporte cuyo CSV se está descargando. */
  readonly descargandoId = input<string | null>(null);

  /** Reporte que se está eliminando. */
  readonly eliminandoId = input<string | null>(null);

  /** Se pide abrir un reporte. */
  readonly abrir = output<string>();

  /** Se pide descargar el CSV de un reporte. */
  readonly descargar = output<string>();

  /** Se pide eliminar un reporte. */
  readonly eliminar = output<string>();

  /** Nombre legible de cada tipo de reporte. */
  readonly etiquetas = ETIQUETAS_TIPO;
}
