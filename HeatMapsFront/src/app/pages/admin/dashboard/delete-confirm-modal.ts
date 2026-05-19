/**
 * @file delete-confirm-modal.ts
 * @description Modal de confirmación de eliminación de correo permitido.
 *
 * Renderiza siempre en el DOM; su visibilidad se controla desde el padre
 * mediante el atributo HTML nativo `[hidden]` para evitar añadir un `@if`
 * extra al template padre y mantener su complejidad ciclomática bajo el
 * límite del analizador estático.
 *
 * @see {@link Dashboard} — componente padre que gestiona el flujo de confirmación.
 */

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AllowedEmail } from '../../../core/models/admin.model';

/**
 * Modal de confirmación para eliminar un correo de la lista blanca.
 *
 * Uso en el template padre:
 * ```html
 * <app-delete-confirm-modal
 *   [email]="emailBeingDeleted()"
 *   [hidden]="confirmDeleteId() === null"
 *   (deleteConfirmed)="confirmDelete()"
 *   (deleteCancelled)="cancelDelete()">
 * </app-delete-confirm-modal>
 * ```
 */
@Component({
  selector: 'app-delete-confirm-modal',
  standalone: true,
  imports: [],
  templateUrl: './delete-confirm-modal.html'
})
export class DeleteConfirmModalComponent {
  /**
   * Correo electrónico que está pendiente de eliminación.
   * `null` cuando no hay ninguno (modal oculto por el padre con `[hidden]`).
   */
  @Input() email: AllowedEmail | null = null;

  /** Emite cuando el usuario confirma la eliminación del correo. */
  @Output() readonly deleteConfirmed = new EventEmitter<void>();

  /** Emite cuando el usuario cancela o cierra el modal sin eliminar. */
  @Output() readonly deleteCancelled = new EventEmitter<void>();
}
