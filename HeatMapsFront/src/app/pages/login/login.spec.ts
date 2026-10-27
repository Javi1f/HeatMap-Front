import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ModalService } from '../../core/services/modal.service';
import { LoginModalComponent } from '../../shared/components/login-modal/login-modal';
import { Login } from './login';

/**
 * La página de login y el cuadro modal comparten `LoginStateService`; aquí se
 * comprueba que cada uno lo cablea a su plantilla.
 */
describe.each([
  ['Login', Login],
  ['LoginModalComponent', LoginModalComponent],
] as const)('%s', (_nombre, Componente) => {
  let login: ReturnType<typeof vi.fn>;

  /** Crea el componente y devuelve atajos para escribir en el formulario y enviarlo. */
  const crear = () => {
    const fixture = TestBed.createComponent(Componente as typeof Login);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    /** Escribe en un campo como lo haría el usuario. */
    const escribir = (id: string, valor: string) => {
      const input = html.querySelector(`#${id}`) as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    };
    /** Envía el formulario y actualiza la vista. */
    const enviar = () => {
      (html.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, c: fixture.componentInstance as Login & LoginModalComponent, html, escribir, enviar };
  };

  beforeEach(() => {
    login = vi.fn(() => of({ admin: { id: 'a1' }, token: 't' }));
    TestBed.configureTestingModule({
      imports: [Componente],
      providers: [provideRouter([]), { provide: AuthService, useValue: { login } }],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => vi.useRealTimers());

  it('marca los campos obligatorios', () => {
    const { html, enviar } = crear();
    enviar();
    expect(html.textContent).toContain('Este campo es obligatorio.');
    expect(html.textContent).toContain('La contraseña es obligatoria.');
    expect(login).not.toHaveBeenCalled();
  });

  it('inicia sesión con lo escrito', () => {
    vi.useFakeTimers();
    const { c, html, escribir, enviar } = crear();
    escribir('identifier', 'ana');
    escribir('password', 'secreta');
    enviar();
    expect(login).toHaveBeenCalledWith({ username: 'ana', password: 'secreta' });
    // Mientras vuela, la tecla está bloqueada y la cortina anuncia el acceso.
    expect((html.querySelector('.btn-primary') as HTMLButtonElement).disabled).toBe(true);
    expect(html.textContent).toContain('Acceso concedido');
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    expect(c.loginForm).toBe(c.loginState.loginForm);
  });

  it('mientras la petición vuela, la cortina cubre el formulario; cerrar cancela', () => {
    vi.useFakeTimers();
    const pendiente = new Subject<{ admin: unknown; token: string }>();
    login.mockReturnValue(pendiente.asObservable());
    const { c, html, fixture, escribir, enviar } = crear();
    escribir('identifier', 'ana');
    escribir('password', 'secreta');
    enviar();
    expect(c.isSubmitting()).toBe(true);
    expect(html.textContent).toContain('Verificando credenciales');
    expect((html.querySelector('.btn-primary') as HTMLButtonElement).disabled).toBe(true);
    // Cerrar el formulario aborta la petición en vuelo: no navegará más tarde.
    c.loginState.reset();
    fixture.detectChanges();
    expect(c.isSubmitting()).toBe(false);
    expect(html.querySelector('.cortina')).toBeNull();
    pendiente.complete();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('muestra el error y bloquea tras tres fallos', () => {
    vi.useFakeTimers();
    login.mockReturnValue(throwError(() => new Error('401')));
    const { c, html, fixture, escribir, enviar } = crear();
    escribir('identifier', 'ana');
    escribir('password', 'mal');
    enviar();
    expect(html.textContent).toContain('Credenciales incorrectas.');
    enviar();
    enviar();
    expect(c.isBlocked()).toBe(true);
    expect(html.textContent).toContain(`${c.countdown()}`);
    vi.advanceTimersByTime(10_000);
    fixture.detectChanges();
    expect(c.isBlocked()).toBe(false);
  });

  it('muestra u oculta la contraseña', () => {
    const { c, html, fixture } = crear();
    (html.querySelector('.toggle-password') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(c.showPassword()).toBe(true);
    expect((html.querySelector('#password') as HTMLInputElement).type).toBe('text');
  });

  it('al destruirse detiene la cuenta atrás', () => {
    const { c, fixture } = crear();
    const destruir = vi.spyOn(c.loginState, 'destroy');
    fixture.destroy();
    expect(destruir).toHaveBeenCalled();
  });
});

describe('LoginModalComponent: cierre', () => {
  afterEach(() => vi.useRealTimers());

  it('cierra al pulsar fuera, en la X o al entrar; no al pulsar dentro', () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [LoginModalComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: { login: () => of({}) } }],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const modal = TestBed.inject(ModalService);
    const fixture = TestBed.createComponent(LoginModalComponent);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    modal.openLogin();
    (html.querySelector('.modal-card') as HTMLElement).click();
    expect(modal.showLogin()).toBe(true);
    (html.querySelector('.close-btn') as HTMLButtonElement).click();
    expect(modal.showLogin()).toBe(false);

    modal.openLogin();
    fixture.componentInstance.loginForm.setValue({ identifier: 'ana', password: 'x' });
    fixture.componentInstance.onSubmit();
    // Con éxito el cuadro sigue abierto el instante de «acceso concedido»,
    // y se cierra solo antes de navegar al dashboard.
    expect(modal.showLogin()).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(modal.showLogin()).toBe(false);
    expect(fixture.componentInstance.loginForm.value.identifier).toBeNull();

    modal.openLogin();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modal.showLogin()).toBe(false);
  });
});
