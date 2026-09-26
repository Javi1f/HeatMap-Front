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

import { Component, ElementRef, HostListener, inject, Input, output } from '@angular/core';
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
  templateUrl: './delete-confirm-modal.html',
  styleUrl: './delete-confirm-modal.css'
})
export class DeleteConfirmModalComponent {
  /**
   * Correo electrónico que está pendiente de eliminación.
   * `null` cuando no hay ninguno (modal oculto por el padre con `[hidden]`).
   */
  @Input() email: AllowedEmail | null = null;

  /** Emite cuando el usuario confirma la eliminación del correo. */
  readonly deleteConfirmed = output();

  /** Emite cuando el usuario cancela o cierra el modal sin eliminar. */
  readonly deleteCancelled = output();

  /** Elemento del modal, para mover el foco dentro de él. */
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Escape cancela, como pulsar fuera. Sólo mientras está a la vista: el padre
   * lo oculta con `[hidden]` en lugar de retirarlo del DOM.
   */
  @HostListener('document:keydown.escape')
  alPulsarEscape(): void {
    if (!this.anfitrion.nativeElement.hidden) this.deleteCancelled.emit();
  }
}
