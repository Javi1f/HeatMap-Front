/**
 * @file home.ts
 * @description Página de bienvenida de la aplicación (`/`).
 *
 * Presenta al usuario tres acciones principales en formato de tarjetas:
 * 1. **Iniciar sesión** — abre el modal de login si no hay sesión activa,
 *    o muestra un aviso con link al dashboard si ya está autenticado.
 * 2. **Visualizar mapas** — navega a `/public` (sección de sensores en tiempo real).
 * 3. **Crear cuenta** — navega a `/register`. Si hay sesión activa, la cierra
 *    primero para permitir el registro de otro administrador.
 *
 * ## Gestión del timeout
 * El aviso "ya estás autenticado" se muestra durante 3 segundos y desaparece
 * automáticamente. El timeout se cancela en `ngOnDestroy` para evitar intentos
 * de actualización de un componente ya destruido.
 */

import { Component, computed, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ModalService } from '../../core/services/modal.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * Componente de la página de inicio.
 * No requiere autenticación; es la primera pantalla que ve cualquier visitante.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnDestroy {
  /**
   * `true` si hay un administrador autenticado.
   * Controla el texto y comportamiento del botón "Crear cuenta".
   */
  isLoggedIn = computed(() => this.authService.isAuthenticated());

  /**
   * `true` durante los 3 segundos en que se muestra el mensaje
   * "ya estás autenticado" al pulsar "Iniciar sesión" con sesión activa.
   */
  alreadyLoggedMsg = signal<boolean>(false);

  /**
   * Referencia al timeout activo para el mensaje transitorio.
   * `null` cuando no hay mensaje visible. Se cancela en `ngOnDestroy`.
   */
  private msgTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly modalService: ModalService,
    private readonly authService:  AuthService,
    private readonly router:       Router
  ) {}

  /**
   * Gestiona el clic en el botón "Iniciar sesión".
   *
   * - Si el usuario ya está autenticado: muestra el mensaje transitorio con
   *   un link al dashboard durante 3 segundos.
   * - Si no está autenticado: abre el modal de login global.
   */
  openLogin(): void {
    if (this.isLoggedIn()) {
      this.showAlreadyLogged();
      return;
    }
    this.modalService.openLogin();
  }

  /**
   * Gestiona el clic en el botón "Crear cuenta" / "Cerrar sesión y registrarse".
   *
   * - Si hay sesión activa: la cierra primero (para poder registrarse con otro email)
   *   y luego navega a `/register`, tanto en éxito como en error (JWT es stateless).
   * - Si no hay sesión: navega directamente a `/register`.
   */
  goToRegister(): void {
    if (this.isLoggedIn()) {
      this.authService.logout().subscribe({
        next:  () => { void this.router.navigate(['/register']); },
        error: () => { void this.router.navigate(['/register']); }
      });
      return;
    }
    void this.router.navigate(['/register']);
  }

  /**
   * Navega a la sección pública de sensores en tiempo real (`/public`).
   */
  goToMaps(): void {
    void this.router.navigate(['/public']);
  }

  /**
   * Navega al dashboard de administración (`/admin/dashboard`).
   * Llamado desde el link del mensaje "ya estás autenticado".
   */
  goToDashboard(): void {
    void this.router.navigate(['/admin/dashboard']);
  }

  /**
   * Cancela el timeout del mensaje transitorio si el componente se destruye
   * antes de que expire, evitando un intento de actualización de un signal
   * en un componente ya desmontado.
   */
  ngOnDestroy(): void {
    if (this.msgTimeout !== null) {
      clearTimeout(this.msgTimeout);
      this.msgTimeout = null;
    }
  }

  /**
   * Muestra el mensaje "ya estás autenticado" durante 3 segundos.
   *
   * Si el mensaje ya está visible (el usuario pulsó el botón varias veces),
   * cancela el timeout anterior y reinicia los 3 segundos.
   */
  private showAlreadyLogged(): void {
    this.alreadyLoggedMsg.set(true);
    if (this.msgTimeout !== null) clearTimeout(this.msgTimeout);
    this.msgTimeout = setTimeout(() => {
      this.alreadyLoggedMsg.set(false);
      this.msgTimeout = null;
    }, 3000);
  }
}
