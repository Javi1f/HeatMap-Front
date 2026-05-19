/**
 * @file theme.service.ts
 * @description Servicio que gestiona el tema visual de la aplicación
 * (modo oscuro / modo claro), con persistencia en `localStorage`.
 *
 * ## Mecanismo de temas
 * El tema activo se aplica añadiendo el atributo `data-theme="dark"` o
 * `data-theme="light"` al elemento `<body>`. Las hojas de estilo globales
 * definen las variables CSS (custom properties) para cada valor, por lo
 * que cambiar el atributo es suficiente para propagar el cambio visualmente.
 *
 * ## Persistencia
 * La preferencia del usuario se guarda en `localStorage` bajo la clave `"theme"`
 * para que sobreviva recargas de página. Si no hay preferencia guardada, el
 * tema por defecto es `"dark"`.
 */

import { Injectable, signal, computed } from '@angular/core';

/**
 * Tipo discriminado para los temas soportados.
 * Coincide con los valores del atributo `data-theme` en el CSS global.
 */
export type Theme = 'dark' | 'light';

/**
 * Servicio singleton de gestión del tema visual.
 *
 * Expone el tema actual como `computed` de solo lectura y provee
 * métodos para inicializar y alternar el tema.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /**
   * Signal privado con el tema actualmente activo.
   * Se inicializa leyendo `localStorage` para persistir la preferencia del usuario.
   */
  private _theme = signal<Theme>(this.getInitialTheme());

  /**
   * Signal de solo lectura con el tema activo (`"dark"` | `"light"`).
   * Los componentes pueden suscribirse para reaccionar a cambios de tema.
   */
  theme = computed(() => this._theme());

  /**
   * Atajo reactivo que indica si el tema activo es el oscuro.
   * Útil para condicionar iconos o clases CSS en componentes sin comparar strings.
   */
  isDark = computed(() => this._theme() === 'dark');

  /**
   * Lee la preferencia de tema guardada en `localStorage`.
   * Si no existe, devuelve `"dark"` como valor por defecto.
   *
   * @returns El tema persistido o `"dark"` si no hay preferencia.
   */
  private getInitialTheme(): Theme {
    return (localStorage.getItem('theme') as Theme) ?? 'dark';
  }

  /**
   * Aplica el tema actual al DOM estableciendo `data-theme` en `<body>`.
   *
   * Debe llamarse una sola vez al arrancar la aplicación (`AppComponent.ngOnInit`)
   * para sincronizar el atributo del DOM con el estado inicial leído de `localStorage`.
   */
  init(): void {
    document.body.setAttribute('data-theme', this._theme());
  }

  /**
   * Alterna entre tema oscuro y claro, persiste la elección en `localStorage`
   * y actualiza el atributo `data-theme` del `<body>` inmediatamente.
   */
  toggle(): void {
    const next: Theme = this._theme() === 'dark' ? 'light' : 'dark';
    this._theme.set(next);
    localStorage.setItem('theme', next);
    document.body.setAttribute('data-theme', next);
  }
}
