import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PieComponent } from './pie';

describe('PieComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PieComponent],
      providers: [provideRouter([])],
    });
  });

  it('reúne los enlaces al viaje del producto y a los cuatro documentos legales', () => {
    const fixture = TestBed.createComponent(PieComponent);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    const rutas = Array.from(html.querySelectorAll('.pie-ficha')).map((a) =>
      a.getAttribute('href'),
    );
    expect(rutas).toEqual([
      '/acerca',
      '/legal/privacidad',
      '/legal/aviso',
      '/legal/terminos',
      '/legal/cookies',
    ]);
  });

  it('cita la identificación sobria, sin símbolo de registro ni copyright', () => {
    const fixture = TestBed.createComponent(PieComponent);
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(html).toContain('2026');
    expect(html).toContain('Bogotá D.C.');
    expect(html).not.toContain('©');
    expect(html).not.toContain('Universidad El Bosque');
  });
});
