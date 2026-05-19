/**
 * @file add-email-form.ts
 * @description Formulario de añadir correo a la lista blanca del dashboard.
 *
 * Encapsula el `<form>` con su validación visual (`@if` de error de campo
 * y error de petición) y el estado del botón de envío (spinner / icono),
 * reduciendo la complejidad ciclomática del template del componente padre.
 *
 * El `FormGroup` se pasa como `@Input` para mantener la fuente de verdad
 * del estado del formulario en el componente padre {@link Dashboard}.
 *
 * @see {@link Dashboard} — componente padre que provee el FormGroup y captura `formSubmit`.
 */

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';

/**
 * Componente del formulario de añadir correo permitido.
 *
 * Uso en el template padre:
 * ```html
 * <app-add-email-form
 *   [addForm]="addForm"
 *   [isAdding]="isAdding()"
 *   [addError]="addError()"
 *   (formSubmit)="onAddEmail()">
 * </app-add-email-form>
 * ```
 */
@Component({
  selector: 'app-add-email-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './add-email-form.html'
})
export class AddEmailFormComponent {
  /**
   * `FormGroup` del formulario de añadir correo, propiedad del componente padre.
   * Requerido: el template lanzará un error si no se proporciona.
   */
  @Input() addForm!: FormGroup;

  /** `true` mientras la petición de añadir correo está en curso. */
  @Input() isAdding = false;

  /** Mensaje de error de la petición de añadir, vacío si no hay error. */
  @Input() addError = '';

  /**
   * Emite cuando el usuario envía el formulario (`ngSubmit`).
   * El componente padre es responsable de validar y realizar la petición HTTP.
   */
  @Output() readonly formSubmit = new EventEmitter<void>();

  /**
   * Acceso directo a los controles del `FormGroup` para verificar
   * el estado de validación en la plantilla.
   */
  get f() { return this.addForm.controls; }
}
