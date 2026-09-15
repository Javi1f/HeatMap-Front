import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { noop } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const auth = { getToken: vi.fn(), clearSession: vi.fn() };
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('añade la cabecera Authorization cuando hay token', () => {
    auth.getToken.mockReturnValue('abc');
    http.get('/api/metrics/overview').subscribe();
    expect(backend.expectOne('/api/metrics/overview').request.headers.get('Authorization')).toBe('Bearer abc');
  });

  it('ante un 401 de una ruta protegida limpia la sesión y vuelve al inicio', () => {
    auth.getToken.mockReturnValue('caducado');
    http.get('/api/metrics/overview').subscribe({ error: noop });
    backend.expectOne('/api/metrics/overview').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clearSession).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('un 401 del login no saca al usuario de la pantalla de acceso', () => {
    auth.getToken.mockReturnValue(null);
    http.post('/api/auth/login', {}).subscribe({ error: noop });
    backend.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
