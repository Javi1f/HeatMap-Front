/**
 * @file app.routes.ts
 * @description Definición del árbol de rutas de la aplicación.
 *
 * Todos los componentes de página se cargan de forma lazy (`loadComponent`)
 * para que solo se descargue el código de cada ruta cuando el usuario la visita,
 * reduciendo el bundle inicial.
 *
 * ## Estructura de rutas
 *
 * | Path                  | Componente       | Protegida | Descripción                              |
 * |-----------------------|------------------|-----------|------------------------------------------|
 * | `/`                   | `Home`           | No        | Página de bienvenida con acciones rápidas |
 * | `/public`             | `PublicSection`  | No        | Mapa/tabla de sensores en tiempo real    |
 * | `/login`              | `Login`          | No        | Formulario de login a pantalla completa  |
 * | `/register`           | `Register`       | No        | Formulario de registro + verificación    |
 * | `/admin/dashboard`    | `Dashboard`      | Sí        | Panel de administración de correos       |
 * | `/admin`              | —                | Sí        | Redirige a `/admin/dashboard`            |
 * | `/**`                 | —                | No        | Redirige a `/` (catch-all)               |
 *
 * @see {@link authGuard} — guard que protege las rutas bajo `/admin`.
 */

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

/**
 * Árbol de rutas de la aplicación Angular.
 * Consumido por `provideRouter(routes)` en {@link appConfig}.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then(m => m.Home)
  },
  {
    path: 'public',
    /** Sección pública con tabla de sensores en tiempo real (Socket.IO). */
    loadComponent: () =>
      import('./pages/public-section/public-section').then(m => m.PublicSection)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.Login)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then(m => m.Register)
  },
  {
    path: 'admin',
    /** Todas las rutas hijas requieren autenticación verificada por `authGuard`. */
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    /** Catch-all: cualquier ruta desconocida redirige a la página de inicio. */
    path: '**',
    redirectTo: ''
  }
];
