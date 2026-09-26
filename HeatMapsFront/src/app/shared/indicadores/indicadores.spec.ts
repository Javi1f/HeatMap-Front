import { TestBed } from '@angular/core/testing';
import { MedidorComponent, SenalComponent } from './indicadores';

describe('SenalComponent', () => {
  it('enciende tantas barras como indica y muestra el texto con su tono', () => {
    const vista = TestBed.createComponent(SenalComponent);
    vista.componentRef.setInput('barras', 3);
    vista.componentRef.setInput('texto', 'Verificado');
    vista.detectChanges();
    const anfitrion = vista.nativeElement as HTMLElement;

    expect(anfitrion.querySelectorAll('.barras i')).toHaveLength(4);
    expect(anfitrion.querySelectorAll('.barras i.encendida')).toHaveLength(3);
    expect(anfitrion.querySelector('.barras')?.getAttribute('aria-hidden')).toBe('true');
    expect(anfitrion.textContent?.trim()).toBe('Verificado');
    expect(anfitrion.classList).toContain('senal');
    expect(anfitrion.classList).toContain('tono-neutro');
    expect(anfitrion.classList).not.toContain('vivo');
  });

  it('en vivo y con tono lo refleja en sus clases', () => {
    const vista = TestBed.createComponent(SenalComponent);
    vista.componentRef.setInput('barras', 4);
    vista.componentRef.setInput('texto', 'En línea');
    vista.componentRef.setInput('tono', 'ok');
    vista.componentRef.setInput('vivo', true);
    vista.detectChanges();
    const anfitrion = vista.nativeElement as HTMLElement;

    expect(anfitrion.classList).toContain('tono-ok');
    expect(anfitrion.classList).toContain('vivo');
    expect(anfitrion.querySelectorAll('.barras i.encendida')).toHaveLength(4);
  });
});

describe('MedidorComponent', () => {
  it('dibuja el total de segmentos, enciende los llenos y los encadena al aparecer', () => {
    const vista = TestBed.createComponent(MedidorComponent);
    vista.componentRef.setInput('llenos', 6);
    vista.componentRef.setInput('total', 10);
    vista.componentRef.setInput('tono', 'aviso');
    vista.componentRef.setInput('texto', '63.5 % de 200');
    vista.detectChanges();
    const anfitrion = vista.nativeElement as HTMLElement;
    const segmentos = anfitrion.querySelectorAll<HTMLElement>('.segmentos i');

    expect(segmentos).toHaveLength(10);
    expect(anfitrion.querySelectorAll('.segmentos i.encendido')).toHaveLength(6);
    expect(segmentos[2].style.animationDelay).toBe('135ms');
    expect(anfitrion.classList).toContain('tono-aviso');
    expect(anfitrion.querySelector('.texto')?.textContent).toBe('63.5 % de 200');
  });

  it('sin texto, los lectores de pantalla oyen cuántos segmentos hay llenos', () => {
    const vista = TestBed.createComponent(MedidorComponent);
    vista.componentRef.setInput('llenos', 2);
    vista.detectChanges();
    const anfitrion = vista.nativeElement as HTMLElement;

    expect(anfitrion.querySelectorAll('.segmentos i')).toHaveLength(3);
    expect(anfitrion.querySelector('.texto')).toBeNull();
    expect(anfitrion.querySelector('.solo-lector')?.textContent).toBe('2 de 3');
  });
});
