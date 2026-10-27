import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CotizacionService } from '../../core/services/cotizacion.service';
import { Cotizacion } from './cotizacion';

/** Respuesta del backend a una solicitud bien formada. */
const creada = {
  idSolicitud: 'abcd1234-0000-0000-0000-000000000000',
  estimacion: {
    nodos: 3,
    nodosOperativos: 3,
    nodosRespaldo: 0,
    dispositivosEstimados: 270,
    m2PorNodo: 85,
    desglose: [],
    integraciones: [],
    notas: [],
  },
};

/** Solicitud válida, tal como la deja el usuario que completó los cuatro pasos. */
const VALIDO = {
  tipoRecinto: 'auditorio',
  areaM2: '600',
  aforoMinimo: '100',
  aforoMaximo: '300',
  eventosAnuales: '24',
  requisitos: { camaras: false, analisisRed: false, seguridadPrivada: false, ventilacionRemota: false, notas: '' },
  organizacion: 'Teatro Mayor',
  nombreContacto: 'Ana Gómez',
  correoContacto: 'ana@teatro.co',
  telefonoContacto: '',
  aceptaDatos: true,
};

describe('Cotizacion', () => {
  let fixture: ComponentFixture<Cotizacion>;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  /** Crea la página y ejecuta la primera detección de cambios. */
  const crear = () => {
    fixture = TestBed.createComponent(Cotizacion);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  /** Elemento raíz del componente. */
  const html = () => fixture.nativeElement as HTMLElement;
  /** Texto visible de la página. */
  const texto = () => html().textContent ?? '';

  beforeEach(() => {
    api = {
      enviar: vi.fn(() => of({ success: true, data: creada })),
    };
    TestBed.configureTestingModule({
      imports: [Cotizacion],
      providers: [provideRouter([]), { provide: CotizacionService, useValue: api }],
    });
  });

  it('empieza en el paso 1 con la lectura vacía y una pista de qué falta', () => {
    crear();
    expect(texto()).toContain('Tu espacio');
    expect(texto()).toContain('Elige el tipo de recinto');
    expect(texto()).toContain('¿Qué es un nodo?');
  });

  it('no avanza de paso con el espacio incompleto y explica qué falta', () => {
    const componente = crear();
    html().querySelector<HTMLButtonElement>('.btn-primary')!.click();
    fixture.detectChanges();
    expect(componente.paso()).toBe(1);
    expect(texto()).toContain('Elige el tipo de recinto');

    componente.form.patchValue({ tipoRecinto: 'auditorio', areaM2: '600', aforoMinimo: '100', aforoMaximo: '300' });
    fixture.detectChanges();
    html().querySelector<HTMLButtonElement>('.btn-primary')!.click();
    fixture.detectChanges();
    expect(componente.paso()).toBe(2);
  });

  it('rechaza un aforo máximo menor que el mínimo', () => {
    const componente = crear();
    componente.form.patchValue({ tipoRecinto: 'auditorio', areaM2: '600', aforoMinimo: '500', aforoMaximo: '100' });
    fixture.detectChanges();
    html().querySelector<HTMLButtonElement>('.btn-primary')!.click();
    fixture.detectChanges();
    expect(componente.paso()).toBe(1);
    expect(texto()).toContain('El aforo máximo no puede ser menor que el mínimo.');
  });

  it('la lectura viva responde en cuanto hay tipo, área y aforo', () => {
    const componente = crear();
    componente.form.patchValue({ tipoRecinto: 'auditorio', areaM2: '750', aforoMaximo: '300' });
    fixture.detectChanges();
    expect(texto()).toContain('nodos estimados');
    expect(componente.lectura().desglose.length).toBeGreaterThan(0);
  });

  it('los requisitos marcados aparecen como integraciones pedidas', () => {
    const componente = crear();
    componente.form.patchValue({
      tipoRecinto: 'auditorio',
      areaM2: '750',
      aforoMaximo: '300',
      requisitos: { camaras: true, analisisRed: false, seguridadPrivada: false, ventilacionRemota: true, notas: '' },
    });
    fixture.detectChanges();
    expect(texto()).toContain('Integraciones pedidas');
    expect(texto()).toContain('ventilación remoto');
  });

  it('envía la solicitud con los números convertidos y sin teléfono vacío', () => {
    const componente = crear();
    componente.form.setValue(VALIDO);
    componente.enviar();
    expect(api['enviar']).toHaveBeenCalledTimes(1);
    const payload = api['enviar'].mock.calls[0][0];
    expect(payload.areaM2).toBe(600);
    expect(payload.aforoMaximo).toBe(300);
    expect(payload.aceptaDatos).toBe(true);
    expect(payload.telefonoContacto).toBeUndefined();
    expect(componente.resultado()).toEqual(creada);
    expect(componente.paso()).toBe(5);
  });

  it('el paso de conexiones nunca bloquea: se puede pasar sin marcar nada', () => {
    const componente = crear();
    componente.form.patchValue({
      tipoRecinto: 'auditorio',
      areaM2: '600',
      aforoMinimo: '100',
      aforoMaximo: '300',
      eventosAnuales: '24',
    });
    componente.avanzar();
    componente.avanzar();
    expect(componente.paso()).toBe(3);
    componente.avanzar();
    expect(componente.paso()).toBe(4);
  });

  it('un error del servidor deja el formulario en pie con un aviso', () => {
    api['enviar'] = vi.fn(() =>
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    const componente = crear();
    componente.form.setValue(VALIDO);
    componente.enviar();
    fixture.detectChanges();
    expect(componente.resultado()).toBeNull();
    expect(texto()).toContain('No se pudo enviar la solicitud');
  });

  it('la confirmación muestra la referencia y permite empezar otra', () => {
    const componente = crear();
    componente.form.setValue(VALIDO);
    componente.enviar();
    fixture.detectChanges();
    expect(texto()).toContain('ABCD1234');
    expect(texto()).toContain('Descargar copia');

    componente.nuevaSolicitud();
    fixture.detectChanges();
    expect(componente.paso()).toBe(1);
    expect(componente.form.value.tipoRecinto).toBe('');
  });
});
