import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of, throwError } from 'rxjs';
import { describeHttpError } from '../http-error';
import { AuthService } from './auth.service';
import { LoginStateService } from './login-state.service';
import { ModalService } from './modal.service';
import { SidebarService } from './sidebar.service';
import { ThemeService } from './theme.service';
import { VerificationService } from './verification.service';
import { ETIQUETAS_TIPO } from './reportes.service';

describe('describeHttpError', () => {
  /** Error HTTP con el estado y el cuerpo indicados. */
  const error = (status: number, cuerpo: unknown = null) => new HttpErrorResponse({ status, error: cuerpo });

  it('usa el texto alternativo si no es un error HTTP', () => {
    expect(describeHttpError(new Error('x'), 'Alternativo')).toBe('Alternativo');
  });

  it('explica los estados que se entienden mejor por sí solos', () => {
    expect(describeHttpError(error(0), 'x')).toContain('No hay conexión');
    expect(describeHttpError(error(401, { message: 'otro' }), 'x')).toContain('sesión caducó');
    expect(describeHttpError(error(429), 'x')).toContain('Demasiadas peticiones');
    expect(describeHttpError(error(503), 'x')).toContain('servidor devolvió un error');
  });

  it('prefiere el mensaje del backend y si no hay, el alternativo', () => {
    expect(describeHttpError(error(409, { message: 'Ya existe' }), 'x')).toBe('Ya existe');
    expect(describeHttpError(error(404), 'No encontrado')).toBe('No encontrado');
  });
});

describe('VerificationService', () => {
  it('informa los intentos restantes en singular, plural y agotados', () => {
    const servicio = new VerificationService();
    servicio.handleServerError(2);
    expect(servicio.verificationError()).toBe('Código incorrecto. Te quedan 2 intentos.');
    servicio.handleServerError(1);
    expect(servicio.verificationError()).toBe('Código incorrecto. Te quedan 1 intento.');
    servicio.handleServerError(0);
    expect(servicio.verificationError()).toBe('Has agotado todos los intentos.');
    expect(servicio.attemptsLeft()).toBe(0);
    servicio.reset();
    expect([servicio.attemptsLeft(), servicio.verificationError()]).toEqual([3, '']);
  });
});

describe('ModalService', () => {
  it('abre y cierra el login', () => {
    const servicio = new ModalService();
    servicio.openLogin();
    expect(servicio.showLogin()).toBe(true);
    servicio.closeLogin();
    expect(servicio.showLogin()).toBe(false);
  });
});

describe('ThemeService', () => {
  beforeEach(() => localStorage.clear());

  it('arranca en oscuro, lo aplica al body y alterna recordando la elección', () => {
    const servicio = TestBed.inject(ThemeService);
    servicio.init();
    expect(document.body.getAttribute('data-theme')).toBe('dark');
    expect(servicio.isDark()).toBe(true);

    servicio.toggle();
    expect(servicio.theme()).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.body.getAttribute('data-theme')).toBe('light');
    servicio.toggle();
    expect(servicio.isDark()).toBe(true);
  });

  it('respeta el tema guardado', () => {
    localStorage.setItem('theme', 'light');
    TestBed.resetTestingModule();
    expect(TestBed.inject(ThemeService).theme()).toBe('light');
  });
});

describe('SidebarService', () => {
  /** Servicio de barra lateral en una pantalla móvil o de escritorio. */
  const crear = (movil: boolean) => {
    TestBed.configureTestingModule({ providers: [{ provide: BreakpointObserver, useValue: { isMatched: () => movil } }] });
    return TestBed.inject(SidebarService);
  };

  it('en escritorio colapsa la barra', () => {
    const servicio = crear(false);
    servicio.initResponsive();
    expect(servicio.isCollapsed()).toBe(false);
    servicio.toggle();
    expect(servicio.isCollapsed()).toBe(true);
    expect(servicio.isMobileOpen()).toBe(false);
  });

  it('en móvil arranca colapsada y abre el panel superpuesto', () => {
    const servicio = crear(true);
    servicio.initResponsive();
    expect(servicio.isCollapsed()).toBe(true);
    servicio.toggle();
    expect(servicio.isMobileOpen()).toBe(true);
    servicio.closeMobile();
    expect(servicio.isMobileOpen()).toBe(false);
  });
});

describe('LoginStateService', () => {
  /** Estado del login con la función de acceso indicada. */
  const crear = (login: AuthService['login']) => {
    const router = { navigate: vi.fn(() => Promise.resolve(true)) };
    const servicio = new LoginStateService(new FormBuilder(), { login } as AuthService, router as unknown as Router);
    return { s: servicio, router };
  };

  afterEach(() => vi.useRealTimers());

  it('no envía un formulario incompleto y marca los campos', () => {
    const login = vi.fn();
    const { s } = crear(login);
    s.onSubmit();
    expect(login).not.toHaveBeenCalled();
    expect(s.controles['identifier'].touched).toBe(true);
  });

  it('con credenciales correctas avisa y va al dashboard', () => {
    const login = vi.fn(() => of({ admin: { id: 1, username: 'a', email: 'a@b.co' }, token: 't' }));
    const { s, router } = crear(login);
    const alTerminar = vi.fn();
    s.loginForm.setValue({ identifier: 'ana', password: 'x' });

    s.onSubmit(alTerminar);

    expect(login).toHaveBeenCalledWith({ username: 'ana', password: 'x' });
    expect(alTerminar).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('bloquea 10 s tras tres intentos fallidos y luego desbloquea', () => {
    vi.useFakeTimers();
    const login = vi.fn(() => throwError(() => new Error('401')));
    const { s } = crear(login);
    s.loginForm.setValue({ identifier: 'ana', password: 'x' });

    s.onSubmit();
    s.onSubmit();
    expect(s.loginError()).toBe('Credenciales incorrectas.');
    expect(s.isBlocked()).toBe(false);
    s.onSubmit();
    expect(s.isBlocked()).toBe(true);

    s.onSubmit();
    expect(login).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(9_000);
    expect(s.countdown()).toBe(1);
    vi.advanceTimersByTime(1_000);
    expect(s.isBlocked()).toBe(false);
    expect(s.countdown()).toBe(10);
  });

  it('reset y destroy detienen la cuenta atrás', () => {
    vi.useFakeTimers();
    const { s } = crear(vi.fn(() => throwError(() => new Error('401'))));
    s.loginForm.setValue({ identifier: 'ana', password: 'x' });
    for (let i = 0; i < 3; i++) s.onSubmit();

    s.reset();
    expect([s.isBlocked(), s.loginError(), s.loginForm.value.identifier]).toEqual([false, '', null]);
    vi.advanceTimersByTime(20_000);
    expect(s.countdown()).toBe(10);
    s.destroy();
  });

  it('muestra u oculta la contraseña', () => {
    const { s } = crear(vi.fn());
    s.togglePassword();
    expect(s.showPassword()).toBe(true);
  });
});

describe('Etiquetas de reportes', () => {
  it('nombra los tres tipos', () => {
    expect(Object.values(ETIQUETAS_TIPO)).toEqual(['Serie temporal', 'Resumen por zona', 'Alertas']);
  });
});
