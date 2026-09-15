import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { MetricsService } from '../../../core/services/metrics.service';
import { ReporteGenerado, ReportesService } from '../../../core/services/reportes.service';
import { Reportes } from './reportes';

const RESUMEN = {
  idReporte: 'r1', tipoReporte: 'alertas' as const, zona: 'Plazoleta',
  rangoInicio: '2026-09-01T00:00:00Z', rangoFin: '2026-09-07T23:59:59Z', fechaGeneracion: '2026-09-08T10:00:00Z',
};
const GENERADO: ReporteGenerado = { ...RESUMEN, columnas: ['Fecha', 'Nivel'], filas: [['2026-09-01', 'alta']], total: 1 };
/** Petición que falla con el estado HTTP indicado. */
const fallo = (status: number) => throwError(() => new HttpErrorResponse({ status }));

describe('Reportes', () => {
  let fixture: ComponentFixture<Reportes>;
  let reportes: Record<string, ReturnType<typeof vi.fn>>;
  let metricas: { zones: ReturnType<typeof vi.fn> };

  /** Crea la página de reportes y ejecuta la primera detección de cambios. */
  const crear = () => {
    fixture = TestBed.createComponent(Reportes);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  /** Elemento raíz del componente. */
  const html = () => fixture.nativeElement as HTMLElement;
  /** Botón por su título; `indice` elige entre varios iguales. */
  const boton = (titulo: string, indice = 0) => html().querySelectorAll<HTMLButtonElement>(`button[title="${titulo}"]`)[indice];

  beforeEach(() => {
    reportes = {
      listar: vi.fn(() => of({ success: true, data: [RESUMEN] })),
      crear: vi.fn(() => of({ success: true, data: GENERADO })),
      obtener: vi.fn(() => of({ success: true, data: GENERADO })),
      descargarCsv: vi.fn(() => of({ success: true, data: { nombreArchivo: 'a.csv', contenido: '' } })),
      eliminar: vi.fn(() => of({ success: true, message: 'ok' })),
    };
    metricas = { zones: vi.fn(() => of({ success: true, data: [{ idZona: 'z1', nombre: 'Plazoleta' }] })) };
    TestBed.configureTestingModule({
      imports: [Reportes],
      providers: [{ provide: ReportesService, useValue: reportes }, { provide: MetricsService, useValue: metricas }],
    });
  });

  it('propone los últimos 7 días y lista zonas y reportes guardados', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 14, 12, 0));
    const componente = crear();
    vi.useRealTimers();
    expect(componente.form.value).toMatchObject({ tipoReporte: 'serie_temporal', rangoInicio: '2026-09-07', rangoFin: '2026-09-14', idZona: '' });
    expect(componente.zonas()).toHaveLength(1);
    expect(html().textContent).toContain('Todas las zonas');
    expect(html().querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('sin zonas disponibles el selector queda con «todas»', () => {
    metricas.zones.mockReturnValue(fallo(500));
    expect(crear().zonas()).toEqual([]);
  });

  it('un fallo al listar se muestra', () => {
    reportes['listar'].mockReturnValue(fallo(0));
    const componente = crear();
    fixture.detectChanges();
    expect(componente.isCargando()).toBe(false);
    expect(html().querySelector('.alert-error')?.textContent).toContain('No hay conexión');
    expect(html().textContent).toContain('No hay reportes guardados');
  });

  it('no genera con el formulario incompleto', () => {
    const componente = crear();
    componente.form.patchValue({ rangoInicio: '' });
    componente.generar();
    expect(reportes['crear']).not.toHaveBeenCalled();
    expect(componente.controles['rangoInicio'].touched).toBe(true);
  });

  it('genera cubriendo los días completos, sin zona si no se eligió, y recarga la lista', () => {
    const componente = crear();
    componente.form.setValue({ tipoReporte: 'alertas', rangoInicio: '2026-09-01', rangoFin: '2026-09-07', idZona: '' });
    (html().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(reportes['crear']).toHaveBeenCalledWith({
      tipoReporte: 'alertas',
      rangoInicio: new Date('2026-09-01T00:00:00').toISOString(),
      rangoFin: new Date('2026-09-07T23:59:59').toISOString(),
      idZona: undefined,
    });
    expect(reportes['listar']).toHaveBeenCalledTimes(2);
    expect(html().textContent).toContain('alta');

    componente.form.patchValue({ idZona: 'z1' });
    componente.generar();
    expect(reportes['crear'].mock.calls[1][0].idZona).toBe('z1');
  });

  it('un reporte sin filas explica por qué', () => {
    reportes['obtener'].mockReturnValue(of({ success: true, data: { ...GENERADO, zona: null, filas: [], total: 0 } }));
    crear();
    boton('Abrir').click();
    fixture.detectChanges();
    expect(html().textContent).toContain('Sin datos en ese rango');
  });

  it.each([
    ['generar', 'crear', 'No se pudo generar'],
    ['abrir', 'obtener', 'No se pudo abrir'],
  ] as const)('%s informa del error', (accion, metodo, _mensaje) => {
    const componente = crear();
    reportes[metodo].mockReturnValue(fallo(503));
    if (accion === 'generar') componente.generar(); else componente.abrir('r1');
    expect(componente.error()).toContain('servidor devolvió un error');
    expect(componente.isGenerando()).toBe(false);
  });

  it('abre, descarga y cierra el reporte en pantalla', () => {
    const componente = crear();
    boton('Abrir').click();
    fixture.detectChanges();
    expect(componente.actual()).toEqual(GENERADO);

    boton('Descargar CSV').click();
    expect(reportes['descargarCsv']).toHaveBeenCalledWith('r1');
    expect(componente.descargandoId()).toBeNull();

    boton('Cerrar').click();
    expect(componente.actual()).toBeNull();
  });

  it('muestra el progreso de la descarga y su error', () => {
    const componente = crear();
    const pendiente = new Subject();
    reportes['descargarCsv'].mockReturnValue(pendiente);
    componente.descargar('r1');
    fixture.detectChanges();
    expect(boton('Descargar CSV').disabled).toBe(true);
    pendiente.error(new HttpErrorResponse({ status: 404, error: { message: 'El reporte no existe' } }));
    expect(componente.error()).toBe('El reporte no existe');
    expect(componente.descargandoId()).toBeNull();
  });

  it('elimina de la lista y cierra el reporte si estaba abierto', () => {
    const componente = crear();
    componente.abrir('r1');
    boton('Eliminar').click();
    expect(componente.guardados()).toEqual([]);
    expect(componente.actual()).toBeNull();
    expect(componente.eliminandoId()).toBeNull();
  });

  it('eliminar otro reporte no cierra el abierto; un fallo se informa', () => {
    const componente = crear();
    componente.abrir('r1');
    componente.eliminar('otro');
    expect(componente.actual()).not.toBeNull();

    reportes['eliminar'].mockReturnValue(fallo(500));
    componente.eliminar('r1');
    expect(componente.error()).toContain('servidor');
    expect(componente.guardados()).toHaveLength(1);
  });
});
