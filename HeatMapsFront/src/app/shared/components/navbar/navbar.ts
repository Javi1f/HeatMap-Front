/**
 * @file navbar.ts
 * @description Barra de navegación lateral (sidebar) de la aplicación.
 *
 * Funciona simultáneamente como sidebar en escritorio y como menú deslizante
 * superpuesto en móvil. Contiene:
 * - Links de navegación para rutas públicas y, si el usuario está autenticado,
 *   para el área de administración.
 * - Botón de apertura del modal de login (usuarios no autenticados).
 * - Botón de logout (usuarios autenticados).
 * - Toggle de tema claro/oscuro.
 *
 * ## Responsividad
 * Al construirse y en cada redimensionado de ventana (`HostListener('window:resize')`),
 * llama a `SidebarService.initResponsive()` para ajustar el estado inicial
 * al tamaño de pantalla actual.
 */

import { Component, computed, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService }    from '../../../core/services/auth.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { ModalService }   from '../../../core/services/modal.service';
import { ThemeService }   from '../../../core/services/theme.service';

/**
 * Descriptor de un elemento de navegación en el sidebar.
 */
export interface NavItem {
  /** Texto visible del enlace. */
  label: string;
  /** Ruta Angular a la que navega el enlace. */
  route: string;
  /** Nombre del icono de Material Icons. */
  icon: string;
  /** `true` si la entrada pertenece al área de administración. */
  esAdmin?: boolean;
}

/**
 * Componente de la barra de navegación lateral.
 *
 * Escucha `window:resize` para adaptarse cuando el usuario redimensiona
 * la ventana, asegurando que el estado del sidebar sea siempre coherente
 * con el breakpoint activo.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  /** Estado de colapso del sidebar: `true` = ancho mínimo (solo iconos). */
  isCollapsed  = computed(() => this.sidebarService.isCollapsed());

  /** `true` cuando el menú móvil superpuesto está visible. */
  isMobileOpen = computed(() => this.sidebarService.isMobileOpen());

  /**
   * `true` cuando hay sitio para el texto de cada entrada.
   *
   * La regla es una sola —caben si la barra no está plegada, o si está abierta
   * como cajón en teléfono— y antes se repetía en las cinco entradas de la
   * plantilla. Centralizarla evita que una de ellas se quede atrás el día que
   * la condición cambie, que es justo lo que le pasó al botón de tema.
   */
  mostrarEtiquetas = computed(() => !this.isCollapsed() || this.isMobileOpen());

  /** `true` si hay un administrador autenticado. Controla qué secciones se muestran. */
  isLoggedIn   = computed(() => this.authService.isAuthenticated());

  /** Datos del administrador autenticado, o `null` si no hay sesión. */
  currentAdmin = computed(() => this.authService.currentAdmin());

  /** `true` cuando el tema activo es el oscuro. Controla el icono del toggle. */
  isDark       = computed(() => this.themeService.isDark());

  /** Elementos de navegación siempre visibles (rutas públicas). */
  navItems: NavItem[] = [
    { label: 'Inicio',          route: '/',       icon: 'home'   },
    { label: 'Sección pública', route: '/public', icon: 'local_fire_department' }
  ];

  /** Elementos de navegación exclusivos del área de administración. */
  adminItems: NavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', icon: 'dashboard',       esAdmin: true },
    { label: 'Usuarios',  route: '/admin/users',     icon: 'manage_accounts', esAdmin: true },
    { label: 'Reportes',  route: '/admin/reportes',  icon: 'description',     esAdmin: true }
  ];

  /**
   * Entradas que toca pintar ahora mismo.
   *
   * Las dos listas se recorrían con dos bucles casi idénticos que solo se
   * diferenciaban en una clase CSS. Unirlas deja un único recorrido y quita el
   * riesgo de tocar uno y olvidar el otro; la distinción viaja ahora en el
   * propio elemento.
   */
  entradas = computed<NavItem[]>(() =>
    this.isLoggedIn() ? [...this.navItems, ...this.adminItems] : this.navItems,
  );

  /** Icono y rótulo del cambio de tema, que son una misma decisión. */
  tema = computed(() =>
    this.isDark()
      ? { icono: 'light_mode', texto: 'Modo claro' }
      : { icono: 'dark_mode', texto: 'Modo oscuro' },
  );

  /**
   * Aspecto del botón de sesión.
   *
   * Iniciar y cerrar sesión eran dos botones en ramas opuestas de un `@else`,
   * con la misma forma y el mismo sitio. Es un botón con dos estados.
   */
  accionSesion = computed(() =>
    this.isLoggedIn()
      ? { clase: 'logout-btn', icono: 'logout', texto: 'Cerrar sesión' }
      : { clase: 'login-btn',  icono: 'login',  texto: 'Iniciar sesión' },
  );

  /** Icono del control que pliega la barra o cierra el cajón. */
  iconoDelPliegue = computed(() => {
    if (this.isMobileOpen()) return 'close';
    return this.isCollapsed() ? 'chevron_right' : 'chevron_left';
  });

  /** Decide si se muestran las entradas de administracion y el logout. */
  private authService    = inject(AuthService);

  /** Estado de colapso y del menu movil. */
  private sidebarService = inject(SidebarService);

  /** Abre el modal de login desde el pie del sidebar. */
  private modalService   = inject(ModalService);

  /** Alterna entre modo claro y oscuro. */
  private themeService   = inject(ThemeService);

  /** Navegacion al pulsar una entrada del menu. */
  private router         = inject(Router);

  constructor() {
    this.sidebarService.initResponsive();
  }

  /**
   * Reajusta el estado del sidebar cuando el usuario redimensiona la ventana.
   * Garantiza coherencia entre el estado en memoria y el layout actual.
   */
  @HostListener('window:resize')
  onResize(): void {
    this.sidebarService.initResponsive();
  }

  /** Alterna el sidebar entre expandido y colapsado (o abre/cierra el menú móvil). */
  toggleSidebar(): void  { this.sidebarService.toggle(); }

  /** Alterna entre tema oscuro y claro. */
  toggleTheme(): void    { this.themeService.toggle(); }

  /** Cierra la sesión o abre el modal de acceso, según el estado actual. */
  alPulsarSesion(): void {
    if (this.isLoggedIn()) this.logout();
    else this.openLogin();
  }

  /**
   * Abre el modal de login global y cierra el menú móvil si estaba abierto.
   * Solo debe mostrarse cuando el usuario no está autenticado.
   */
  openLogin(): void {
    this.modalService.openLogin();
    this.sidebarService.closeMobile();
  }

  /**
   * Cierra la sesión activa del administrador y redirige a la página de inicio.
   * Cierra el menú móvil antes de proceder.
   * Si la petición al backend falla, redirige igualmente (JWT es stateless).
   */
  logout(): void {
    this.sidebarService.closeMobile();
    this.authService.logout().subscribe({
      next:  () => { this.router.navigate(['/']).catch(() => undefined); },
      error: () => { this.router.navigate(['/']).catch(() => undefined); }
    });
  }

  /**
   * Navega a la ruta indicada y cierra el menú móvil.
   *
   * @param route - Ruta Angular destino (ej. `"/admin/dashboard"`).
   */
  navigate(route: string): void {
    this.router.navigate([route]).catch(() => undefined);
    this.sidebarService.closeMobile();
  }
}
