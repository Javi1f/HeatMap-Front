import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { noop } from 'rxjs';
import { apiUrl } from '../config';
import { AuthService } from './auth.service';

const ADMIN = { id: 1, username: 'raiz', email: 'r@unbosque.edu.co', rol: 'root' as const };

describe('AuthService', () => {
  let servicio: AuthService;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('arranca sin sesión', () => {
    expect(servicio.isAuthenticated()).toBe(false);
    expect(servicio.currentAdmin()).toBeNull();
    expect(servicio.esRoot()).toBe(false);
    expect(servicio.getToken()).toBeNull();
  });

  it('login guarda el token y el administrador', () => {
    servicio.login({ username: 'raiz', password: 'x' }).subscribe();
    const peticion = backend.expectOne(`${apiUrl}/auth/login`);
    expect(peticion.request.body).toEqual({ username: 'raiz', password: 'x' });
    peticion.flush({ admin: ADMIN, token: 'tok' });

    expect(servicio.getToken()).toBe('tok');
    expect(servicio.isAuthenticated()).toBe(true);
    expect(servicio.esRoot()).toBe(true);
  });

  it('register no abre sesión', () => {
    servicio.register({ username: 'a', email: 'a@b.co', password: 'x' }).subscribe();
    backend.expectOne(`${apiUrl}/auth/register`).flush({ message: 'ok', verificationRequired: true });
    expect(servicio.isAuthenticated()).toBe(false);
  });

  it('verifyCode abre sesión al acertar', () => {
    servicio.verifyCode('a@b.co', '12345').subscribe();
    const peticion = backend.expectOne(`${apiUrl}/auth/verify-code`);
    expect(peticion.request.body).toEqual({ email: 'a@b.co', code: '12345' });
    peticion.flush({ admin: { ...ADMIN, rol: 'admin' }, token: 'nuevo' });
    expect(servicio.getToken()).toBe('nuevo');
    expect(servicio.esRoot()).toBe(false);
  });

  it('cancelVerification envía el correo', () => {
    servicio.cancelVerification('a@b.co').subscribe();
    expect(backend.expectOne(`${apiUrl}/auth/cancel-verification`).request.body).toEqual({ email: 'a@b.co' });
  });

  it('checkSession válido restaura el estado desde el backend', () => {
    servicio.checkSession().subscribe();
    backend.expectOne(`${apiUrl}/auth/session`).flush({ isValid: true, admin: ADMIN });
    expect(servicio.currentAdmin()).toEqual(ADMIN);
  });

  it('checkSession inválido o fallido limpia la sesión', () => {
    localStorage.setItem('token', 'viejo');
    servicio.checkSession().subscribe();
    backend.expectOne(`${apiUrl}/auth/session`).flush({ isValid: false, admin: ADMIN });
    expect(servicio.getToken()).toBeNull();

    localStorage.setItem('token', 'viejo');
    const error = vi.fn();
    servicio.checkSession().subscribe({ error });
    backend.expectOne(`${apiUrl}/auth/session`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(error).toHaveBeenCalled();
    expect(servicio.getToken()).toBeNull();
  });

  it('logout limpia la sesión aunque el backend falle', () => {
    servicio.saveSession({ admin: ADMIN, token: 't' });
    servicio.logout().subscribe();
    backend.expectOne(`${apiUrl}/auth/logout`).flush({ message: 'ok' });
    expect(servicio.isAuthenticated()).toBe(false);

    servicio.saveSession({ admin: ADMIN, token: 't' });
    servicio.logout().subscribe({ error: noop });
    backend.expectOne(`${apiUrl}/auth/logout`).flush({}, { status: 500, statusText: 'Error' });
    expect(servicio.getToken()).toBeNull();
  });
});
