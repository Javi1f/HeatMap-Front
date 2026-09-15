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
 * | `/admin/dashboard`    | `Dashboard`      | Sí        | Métricas de ocupación y estado de la red |
 * | `/admin/users`        | `Users`          | Sí        | Correos permitidos, admins y sesiones    |
 * | `/admin/reportes`     | `Reportes`       | Sí        | Reportes de ocupación y exportación CSV  |
 * | `/admin`              | —                | Sí        | Redirige a `/admin/dashboard`            |
 * | `/**`                 | —                | No        | Redirige a `/` (catch-all)               |
 *
 * @see {@link authGuard} — guard que protege las rutas bajo `/admin`.
 */

import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { rootGuard } from './core/guards/root-guard';

/**
 * Árbol de rutas de la aplicación Angular.
 * Consumido por `provideRouter(routes)` en {@link appConfig}.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then(modulo => modulo.Home)
  },
  {
    path: 'public',
    /** Sección pública con tabla de sensores en tiempo real (Socket.IO). */
    loadComponent: () =>
      import('./pages/public-section/public-section').then(modulo => modulo.PublicSection)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(modulo => modulo.Login)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then(modulo => modulo.Register)
  },
  {
    path: 'admin',
    /** Todas las rutas hijas requieren autenticación verificada por `authGuard`. */
    canActivate: [authGuard],
    children: [
      {
        /** Métricas de ocupación, salud de nodos y alertas. */
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin/dashboard/dashboard').then(modulo => modulo.Dashboard)
      },
      {
        /** Control de acceso: lista blanca, administradores y sesiones. */
        path: 'users',
        canActivate: [rootGuard],
        loadComponent: () =>
          import('./pages/admin/users/users').then(modulo => modulo.Users)
      },
      {
        /** Reportes guardados sobre el histórico de ocupación. */
        path: 'reportes',
        loadComponent: () =>
          import('./pages/admin/reportes/reportes').then(modulo => modulo.Reportes)
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
