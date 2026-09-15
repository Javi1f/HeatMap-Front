import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ModalService } from '../../../core/services/modal.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { NavbarComponent } from './navbar';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let autenticado: ReturnType<typeof signal<boolean>>;
  let rol: ReturnType<typeof signal<'root' | 'admin'>>;
  let auth: Record<string, unknown>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let movil: boolean;

  /** Crea la barra de navegación y ejecuta la primera detección de cambios. */
  const crear = () => {
    fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  /** Elemento raíz del componente. */
  const html = () => fixture.nativeElement as HTMLElement;
  /** Textos de las entradas de menú visibles. */
  const etiquetas = () => [...html().querySelectorAll<HTMLElement>('.nav-label')]
    .filter((elemento) => elemento.style.display !== 'none')
    .map((elemento) => elemento.textContent?.trim());

  beforeEach(() => {
    localStorage.clear();
    movil = false;
    autenticado = signal(false);
    rol = signal<'root' | 'admin'>('admin');
    auth = {
      isAuthenticated: computed(() => autenticado()),
      currentAdmin: computed(() => (autenticado() ? { id: 1, username: 'ana', email: 'a@b.co', rol: rol() } : null)),
      esRoot: computed(() => autenticado() && rol() === 'root'),
      logout: vi.fn(() => of({ message: 'ok' })),
    };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: BreakpointObserver, useValue: { isMatched: () => movil } },
      ],
    });
  });

  it('sin sesión muestra sólo las secciones públicas y el botón de acceso', () => {
    crear();
    expect(etiquetas()).toEqual(['Inicio', 'Sección pública']);
    (html().querySelector('.login-btn') as HTMLButtonElement).click();
    expect(TestBed.inject(ModalService).showLogin()).toBe(true);
  });

  it('un admin no ve «Usuarios»; un root sí', () => {
    autenticado.set(true);
    crear();
    expect(etiquetas()).toEqual(['Inicio', 'Sección pública', 'Dashboard', 'Reportes']);
    expect(html().textContent).toContain('ana');

    rol.set('root');
    fixture.detectChanges();
    expect(etiquetas()).toContain('Usuarios');
  });

  it('navega y cierra el panel móvil', () => {
    crear();
    (html().querySelectorAll<HTMLAnchorElement>('.nav-item')[1]).click();
    expect(router.navigate).toHaveBeenCalledWith(['/public']);
  });

  it('cerrar sesión vuelve al inicio aunque el backend falle', () => {
    autenticado.set(true);
    const componente = crear();
    (html().querySelector('.logout-btn') as HTMLButtonElement).click();
    expect(auth['logout']).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);

    (auth['logout'] as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => new Error('500')));
    componente.logout();
    expect(router.navigate).toHaveBeenCalledTimes(2);
  });

  it('alterna el tema', () => {
    const componente = crear();
    expect(componente.tema()).toEqual({ icono: 'light_mode', texto: 'Modo claro' });
    (html().querySelector('.theme-btn') as HTMLButtonElement).click();
    expect(componente.tema()).toEqual({ icono: 'dark_mode', texto: 'Modo oscuro' });
  });

  it('en escritorio pliega la barra y oculta las etiquetas', () => {
    const componente = crear();
    expect(componente.iconoDelPliegue()).toBe('chevron_left');
    (html().querySelector('.toggle-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(componente.iconoDelPliegue()).toBe('chevron_right');
    expect(etiquetas()).toEqual([]);
    expect(html().querySelector('aside')?.classList).toContain('collapsed');
  });

  it('en móvil abre el panel superpuesto, que se cierra al tocar fuera', () => {
    movil = true;
    const componente = crear();
    const sidebar = TestBed.inject(SidebarService);
    expect(sidebar.isCollapsed()).toBe(true);

    (html().querySelector('.abrir-menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(componente.iconoDelPliegue()).toBe('close');
    expect(componente.mostrarEtiquetas()).toBe(true);
    (html().querySelector('.mobile-overlay') as HTMLElement).click();
    fixture.detectChanges();
    expect(componente.isMobileOpen()).toBe(false);

    window.dispatchEvent(new Event('resize'));
    expect(sidebar.isCollapsed()).toBe(true);
  });
});
