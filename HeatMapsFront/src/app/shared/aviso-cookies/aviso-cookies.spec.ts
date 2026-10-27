import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AvisoCookiesComponent } from './aviso-cookies';

describe('AvisoCookiesComponent', () => {
  beforeEach(() => localStorage.clear());

  /** Crea el aviso con el navegador recién limpiado y refresca la vista. */
  const crear = () => {
    const fixture = TestBed.createComponent(AvisoCookiesComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AvisoCookiesComponent],
      providers: [provideRouter([])],
    });
  });

  it('se muestra en la primera visita y enlaza a la política', () => {
    const fixture = crear();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.aviso')).not.toBeNull();
    expect((html.querySelector('.aviso a') as HTMLAnchorElement).getAttribute('href')).toBe(
      '/legal/cookies',
    );
  });

  it('al responder escribe la marca y se retira', () => {
    const fixture = crear();
    (fixture.nativeElement.querySelector('.aviso-tecla') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.aviso')).toBeNull();
    expect(localStorage.getItem('aviso-cookies')).toBe('aceptado');
  });

  it('si el navegador ya registró la respuesta, no vuelve a aparecer', () => {
    localStorage.setItem('aviso-cookies', 'aceptado');
    expect((crear().nativeElement as HTMLElement).querySelector('.aviso')).toBeNull();
  });
});
