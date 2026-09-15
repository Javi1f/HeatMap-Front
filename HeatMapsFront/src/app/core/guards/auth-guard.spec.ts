import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, isObservable, Observable, of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth-guard';

/** Resuelve el resultado del guard, sea síncrono u observable. */
const resultado = (valor: unknown): Promise<unknown> =>
  (isObservable(valor) ? firstValueFrom(valor as Observable<unknown>) : Promise.resolve(valor));

/** Ejecuta el guard con un servicio de autenticación simulado. */
const ejecutar = (auth: Partial<AuthService>): unknown => {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
  return TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
};

/** URL a la que redirige un `UrlTree`. */
const destino = (valor: unknown): string => TestBed.inject(Router).serializeUrl(valor as UrlTree);

describe('authGuard', () => {
  it('deja pasar a quien ya está autenticado', async () => {
    const valor = ejecutar({ isAuthenticated: (() => true) as AuthService['isAuthenticated'] });
    expect(await resultado(valor)).toBe(true);
  });

  it('sin token redirige al inicio, no al login', async () => {
    const valor = ejecutar({
      isAuthenticated: (() => false) as AuthService['isAuthenticated'],
      getToken: () => null,
    });
    expect(destino(await resultado(valor))).toBe('/');
  });

  it('con token caducado redirige al inicio', async () => {
    const valor = ejecutar({
      isAuthenticated: (() => false) as AuthService['isAuthenticated'],
      getToken: () => 'caducado',
      checkSession: () => throwError(() => new Error('401')),
    });
    expect(destino(await resultado(valor))).toBe('/');
  });

  it('con token válido deja pasar tras confirmarlo con el backend', async () => {
    const valor = ejecutar({
      isAuthenticated: (() => false) as AuthService['isAuthenticated'],
      getToken: () => 'valido',
      checkSession: () => of({ isValid: true, admin: { id: 1, username: 'a', email: 'a@b.co' } }),
    });
    expect(await resultado(valor)).toBe(true);
  });
});
