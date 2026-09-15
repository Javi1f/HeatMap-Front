/**
 * @file root-guard.ts
 * @description Guard de las pantallas reservadas al rol `root`.
 *
 * Va siempre dentro de `/admin`, así que `authGuard` ya comprobó la sesión.
 * Si la vista llega por recarga y aún no se conoce al administrador, se
 * pregunta al backend en lugar de rechazar por falta de datos.
 *
 * Es solo comodidad de interfaz: quien no es `root` no ve la pantalla, pero la
 * protección real está en el backend, que responde 403 a cualquier petición.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Deja pasar solo a administradores `root`; al resto lo lleva al dashboard. */
export const rootGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const alPanel = inject(Router).createUrlTree(['/admin/dashboard']);

  if (auth.currentAdmin()) return auth.esRoot() ? true : alPanel;

  return auth.checkSession().pipe(
    map((respuesta) => (respuesta.isValid && respuesta.admin?.rol === 'root' ? true : alPanel)),
    catchError(() => of(alPanel)),
  );
};
