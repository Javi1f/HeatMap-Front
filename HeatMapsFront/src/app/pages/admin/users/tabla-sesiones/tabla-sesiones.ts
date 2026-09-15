/**
 * @file tabla-sesiones.ts
 * @description Tabla de sesiones abiertas con la acción de cerrarlas.
 */

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SessionSummary } from '../../../../core/services/users.service';

/** Tabla de sesiones activas. */
@Component({
  selector: 'app-tabla-sesiones',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './tabla-sesiones.html',
  styleUrls: ['../users.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaSesionesComponent {
  /** Sesiones a mostrar. */
  readonly sesiones = input.required<SessionSummary[]>();

  /** Sesión que se está cerrando, para mostrar su indicador. */
  readonly revocandoId = input<string | null>(null);

  /** `true` mientras se cargan: evita anunciar «no hay sesiones» antes de tiempo. */
  readonly cargando = input<boolean>(false);

  /** Se pide cerrar una sesión. */
  readonly revocar = output<SessionSummary>();
}
