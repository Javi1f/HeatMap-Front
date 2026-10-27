import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Legal } from './legal';

/**
 * Instancia el componente del apartado legal con el documento que fija la
 * ruta (`data.documento`) y ejecuta la primera detección de cambios.
 */
const crear = (documento?: string) => {
  TestBed.configureTestingModule({
    imports: [Legal],
    providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { data: { documento } } } }],
  });
  const fixture = TestBed.createComponent(Legal);
  fixture.detectChanges();
  return fixture;
};

describe('Legal', () => {
  it('sin documento fijado muestra la política por defecto y su sello de versión', () => {
    const fixture = crear(undefined);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.legal-titulo')?.textContent).toContain('Política de Privacidad');
    expect(fixture.componentInstance.documento()).toBe('privacidad');
    expect(html.querySelector('.insignia')?.textContent).toContain('Versión 1.0');
  });

  it('la política de privacidad identifica al responsable y sus cláusulas', () => {
    const fixture = crear('privacidad');
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.legal-titulo')?.textContent).toContain(
      'Política de Privacidad y Tratamiento de Datos Personales',
    );
    expect(html.textContent).toContain('artículo 13 de la Ley 1581 de 2012');
    expect(html.textContent).toContain('jazamudioc@unbosque.edu.co');
    expect(html.querySelectorAll('.clausula').length).toBe(12);
  });

  it('el aviso legal identifica a los dos titulares del sitio', () => {
    const fixture = crear('aviso');
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('Joann Alejandro Zamudio Castro');
    expect(html.textContent).toContain('Javier Felipe Meza Montero');
    expect(html.querySelectorAll('mark.pendiente').length).toBeGreaterThanOrEqual(2);
  });

  it('los términos declaran ley de Colombia y jurisdicción de Bogotá', () => {
    const fixture = crear('terminos');
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('República de Colombia');
    expect(html.textContent).toContain('Bogotá D.C.');
    expect(html.textContent).toContain('transacción en línea');
    expect(html.textContent).toContain('Ley 527 de 1999');
  });

  it('la política de cookies explica las tres claves del almacenamiento local', () => {
    const fixture = crear('cookies');
    const html = fixture.nativeElement as HTMLElement;
    for (const clave of ['token', 'theme', 'aviso-cookies']) {
      expect(html.textContent).toContain(clave);
    }
    expect(html.textContent).toContain('El sitio no utiliza cookies HTTP de seguimiento');
  });

  it('el conmutador lista los cuatro documentos y marca el activo', () => {
    const fixture = crear('terminos');
    const html = fixture.nativeElement as HTMLElement;
    const piezas = Array.from(html.querySelectorAll('.legal-piezas .pieza'));
    expect(piezas.length).toBe(4);
    const activa = (html.querySelector('.legal-piezas .pieza.activa') as HTMLElement).textContent;
    expect(activa).toContain('Términos');
  });

  it('los otros documentos son filas editoriales distintas del conmutador', () => {
    const fixture = crear('terminos');
    const html = fixture.nativeElement as HTMLElement;
    const otros = html.querySelector('.otros');
    expect(otros?.querySelector('.otros-encabezado')?.textContent).toContain('Otros documentos');
    expect(otros?.querySelectorAll('.otros-fila').length).toBe(3);
    expect(otros?.textContent).not.toContain('Términos');
    expect(otros?.querySelectorAll('.otros-flecha').length).toBe(3);
  });
});
