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
import { OndasComponent } from '../../shared/animacion/ondas';


import { noop } from 'rxjs';

/** Segundos que tarda el barrido del radar de la portada en dar una vuelta. */
const PERIODO_BARRIDO_S = 6;

/** Eco del radar de la portada: dónde está y cuándo lo alcanza el barrido. */
interface Eco {
  /** Posición horizontal, en % del radar. */
  x: number;
  /** Posición vertical, en % del radar. */
  y: number;
  /** Diámetro de la mancha, en % del radar. */
  tam: string;
  /** Segundos hasta que el barrido pasa por encima. */
  retraso: number;
}

/**
 * Sitúa un eco por ángulo (grados desde arriba, en sentido horario) y
 * distancia al centro (en % del radio), y calcula cuándo lo alcanza el
 * barrido, que arranca arriba y gira en el mismo sentido.
 */
const eco = (angulo: number, distancia: number, tam: number): Eco => {
  const rad = (angulo * Math.PI) / 180;
  const radio = distancia / 2;
  return {
    x: Math.round((50 + radio * Math.sin(rad)) * 10) / 10,
    y: Math.round((50 - radio * Math.cos(rad)) * 10) / 10,
    tam: `${tam}%`,
    retraso: Math.round((angulo / 360) * PERIODO_BARRIDO_S * 100) / 100,
  };
};
/**
 * Componente de la página de inicio.
 * No requiere autenticación; es la primera pantalla que ve cualquier visitante.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, OndasComponent],
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
   * Ecos del radar decorativo de la portada. Una aglomeración grande, un par
   * de grupos y algunos dispositivos sueltos: la misma lectura que da el mapa.
   */
  readonly ecos: readonly Eco[] = [
    eco(38, 52, 34),
    eco(52, 40, 18),
    eco(118, 70, 20),
    eco(200, 58, 26),
    eco(214, 74, 14),
    eco(282, 34, 16),
    eco(330, 76, 12),
  ];

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
        next:  () => { this.router.navigate(['/register']).catch(noop); },
        error: () => { this.router.navigate(['/register']).catch(noop); }
      });
      return;
    }
    this.router.navigate(['/register']).catch(noop);
  }

  /**
   * Navega a la sección pública de sensores en tiempo real (`/public`).
   */
  goToMaps(): void {
    this.router.navigate(['/public']).catch(noop);
  }

  /**
   * Navega al dashboard de administración (`/admin/dashboard`).
   * Llamado desde el link del mensaje "ya estás autenticado".
   */
  goToDashboard(): void {
    this.router.navigate(['/admin/dashboard']).catch(noop);
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
