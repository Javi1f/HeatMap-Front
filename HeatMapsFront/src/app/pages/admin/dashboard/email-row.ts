/**
 * @file email-row.ts
 * @description Componente de fila de la tabla de correos permitidos en el dashboard.
 *
 * Renderiza las cuatro celdas de una fila `<tr>` de la tabla de emails usando
 * un selector de atributo (`[appEmailRow]`), de modo que el elemento host sigue
 * siendo el `<tr>` definido en el componente padre. Esto mantiene la semántica
 * correcta del DOM para tablas HTML.
 *
 * ## Responsabilidad
 * Aísla los bloques `@if`/`@else` anidados de la fila (badges "tú" y "fundador",
 * botón de eliminar vs icono de bloqueo, spinner durante la operación de borrado)
 * para reducir la complejidad ciclomática del template del dashboard.
 *
 * @see {@link Dashboard} — componente padre que provee los datos y captura el output.
 */

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AllowedEmail } from '../../../core/models/admin.model';

/**
 * Componente de fila (atributo) para la tabla de correos permitidos.
 *
 * Uso en el template padre:
 * ```html
 * <tr appEmailRow
 *     [email]="email"
 *     [canDelete]="canDelete(email)"
 *     [tooltip]="getDeleteTooltip(email)"
 *     [deletingId]="deletingId()"
 *     [isCurrentUser]="email.email === currentAdminEmail()"
 *     [isFounder]="email.id === firstEmailId()"
 *     (deleteRequested)="requestDelete($event)">
 * </tr>
 * ```
 */
@Component({
  selector: '[appEmailRow]',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-row.html'
})
export class EmailRowComponent {
  /** Correo electrónico permitido que representa esta fila. */
  @Input() email!: AllowedEmail;

  /** `true` si el correo puede ser eliminado por el administrador actual. */
  @Input() canDelete = false;

  /** Texto del tooltip del botón de eliminar (o icono de bloqueo). */
  @Input() tooltip = '';

  /**
   * ID del correo que está siendo eliminado actualmente.
   * `null` cuando no hay operación de borrado en curso.
   * Controla la visibilidad del spinner en la celda de acciones.
   */
  @Input() deletingId: number | null = null;

  /** `true` si el correo pertenece al administrador que está autenticado. */
  @Input() isCurrentUser = false;

  /** `true` si el correo es el de menor ID en la lista (correo fundador). */
  @Input() isFounder = false;

  /**
   * Emite el `id` del correo cuando el usuario hace clic en el botón "Eliminar".
   * El componente padre gestiona el flujo de confirmación con modal.
   */
  @Output() readonly deleteRequested = new EventEmitter<number>();
}
