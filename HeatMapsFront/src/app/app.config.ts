/**
 * @file app.config.ts
 * @description Configuración raíz de la aplicación Angular.
 *
 * Define los proveedores globales que estarán disponibles en todo el árbol
 * de componentes. Este archivo es el equivalente funcional al antiguo
 * `AppModule` en arquitecturas con módulos.
 *
 * ## Interceptores HTTP (orden importante)
 * Los interceptores se ejecutan en el orden en que se declaran para las
 * peticiones salientes, y en orden inverso para las respuestas entrantes:
 *
 * ```
 * Petición:   authInterceptor → cryptoInterceptor → servidor
 * Respuesta:  servidor → cryptoInterceptor → authInterceptor
 * ```
 *
 * Este orden garantiza que:
 * 1. El header `Authorization` se añade antes de cifrar el body.
 * 2. El body de la respuesta se descifra antes de evaluar el status 401.
 */

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { cryptoInterceptor } from './core/interceptors/crypto.interceptor';

/**
 * Objeto de configuración de la aplicación Angular standalone.
 *
 * Registra:
 * - `provideBrowserGlobalErrorListeners`: captura errores no manejados del browser.
 * - `provideRouter`: configura el sistema de rutas con las rutas definidas en {@link routes}.
 * - `provideHttpClient`: habilita `HttpClient` con los interceptores funcionales
 *   `authInterceptor` y `cryptoInterceptor` aplicados globalmente.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, cryptoInterceptor]))
  ]
};
