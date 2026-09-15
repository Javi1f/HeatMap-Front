import { TestBed } from '@angular/core/testing';
import { provideRouter, Route } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AppComponent } from './app';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { authGuard } from './core/guards/auth-guard';
import { rootGuard } from './core/guards/root-guard';
import { AuthService } from './core/services/auth.service';
import { ModalService } from './core/services/modal.service';
import { SocketService } from './socket/socket.service';
import { Home } from './pages/home/home';
import { PublicSection } from './pages/public-section/public-section';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Dashboard } from './pages/admin/dashboard/dashboard';
import { Users } from './pages/admin/users/users';
import { Reportes } from './pages/admin/reportes/reportes';

describe('AppComponent', () => {
  /** Crea la raíz de la aplicación con un `AuthService` falso y el token indicado. */
  const crear = (token: string | null, sesion = of({ isValid: true })) => {
    const auth = {
      getToken: vi.fn(() => token),
      checkSession: vi.fn(() => sesion),
      isAuthenticated: () => false,
      currentAdmin: () => null,
      esRoot: () => false,
      login: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return { fixture, auth };
  };

  it('aplica el tema y, sin token, no consulta la sesión', () => {
    const { auth } = crear(null);
    expect(document.body.getAttribute('data-theme')).toBeTruthy();
    expect(auth.checkSession).not.toHaveBeenCalled();
  });

  it('con token revalida la sesión y tolera que haya caducado', () => {
    const { auth } = crear('tok', throwError(() => new Error('401')));
    expect(auth.checkSession).toHaveBeenCalled();
  });

  it('muestra el cuadro de login cuando se abre', () => {
    const { fixture } = crear(null);
    expect(fixture.nativeElement.querySelector('app-login-modal')).toBeNull();
    TestBed.inject(ModalService).openLogin();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-login-modal')).not.toBeNull();
    expect(fixture.componentInstance.isCollapsed()).toBe(false);
  });
});

describe('Rutas', () => {
  /** Ruta anidada según su camino de segmentos. */
  const buscar = (camino: string[], lista: Route[] = routes): Route => {
    const [cabeza, ...resto] = camino;
    const ruta = lista.find((candidata) => candidata.path === cabeza);
    if (!ruta) throw new Error(`No existe la ruta «${cabeza}»`);
    return resto.length ? buscar(resto, ruta.children) : ruta;
  };

  it('protege /admin con sesión y /admin/users además con rol root', () => {
    expect(buscar(['admin']).canActivate).toEqual([authGuard]);
    expect(buscar(['admin', 'users']).canActivate).toEqual([rootGuard]);
    expect(buscar(['admin', 'reportes']).canActivate).toBeUndefined();
    expect(buscar(['admin', '']).redirectTo).toBe('dashboard');
    expect(buscar(['**']).redirectTo).toBe('');
  });

  it('cada ruta carga su componente', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: SocketService, useValue: { sensorData$: new Subject(), connected$: of(false) } }],
    });
    const perezosas = [
      buscar(['']), buscar(['public']), buscar(['login']), buscar(['register']),
      buscar(['admin', 'dashboard']), buscar(['admin', 'users']), buscar(['admin', 'reportes']),
    ];
    const componentes = await Promise.all(perezosas.map((ruta) => (ruta.loadComponent as () => Promise<unknown>)()));
    expect(componentes).toEqual([Home, PublicSection, Login, Register, Dashboard, Users, Reportes]);
  });

  it('la configuración registra router, cliente HTTP con interceptores y el manejo global de errores', () => {
    expect(appConfig.providers.length).toBe(3);
  });
});
