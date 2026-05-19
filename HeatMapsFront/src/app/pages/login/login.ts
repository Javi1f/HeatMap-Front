/**
 * @file login.ts
 * @description Página de login a pantalla completa (`/login`).
 *
 * Renderiza el formulario de autenticación de administradores como una ruta
 * dedicada, a diferencia del modal de login flotante que es accesible desde
 * cualquier página. Ambas variantes comparten la misma lógica a través de
 * {@link LoginStateService}.
 *
 * ## Cuándo se usa esta ruta vs el modal
 * - **Modal** (`LoginModalComponent`): cuando el usuario quiere iniciar sesión
 *   sin abandonar la página actual (ej. desde Home, navbar, etc.).
 * - **Ruta `/login`**: cuando se navega directamente a esta URL, por ejemplo
 *   al ser redirigido por el `authInterceptor` tras un error 401.
 *
 * ## Responsabilidad del componente
 * Este componente es un thin wrapper sobre {@link LoginStateService}: delega
 * toda la lógica al servicio y solo expone getters de conveniencia para el template.
 * Provee su propia instancia del servicio mediante `providers: [LoginStateService]`.
 */

import { Component, OnDestroy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LoginStateService } from '../../core/services/login-state.service';

/**
 * Componente de la ruta `/login`.
 * Thin wrapper que delega toda la lógica en {@link LoginStateService}.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
  /** Instancia propia del servicio, aislada de otros formularios de login. */
  providers: [LoginStateService]
})
export class Login implements OnDestroy {
  constructor(
    /** Servicio de estado del formulario; proveído a nivel de componente. */
    public loginState: LoginStateService
  ) {}

  // ── Getters de conveniencia para el template ────────────────────────────────

  /** Formulario reactivo con los campos `identifier` y `password`. */
  get loginForm()    { return this.loginState.loginForm;    }
  /** Acceso directo a los controles del formulario. */
  get f()            { return this.loginState.f;            }
  /** Mensaje de error del último intento fallido, vacío si no hay error. */
  get loginError()   { return this.loginState.loginError;   }
  /** `true` durante el bloqueo temporal por exceso de intentos fallidos. */
  get isBlocked()    { return this.loginState.isBlocked;    }
  /** Segundos restantes del bloqueo temporal activo. */
  get countdown()    { return this.loginState.countdown;    }
  /** `true` cuando la contraseña se muestra en texto plano. */
  get showPassword() { return this.loginState.showPassword; }

  /** Alterna la visibilidad de la contraseña. */
  togglePassword(): void { this.loginState.togglePassword(); }

  /**
   * Procesa el envío del formulario de login.
   * Delega completamente en {@link LoginStateService.onSubmit}.
   * Sin callback `onSuccess` ya que en la página de login no hay modal que cerrar.
   */
  onSubmit(): void { this.loginState.onSubmit(); }

  /** Limpia el intervalo de cuenta atrás si el componente se destruye durante un bloqueo. */
  ngOnDestroy(): void { this.loginState.destroy(); }
}
