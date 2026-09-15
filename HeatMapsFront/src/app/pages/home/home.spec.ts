import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ModalService } from '../../core/services/modal.service';
import { Home } from './home';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let autenticado: ReturnType<typeof signal<boolean>>;
  let auth: { isAuthenticated: unknown; logout: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  /** Crea la página de inicio y ejecuta la primera detección de cambios. */
  const crear = () => {
    fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  /** Elemento raíz del componente. */
  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    autenticado = signal(false);
    auth = { isAuthenticated: computed(() => autenticado()), logout: vi.fn(() => of({ message: 'ok' })) };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [{ provide: AuthService, useValue: auth }, { provide: Router, useValue: router }],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('sin sesión abre el login y lleva al registro y a los mapas', () => {
    crear();
    (html().querySelector('.card-btn') as HTMLButtonElement).click();
    expect(TestBed.inject(ModalService).showLogin()).toBe(true);

    (html().querySelector('.card-btn.secondary') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/public']);

    (html().querySelector('.register-btn') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/register']);
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('con sesión avisa durante 3 s y ofrece ir al dashboard', () => {
    vi.useFakeTimers();
    autenticado.set(true);
    const componente = crear();

    componente.openLogin();
    componente.openLogin();
    fixture.detectChanges();
    expect(TestBed.inject(ModalService).showLogin()).toBe(false);
    (html().querySelector('.already-logged-msg a') as HTMLAnchorElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/dashboard']);

    vi.advanceTimersByTime(3_000);
    expect(componente.alreadyLoggedMsg()).toBe(false);
  });

  it('con sesión, registrarse cierra antes la sesión, aunque el cierre falle', () => {
    autenticado.set(true);
    const componente = crear();
    expect(html().textContent).toContain('Cerrar sesión y registrarse');
    componente.goToRegister();
    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/register']);

    auth.logout.mockReturnValue(throwError(() => new Error('x')));
    componente.goToRegister();
    expect(router.navigate).toHaveBeenCalledTimes(2);
  });

  it('al destruirse cancela el aviso pendiente', () => {
    vi.useFakeTimers();
    autenticado.set(true);
    const componente = crear();
    componente.openLogin();
    fixture.destroy();
    vi.advanceTimersByTime(3_000);
    // El temporizador ya no existe: nadie vuelve a ocultar el aviso.
    expect(componente.alreadyLoggedMsg()).toBe(true);
    componente.ngOnDestroy();
  });
});
