/**
 * @file error-campo.ts
 * @description Mensaje de validación de un campo de formulario.
 *
 * Existe para que cada campo no repita en la plantilla la misma cascada de
 * `@if` —¿se tocó?, ¿falta?, ¿es corto?, ¿no cumple el patrón?—: el componente
 * recibe el control y los mensajes por clave de error, en orden de prioridad, y
 * muestra el primero que aplique.
 */

import { Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

/** Mensaje del primer error presente en un campo ya tocado. */
@Component({
  selector: 'app-error-campo',
  standalone: true,
  imports: [],
  templateUrl: './error-campo.html',
  styleUrl: './error-campo.css',
})
export class ErrorCampoComponent {
  /** Control cuyo estado se muestra. */
  @Input({ required: true }) control!: AbstractControl;

  /** Mensaje por clave de error, en orden de prioridad. */
  @Input({ required: true }) mensajes!: Readonly<Record<string, string>>;

  /** Mensaje a mostrar, o cadena vacía si todavía no hay que mostrar ninguno. */
  get mensaje(): string {
    if (!this.control.invalid || !this.control.touched) return '';
    const clave = Object.keys(this.mensajes).find((nombre) => this.control.hasError(nombre));
    return clave ? this.mensajes[clave] : '';
  }
}
