/**
 * @file modal.service.ts
 * @description Servicio global de coordinación para el modal de login flotante.
 *
 * Desacopla al componente que desea abrir el modal (p.ej. {@link HomeComponent},
 * {@link NavbarComponent}) del componente que lo renderiza ({@link LoginModalComponent}),
 * que vive en `AppComponent` y siempre está presente en el DOM.
 *
 * Cualquier componente puede llamar a {@link openLogin} sin necesidad de
 * conocer ni referenciar al modal directamente.
 */

import { Injectable, signal, computed } from '@angular/core';

/**
 * Servicio singleton que controla la visibilidad del modal de login global.
 *
 * El modal se renderiza una sola vez en `AppComponent` y permanece en el DOM
 * durante toda la sesión. Solo su visibilidad cambia mediante este servicio.
 */
@Injectable({ providedIn: 'root' })
export class ModalService {
  /** Signal privado que almacena el estado de visibilidad del modal. */
  private _showLogin = signal<boolean>(false);

  /**
   * Signal de solo lectura que indica si el modal de login está visible.
   * Los componentes deben usar este computed para suscribirse a cambios.
   */
  showLogin = computed(() => this._showLogin());

  /**
   * Abre el modal de login estableciendo su visibilidad a `true`.
   * Si el modal ya está abierto, la operación es idempotente.
   */
  openLogin(): void {
    this._showLogin.set(true);
  }

  /**
   * Cierra el modal de login estableciendo su visibilidad a `false`.
   * Llamado por {@link LoginModalComponent} al confirmar o cancelar el login.
   */
  closeLogin(): void {
    this._showLogin.set(false);
  }
}
