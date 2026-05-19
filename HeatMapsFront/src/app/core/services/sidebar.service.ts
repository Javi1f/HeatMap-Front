/**
 * @file sidebar.service.ts
 * @description Servicio que gestiona el estado de la barra de navegación lateral,
 * con comportamiento diferenciado entre escritorio y dispositivos móviles.
 *
 * ## Comportamiento por breakpoint
 *
 * | Contexto   | Acción `toggle()`              | Estado relevante    |
 * |------------|--------------------------------|---------------------|
 * | Escritorio | Alterna colapso (64px / 240px) | `isCollapsed`       |
 * | Móvil      | Abre/cierra el menú superpuesto| `isMobileOpen`      |
 *
 * El breakpoint móvil se define en `MOBILE_BREAKPOINT` (`max-width: 768px`)
 * y se evalúa mediante la API `BreakpointObserver` de Angular CDK en tiempo real.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';

/** Breakpoint CSS que define el límite entre layout móvil y escritorio. */
const MOBILE_BREAKPOINT = '(max-width: 768px)';

/**
 * Servicio singleton que centraliza el estado de expansión/colapso del sidebar.
 *
 * Separa los modos desktop (colapso parcial) y mobile (overlay) usando señales
 * independientes para que el componente navbar pueda aplicar estilos distintos.
 */
@Injectable({ providedIn: 'root' })
export class SidebarService {
  private breakpointObserver = inject(BreakpointObserver);

  /** Signal privado: `true` cuando el sidebar está colapsado a su ancho mínimo (64px). */
  private _isCollapsed = signal<boolean>(false);

  /** Signal privado: `true` cuando el menú móvil superpuesto está visible. */
  private _isMobileOpen = signal<boolean>(false);

  /**
   * Signal de solo lectura del estado de colapso.
   * Usado en `AppComponent` para aplicar la clase CSS `.collapsed` al contenido principal.
   */
  isCollapsed = computed(() => this._isCollapsed());

  /**
   * Signal de solo lectura del estado del menú móvil.
   * Usado en el template del navbar para mostrar/ocultar el overlay.
   */
  isMobileOpen = computed(() => this._isMobileOpen());

  /**
   * Indica si la ventana actual está en el rango del breakpoint móvil.
   * Evaluado en el momento de la llamada (no reactivo).
   */
  private get isMobile(): boolean {
    return this.breakpointObserver.isMatched(MOBILE_BREAKPOINT);
  }

  /**
   * Alterna el estado del sidebar según el contexto de pantalla:
   * - **Escritorio**: alterna entre expandido (240px) y colapsado (64px).
   * - **Móvil**: alterna la visibilidad del menú superpuesto.
   */
  toggle(): void {
    if (this.isMobile) {
      this._isMobileOpen.set(!this._isMobileOpen());
    } else {
      this._isCollapsed.set(!this._isCollapsed());
    }
  }

  /**
   * Inicializa el estado del sidebar según el tamaño de pantalla actual.
   *
   * En móvil: colapsa el sidebar y cierra el overlay.
   * En escritorio: no modifica el estado (preserva la preferencia del usuario).
   *
   * Debe llamarse al construir el `NavbarComponent` y al detectar cambios
   * de tamaño de ventana (`HostListener('window:resize')`).
   */
  initResponsive(): void {
    if (this.isMobile) {
      this._isCollapsed.set(true);
      this._isMobileOpen.set(false);
    }
  }

  /**
   * Cierra el menú móvil superpuesto.
   *
   * Se llama después de navegar a una ruta o al abrir un modal,
   * para que el overlay no quede visible sobre el contenido de destino.
   */
  closeMobile(): void {
    this._isMobileOpen.set(false);
  }
}
