import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CotizacionService, SolicitudDetalle } from '../../../core/services/cotizacion.service';
import { Cotizaciones } from './cotizaciones';

/** Solicitud de ejemplo, tal como la devuelve el backend. */
const SOLICITUD: SolicitudDetalle = {
  idSolicitud: 'abcd1234-0000-0000-0000-000000000000',
  tipoRecinto: 'auditorio',
  organizacion: 'Teatro Mayor',
  nombreContacto: 'Ana Gómez',
  correoContacto: 'ana@teatro.co',
  telefonoContacto: null,
  areaM2: 600,
  aforoMinimo: 100,
  aforoMaximo: 300,
  eventosAnuales: 24,
  nodos: 8,
  estado: 'nueva',
  fechaCreacion: new Date('2026-10-27T10:00:00Z').toISOString(),
  datos: {
    version: 1,
    requisitos: { camaras: true, analisisRed: false, seguridadPrivada: false, ventilacionRemota: true },
  },
  estimacion: {
    nodos: 8,
    nodosOperativos: 8,
    nodosRespaldo: 0,
    dispositivosEstimados: 270,
    m2PorNodo: 75,
    desglose: [{ titulo: 'Por el área', valor: '8 nodos', detalle: '600 m² ÷ 75 m² por nodo.' }],
    integraciones: ['Enlace con el sistema de cámaras existente.'],
    notas: [],
  },
  notasComerciales: null,
  ipOrigen: '10.0.0.1',
};

describe('Cotizaciones', () => {
  let fixture: ComponentFixture<Cotizaciones>;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  const crear = () => {
    fixture = TestBed.createComponent(Cotizaciones);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  const html = () => fixture.nativeElement as HTMLElement;
  const texto = () => html().textContent ?? '';

  beforeEach(() => {
    api = {
      listar: vi.fn(() => of({ success: true, data: [SOLICITUD] })),
      obtener: vi.fn(() => of({ success: true, data: SOLICITUD })),
      cambiarEstado: vi.fn(() => of({ success: true, data: { ...SOLICITUD, estado: 'contactada' } })),
      eliminar: vi.fn(() => of({ success: true, data: { message: 'ok' } })),
      documento: vi.fn(() => of({ success: true, data: { idSolicitud: SOLICITUD.idSolicitud, version: 1, recibida: SOLICITUD.fechaCreacion, estado: 'nueva', solicitud: {}, estimacion: SOLICITUD.estimacion, notasComerciales: null } })),
    };
    TestBed.configureTestingModule({
      imports: [Cotizaciones],
      providers: [provideRouter([]), { provide: CotizacionService, useValue: api }],
    });
  });

  it('lista las solicitudes con su estado visible', () => {
    crear();
    expect(texto()).toContain('Teatro Mayor');
    expect(texto()).toContain('Nueva');
    expect(texto()).toContain('8');
  });

  it('el filtro por estado pide el listado filtrado', () => {
    const componente = crear();
    componente.cambiarFiltro('nueva');
    expect(api['listar']).toHaveBeenLastCalledWith('nueva');
    componente.cambiarFiltro('');
    expect(api['listar']).toHaveBeenLastCalledWith(undefined);
  });

  it('abrir una solicitud muestra su estimación congelada y su contacto', () => {
    const componente = crear();
    componente.abrir(SOLICITUD.idSolicitud);
    fixture.detectChanges();
    expect(componente.abierta()?.correoContacto).toBe('ana@teatro.co');
    expect(texto()).toContain('Lo que vio el cliente');
    expect(texto()).toContain('Cámaras existentes');
    expect(texto()).toContain('Ventilación remota → alertas');
  });

  it('guardar mueve el estado con las notas y refresca el listado', () => {
    const componente = crear();
    componente.abrir(SOLICITUD.idSolicitud);
    componente.formEstado.setValue({ estado: 'contactada', notas: 'Llamada agendada' });
    componente.guardar();
    expect(api['cambiarEstado']).toHaveBeenCalledWith('abcd1234-0000-0000-0000-000000000000', 'contactada', 'Llamada agendada');
    expect(api['listar']).toHaveBeenCalledTimes(2);
    expect(componente.abierta()?.estado).toBe('contactada');
  });

  it('el borrado pide confirmación y la cancelación conserva todo', () => {
    const componente = crear();
    componente.pedirEliminar(SOLICITUD.idSolicitud);
    fixture.detectChanges();
    expect(texto()).toContain('Eliminar solicitud');

    componente.cancelarEliminar();
    expect(api['eliminar']).not.toHaveBeenCalled();

    componente.pedirEliminar(SOLICITUD.idSolicitud);
    componente.confirmarEliminar();
    expect(api['eliminar']).toHaveBeenCalledWith(SOLICITUD.idSolicitud);
    expect(componente.abierta()).toBeNull();
  });

  it('un listado vacío explica que aún no llega nada', () => {
    api['listar'] = vi.fn(() => of({ success: true, data: [] }));
    crear();
    expect(texto()).toContain('Aún no hay solicitudes');
  });

  it('un error del servidor se explica en la pantalla', () => {
    api['listar'] = vi.fn(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    crear();
    expect(texto()).toContain('El servidor devolvió un error');
  });
});
