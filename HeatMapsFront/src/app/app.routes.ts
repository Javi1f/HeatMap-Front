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
 * | `/acerca`             | `Acerca`         | No        | «¿Qué es PlaceAt?»: el viaje de la señal  |
 * | `/public`             | `PublicSection`  | No        | Mapa/tabla de sensores en tiempo real    |
 * | `/cotizacion`         | `Cotizacion`     | No        | Solicitud de cotización por pasos        |
 * | `/login`              | `Login`          | No        | Formulario de login a pantalla completa  |
 * | `/register`           | `Register`       | No        | Formulario de registro + verificación    |
 * | `/legal/privacidad`   | `Legal`          | No        | Política de privacidad (Ley 1581/2012)   |
 * | `/legal/aviso`        | `Legal`          | No        | Aviso legal e identificación del titular |
 * | `/legal/terminos`     | `Legal`          | No        | Términos y condiciones de uso            |
 * | `/legal/cookies`      | `Legal`          | No        | Política de cookies y almacenamiento     |
 * | `/admin/dashboard`    | `Dashboard`      | Sí        | Métricas de ocupación y estado de la red |
 * | `/admin/users`        | `Users`          | Sí        | Correos permitidos, admins y sesiones    |
 * | `/admin/reportes`     | `Reportes`       | Sí        | Reportes de ocupación y exportación CSV  |
 * | `/admin/cotizaciones` | `Cotizaciones`   | Sí        | Ciclo comercial de solicitudes de cotización |
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
    /** Página «¿Qué es PlaceAt?»: el viaje de la señal, desde el botón
     *  «Ver más» del inicio y el pie. */
    path: 'acerca',
    loadComponent: () => import('./pages/acerca/acerca').then(modulo => modulo.Acerca)
  },
  {
    /** Sección pública con tabla de sensores en tiempo real (Socket.IO). */
    path: 'public',
    loadComponent: () =>
      import('./pages/public-section/public-section').then(modulo => modulo.PublicSection)
  },
  {
    /** Solicitud de cotización, sin sesión: describe el recinto, el sistema
     *  estima los nodos y el equipo comercial refina la propuesta. */
    path: 'cotizacion',
    loadComponent: () =>
      import('./pages/cotizacion/cotizacion').then(modulo => modulo.Cotizacion)
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
    /** Apartado legal (Ley 1581 de 2012, SIC). Cuatro documentos de lectura
     *  compartida: el `data.documento` de cada ruta elige el que se renderiza
     *  dentro del mismo componente. */
    path: 'legal/privacidad',
    loadComponent: () => import('./pages/legal/legal').then(modulo => modulo.Legal),
    data: { documento: 'privacidad' }
  },
  {
    path: 'legal/aviso',
    loadComponent: () => import('./pages/legal/legal').then(modulo => modulo.Legal),
    data: { documento: 'aviso' }
  },
  {
    path: 'legal/terminos',
    loadComponent: () => import('./pages/legal/legal').then(modulo => modulo.Legal),
    data: { documento: 'terminos' }
  },
  {
    path: 'legal/cookies',
    loadComponent: () => import('./pages/legal/legal').then(modulo => modulo.Legal),
    data: { documento: 'cookies' }
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
        /** Ciclo comercial de las solicitudes de cotización. */
        path: 'cotizaciones',
        loadComponent: () =>
          import('./pages/admin/cotizaciones/cotizaciones').then(modulo => modulo.Cotizaciones)
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
