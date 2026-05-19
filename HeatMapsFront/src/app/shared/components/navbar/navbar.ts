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

  /** `true` si hay un administrador autenticado. Controla qué secciones se muestran. */
  isLoggedIn   = computed(() => this.authService.isAuthenticated());

  /** Datos del administrador autenticado, o `null` si no hay sesión. */
  currentAdmin = computed(() => this.authService.currentAdmin());

  /** `true` cuando el tema activo es el oscuro. Controla el icono del toggle. */
  isDark       = computed(() => this.themeService.isDark());

  /** Elementos de navegación siempre visibles (rutas públicas). */
  navItems: NavItem[] = [
    { label: 'Inicio',          route: '/',       icon: 'home'   },
    { label: 'Sección pública', route: '/public', icon: 'public' }
  ];

  /** Elementos de navegación exclusivos del área de administración. */
  adminItems: NavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', icon: 'dashboard' }
  ];

  private authService    = inject(AuthService);
  private sidebarService = inject(SidebarService);
  private modalService   = inject(ModalService);
  private themeService   = inject(ThemeService);
  private router         = inject(Router);

  constructor() {
    // Ajustar estado inicial según el tamaño de pantalla al montar el componente
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
      next:  () => { void this.router.navigate(['/']); },
      error: () => { void this.router.navigate(['/']); }
    });
  }

  /**
   * Navega a la ruta indicada y cierra el menú móvil.
   *
   * @param route - Ruta Angular destino (ej. `"/admin/dashboard"`).
   */
  navigate(route: string): void {
    void this.router.navigate([route]);
    this.sidebarService.closeMobile();
  }
}
