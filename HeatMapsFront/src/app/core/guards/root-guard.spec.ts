import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, isObservable, Observable, of, throwError } from 'rxjs';
import { Admin } from '../models/admin.model';
import { AuthService } from '../services/auth.service';
import { rootGuard } from './root-guard';

/** Resuelve el resultado del guard, sea síncrono u observable. */
const resultado = (valor: unknown): Promise<unknown> =>
  (isObservable(valor) ? firstValueFrom(valor as Observable<unknown>) : Promise.resolve(valor));

/** Ejecuta el guard con un servicio de autenticación simulado. */
const ejecutar = (auth: Partial<AuthService>): unknown => {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
  return TestBed.runInInjectionContext(() => rootGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
};

/** URL a la que redirige un `UrlTree`. */
const destino = (valor: unknown): string => TestBed.inject(Router).serializeUrl(valor as UrlTree);

/** Administrador con el rol indicado. */
const admin = (rol: 'root' | 'admin'): Admin => ({ id: 1, username: 'a', email: 'a@b.co', rol });

describe('rootGuard', () => {
  it('deja pasar a un root', async () => {
    const valor = ejecutar({
      currentAdmin: (() => admin('root')) as AuthService['currentAdmin'],
      esRoot: (() => true) as AuthService['esRoot'],
    });
    expect(await resultado(valor)).toBe(true);
  });

  it('lleva al dashboard a un admin sin rol root', async () => {
    const valor = ejecutar({
      currentAdmin: (() => admin('admin')) as AuthService['currentAdmin'],
      esRoot: (() => false) as AuthService['esRoot'],
    });
    expect(destino(await resultado(valor))).toBe('/admin/dashboard');
  });

  it('tras una recarga consulta al backend antes de decidir', async () => {
    const valor = ejecutar({
      currentAdmin: (() => null) as AuthService['currentAdmin'],
      checkSession: () => of({ isValid: true, admin: admin('root') }),
    });
    expect(await resultado(valor)).toBe(true);
  });

  it('tras una recarga, un admin, una sesión inválida o un fallo llevan al dashboard', async () => {
    for (const respuesta of [
      of({ isValid: true, admin: admin('admin') }),
      of({ isValid: false, admin: admin('root') }),
      throwError(() => new Error('401')),
    ]) {
      TestBed.resetTestingModule();
      const valor = ejecutar({
        currentAdmin: (() => null) as AuthService['currentAdmin'],
        checkSession: () => respuesta as ReturnType<AuthService['checkSession']>,
      });
      // Una respuesta tras otra: cada vuelta reinicia el módulo de pruebas.
      expect(destino(await resultado(valor))).toBe('/admin/dashboard'); // skipcq: JS-0032
    }
  });
});
