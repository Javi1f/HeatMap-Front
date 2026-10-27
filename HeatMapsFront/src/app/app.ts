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

import { Component, computed, DOCUMENT, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, noop } from 'rxjs';
import { NavbarComponent } from './shared/components/navbar/navbar';
import { AuthService } from './core/services/auth.service';
import { SidebarService } from './core/services/sidebar.service';
import { ModalService } from './core/services/modal.service';
import { LoginModalComponent } from './shared/components/login-modal/login-modal';
import { ThemeService } from './core/services/theme.service';
import { activarFoco } from './shared/animacion/foco';
import { FondoRadarComponent } from './shared/fondo/fondo-radar';
import { FondoConstelacion } from './shared/fondo/fondo-constelacion';
import { PieComponent } from './shared/pie/pie';
import { AvisoCookiesComponent } from './shared/aviso-cookies/aviso-cookies';

/**
 * Shell de la aplicación. Renderiza el layout global y orquesta la
 * inicialización del tema y la sesión al arrancar. Cierra la página con el
 * pie legal y avisa de cookies y almacenamiento local en la primera visita.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, LoginModalComponent, FondoRadarComponent, FondoConstelacion, PieComponent, AvisoCookiesComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit, OnDestroy {
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

  /**
   * Cambio de fondo por ruta: en «¿Qué es PlaceAt?» (`/acerca`) el cielo de
   * constelaciones REEMPLAZA al radar — no se superponen. En el resto de la
   * aplicación sigue el radar de siempre.
   */
  protected readonly fondoAcerca = computed(() => {
    this.navegacion(); // dependencia: reevalúa en cada navegación
    return this.router.url === '/acerca';
  });

  /** El rotor: cada navegación reevalúa si la ruta pide cielo o radar. */
  private readonly router = inject(Router);

  private readonly navegacion = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)),
    { initialValue: null },
  );

  /** Documento de la aplicación, donde se escucha el cursor. */
  private readonly documento = inject(DOCUMENT);

  /** Deja de seguir el cursor sobre las tarjetas; se asigna al iniciar. */
  private detenerFoco?: () => void;

  constructor(
    private authService:    AuthService,
    private sidebarService: SidebarService,
    private modalService:   ModalService,
    private themeService:   ThemeService
  ) {}

  /**
   * Aplica el tema guardado y reconstruye la sesion si hay token.
   *
   * El error de `checkSession` se descarta con `noop` a proposito: el propio
   * servicio ya llama a `clearSession()` cuando el token es invalido, asi que
   * aqui no queda nada que manejar.
   */
  ngOnInit(): void {
    this.themeService.init();
    this.detenerFoco = activarFoco(this.documento);

    if (this.authService.getToken()) {
      this.authService.checkSession().subscribe({ error: noop });
    }
  }

  /**
   * Lleva el foco al contenido principal. El enlace no navega por su `href`:
   * con `<base href="/">` un ancla relativa recargaría la página de inicio.
   */
  saltarAlContenido(): void {
    this.documento.getElementById('contenido')?.focus();
  }

  /** Retira el oyente del cursor. */
  ngOnDestroy(): void {
    this.detenerFoco?.();
  }
}
