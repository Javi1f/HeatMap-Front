/**
 * @file login-modal.ts
 * @description Modal de login flotante accesible desde cualquier página.
 *
 * Permite al usuario autenticarse sin abandonar la página actual, a diferencia
 * de la ruta `/login` que ocupa toda la pantalla. Comparte la misma lógica de
 * formulario que {@link LoginComponent} a través de {@link LoginStateService}.
 *
 * ## Cuándo se muestra
 * La visibilidad está controlada por {@link ModalService}. Cualquier componente
 * puede llamar a `ModalService.openLogin()` para mostrarlo. El modal vive en
 * `AppComponent` y está siempre presente en el DOM.
 *
 * ## Aislamiento de estado
 * Incluye `LoginStateService` en su array `providers` para que cada apertura
 * del modal tenga un estado limpio e independiente del formulario de la página
 * `/login`.
 */

import { Component, OnDestroy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LoginStateService } from '../../../core/services/login-state.service';
import { ModalService } from '../../../core/services/modal.service';

/**
 * Componente del modal de login global.
 *
 * Delega toda la lógica del formulario a {@link LoginStateService} y se
 * limita a gestionar la apertura/cierre del modal y el callback de éxito.
 */
@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './login-modal.html',
  styleUrl: './login-modal.css',
  /** Instancia propia de LoginStateService, aislada del formulario de /login. */
  providers: [LoginStateService]
})
export class LoginModalComponent implements OnDestroy {
  constructor(
    /** Servicio de estado del formulario; proveído a nivel de componente. */
    public loginState: LoginStateService,
    private modalService: ModalService
  ) {}

  // ── Getters de conveniencia para el template ────────────────────────────────

  /** Formulario reactivo del login. */
  get loginForm()    { return this.loginState.loginForm;    }
  /** Acceso directo a los controles del formulario. */
  get f()            { return this.loginState.f;            }
  /** Mensaje de error del último intento fallido. */
  get loginError()   { return this.loginState.loginError;   }
  /** `true` durante el bloqueo temporal por exceso de intentos fallidos. */
  get isBlocked()    { return this.loginState.isBlocked;    }
  /** Segundos restantes del bloqueo temporal. */
  get countdown()    { return this.loginState.countdown;    }
  /** `true` cuando la contraseña se muestra en texto plano. */
  get showPassword() { return this.loginState.showPassword; }

  /** Alterna la visibilidad de la contraseña. */
  togglePassword(): void { this.loginState.togglePassword(); }

  /**
   * Cierra el modal y resetea el formulario a su estado inicial.
   * Llamado cuando el usuario hace clic fuera del modal o en el botón de cerrar.
   */
  closeModal(): void {
    this.modalService.closeLogin();
    this.loginState.reset();
  }

  /**
   * Procesa el envío del formulario.
   * En caso de éxito, el callback cierra el modal antes de navegar al dashboard.
   */
  onSubmit(): void {
    this.loginState.onSubmit(() => this.closeModal());
  }

  /** Limpia el intervalo de cuenta atrás si el modal se destruye durante un bloqueo. */
  ngOnDestroy(): void { this.loginState.destroy(); }
}
