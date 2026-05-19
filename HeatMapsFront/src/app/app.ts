/**
 * @file app.ts
 * @description Componente raíz de la aplicación Angular.
 *
 * Actúa como shell principal: monta la barra de navegación, el modal de login
 * global, el outlet del router y aplica el layout responsivo.
 *
 * ## Inicialización
 * En `ngOnInit` realiza dos tareas de arranque:
 * 1. **Tema**: llama a `ThemeService.init()` para aplicar el atributo
 *    `data-theme` al `<body>` según la preferencia guardada en `localStorage`.
 * 2. **Sesión**: si hay un token en `localStorage`, lo valida con el backend
 *    (`checkSession`) para reconstruir el estado en memoria. Si el token
 *    caducó o fue revocado, `clearSession` se llama automáticamente dentro
 *    del servicio.
 */

import { Component, computed, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar';
import { AuthService } from './core/services/auth.service';
import { SidebarService } from './core/services/sidebar.service';
import { ModalService } from './core/services/modal.service';
import { LoginModalComponent } from './shared/components/login-modal/login-modal';
import { ThemeService } from './core/services/theme.service';

/**
 * Shell de la aplicación. Renderiza el layout global y orquesta la inicialización
 * del tema y la sesión al arrancar.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, LoginModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit {
  /**
   * `true` cuando el sidebar está en modo colapsado (ancho mínimo).
   * Usado en la plantilla para aplicar la clase `.collapsed` al contenido principal,
   * ajustando el `margin-left` del área de contenido.
   */
  isCollapsed = computed(() => this.sidebarService.isCollapsed());

  /**
   * `true` cuando el modal de login flotante debe estar visible.
   * Controla la renderización condicional de `<app-login-modal>` en la plantilla.
   */
  showLogin = computed(() => this.modalService.showLogin());

  constructor(
    private authService:    AuthService,
    private sidebarService: SidebarService,
    private modalService:   ModalService,
    private themeService:   ThemeService
  ) {}

  ngOnInit(): void {
    // Aplicar el tema guardado en localStorage al atributo data-theme del body
    this.themeService.init();

    // Si hay token, intentar reconstruir la sesión en memoria
    // El error es ignorado aquí: AuthService.checkSession ya llama clearSession() en caso de fallo
    if (this.authService.getToken()) {
      this.authService.checkSession().subscribe({ error: () => {} });
    }
  }
}
