/**
 * @file resultado-reporte.ts
 * @description Tabla de datos de un reporte ya calculado, con sus acciones.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ETIQUETAS_TIPO, ReporteGenerado } from '../../../../core/services/reportes.service';

/** Reporte abierto: cabecera, datos en tabla y acciones de descargar y cerrar. */
@Component({
  selector: 'app-resultado-reporte',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './resultado-reporte.html',
  styleUrls: ['../reportes.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultadoReporteComponent {
  /** Reporte a mostrar. */
  readonly reporte = input.required<ReporteGenerado>();

  /** `true` mientras se descarga su CSV. */
  readonly descargando = input<boolean>(false);

  /** Se pide descargar el CSV. */
  readonly descargar = output<string>();

  /** Se pide cerrar el reporte. */
  readonly cerrar = output();

  /** Nombre legible de cada tipo de reporte. */
  readonly etiquetas = ETIQUETAS_TIPO;
}
