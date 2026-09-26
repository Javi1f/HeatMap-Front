import { TestBed } from '@angular/core/testing';
import { OndasComponent } from './ondas';

describe('OndasComponent', () => {
  it('dibuja tres ondas y el emisor, oculto a los lectores de pantalla', () => {
    const vista = TestBed.createComponent(OndasComponent);
    vista.detectChanges();
    const anfitrion = vista.nativeElement as HTMLElement;

    expect(anfitrion.classList).toContain('ondas');
    expect(anfitrion.getAttribute('aria-hidden')).toBe('true');
    expect(anfitrion.querySelectorAll('i')).toHaveLength(3);
    expect(anfitrion.style.getPropertyValue('--ondas-tam')).toBe('12px');
    expect(anfitrion.style.getPropertyValue('--ondas-color')).toBe('');
    expect(anfitrion.classList).not.toContain('ondas-quieta');
  });

  it('acepta tamaño, color y modo quieto', () => {
    const vista = TestBed.createComponent(OndasComponent);
    vista.componentRef.setInput('tam', '20px');
    vista.componentRef.setInput('color', 'red');
    vista.componentRef.setInput('quieta', true);
    vista.detectChanges();
    const anfitrion = vista.nativeElement as HTMLElement;

    expect(anfitrion.style.getPropertyValue('--ondas-tam')).toBe('20px');
    expect(anfitrion.style.getPropertyValue('--ondas-color')).toBe('red');
    expect(anfitrion.classList).toContain('ondas-quieta');
  });
});
