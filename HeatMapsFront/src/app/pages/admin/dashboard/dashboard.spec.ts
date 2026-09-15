import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { MetricsOverview, MetricsService, SensorHealth, ZoneOccupancy } from '../../../core/services/metrics.service';
import { SocketService } from '../../../socket/socket.service';
import { AvisosDashboardComponent } from '../avisos-dashboard/avisos-dashboard';
import { IndicadoresDashboardComponent } from '../indicadores-dashboard/indicadores-dashboard';
import { TablaNodosComponent } from '../tabla-nodos/tabla-nodos';
import { TablaZonasComponent } from '../tabla-zonas/tabla-zonas';
import { Dashboard } from './dashboard';

const RESUMEN: MetricsOverview = {
  dispositivosAhora: 4, detecciones: 120, porcentajeRandomizadas: 50, rssiPromedio: -62.5,
  zonasActivas: 1, sensoresTotal: 3, sensoresEnLinea: 3, alertasAbiertas: 0, ventanaMinutos: 5,
};

const ZONA: ZoneOccupancy = {
  idZona: 'z1', nombre: 'Plazoleta', capacidadMax: 40, dispositivosUnicos: 10, dispositivosEstables: 6,
  rssiPromedio: -60, nivelOcupacion: 'media', porcentajeAforo: 25, actualizadoEn: '2026-09-14T12:05:00',
};

const NODO: SensorHealth = {
  idSensor: 'n1', nombre: 'Nodo 1', zona: 'Plazoleta', estado: 'activo', ultimaConexion: 'x', minutosDesdeUltimaLectura: 0, enLinea: true,
};

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  let metricas: Record<string, ReturnType<typeof vi.fn>>;
  let lecturas: Subject<unknown>;

  /** Crea el dashboard y ejecuta la primera detección de cambios. */
  const crear = () => {
    fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  /** Texto visible del componente. */
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    vi.useFakeTimers();
    metricas = {
      overview: vi.fn(() => of({ success: true, data: RESUMEN })),
      zones: vi.fn(() => of({ success: true, data: [ZONA] })),
      sensors: vi.fn(() => of({ success: true, data: [NODO] })),
      parameters: vi.fn(() => of({ success: true, data: { ventanaAgregacionMinutos: 5, rssiReferencia: -45, exponenteAtenuacion: 2.7 } })),
    };
    lecturas = new Subject();
    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: MetricsService, useValue: metricas },
        { provide: SocketService, useValue: { sensorData$: lecturas } },
      ],
    });
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('carga resumen, zonas, nodos y parámetros y los muestra', () => {
    const componente = crear();
    expect(componente.isLoading()).toBe(false);
    expect(componente.lastUpdated()).toBeInstanceOf(Date);
    expect(componente.ventanaTexto()).toBe('5 min');
    expect(componente.pieParametros()).toContain('RSSI₀ = -45 dBm y n = 2.7');
    expect(texto()).toContain('Dispositivos ahora');
    expect(texto()).toContain('Plazoleta');
    expect(texto()).toContain('Nodo 1');
    expect(texto()).toContain('ventana 5 min');
  });

  it('sin parámetros todavía muestra rayas', () => {
    metricas['parameters'].mockReturnValue(new Subject());
    const componente = crear();
    expect(componente.ventanaTexto()).toBe('—');
    expect(componente.pieParametros()).toBe('');
  });

  it('distingue red sin nodos de red caída', () => {
    metricas['overview'].mockReturnValue(of({ success: true, data: { ...RESUMEN, sensoresTotal: 0, sensoresEnLinea: 0 } }));
    const componente = crear();
    expect(componente.sinNodos()).toBe(true);
    expect(componente.redCaida()).toBe(false);

    metricas['overview'].mockReturnValue(of({ success: true, data: { ...RESUMEN, sensoresEnLinea: 0 } }));
    componente.loadAll();
    expect(componente.redCaida()).toBe(true);
    fixture.detectChanges();
    expect(texto()).toContain('Ningún nodo está emitiendo');
  });

  it('un error se explica y se puede reintentar', () => {
    metricas['overview'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    const componente = crear();
    expect(componente.error()).toContain('Demasiadas peticiones');

    metricas['overview'].mockReturnValue(of({ success: true, data: RESUMEN }));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.retry-btn') as HTMLButtonElement).click();
    expect(componente.error()).toBe('');
  });

  it('pide los parámetros una sola vez', () => {
    const componente = crear();
    componente.loadAll(true);
    expect(metricas['parameters']).toHaveBeenCalledTimes(1);
    expect(metricas['overview']).toHaveBeenCalledTimes(2);
  });

  it('refresca cada minuto y con lecturas en vivo como mucho cada 2 s', () => {
    crear();
    metricas['overview'].mockClear();
    vi.advanceTimersByTime(60_000);
    expect(metricas['overview']).toHaveBeenCalledTimes(1);

    lecturas.next({});
    lecturas.next({});
    expect(metricas['overview']).toHaveBeenCalledTimes(2);
  });

  it('al destruirse deja de refrescar', () => {
    crear();
    fixture.destroy();
    metricas['overview'].mockClear();
    vi.advanceTimersByTime(120_000);
    lecturas.next({});
    expect(metricas['overview']).not.toHaveBeenCalled();
  });
});

describe('Componentes del dashboard', () => {
  it('Indicadores: tonos según aleatorizadas y nodos', () => {
    const vista = TestBed.createComponent(IndicadoresDashboardComponent);
    /** Tarjeta de indicador con esa etiqueta. */
    const tono = (label: string) => {
      const tarjeta = vista.componentInstance.tarjetas().find((candidata) => candidata.label === label);
      if (!tarjeta) throw new Error(`No hay tarjeta «${label}»`);
      return tarjeta;
    };

    vista.componentRef.setInput('resumen', RESUMEN);
    vista.detectChanges();
    expect(tono('Nodos en línea')).toMatchObject({ value: '3 / 3', tone: 'ok' });
    expect(tono('RSSI medio').value).toBe('-62.5 dBm');
    expect(tono('MAC aleatorizadas').tone).toBe('neutral');
    expect(vista.nativeElement.querySelectorAll('app-metric-card')).toHaveLength(5);
    expect(vista.nativeElement.textContent).toContain('No equivale a personas');

    vista.componentRef.setInput('resumen', { ...RESUMEN, porcentajeRandomizadas: 85, rssiPromedio: null, sensoresEnLinea: 1 });
    expect(tono('MAC aleatorizadas').tone).toBe('warn');
    expect(tono('RSSI medio').value).toBe('—');
    expect(tono('Nodos en línea').tone).toBe('warn');

    vista.componentRef.setInput('resumen', { ...RESUMEN, sensoresEnLinea: 0 });
    expect(tono('Nodos en línea').tone).toBe('danger');
    vista.componentRef.setInput('resumen', { ...RESUMEN, sensoresTotal: 0, sensoresEnLinea: 0 });
    expect(tono('Nodos en línea').tone).toBe('neutral');
  });

  it('Avisos: prioriza «sin nodos» sobre «red caída»', () => {
    const vista = TestBed.createComponent(AvisosDashboardComponent);
    vista.detectChanges();
    expect(vista.componentInstance.estadoRed()).toBeNull();
    vista.componentRef.setInput('redCaida', true);
    expect(vista.componentInstance.estadoRed()?.clase).toBe('alert-error');
    vista.componentRef.setInput('sinNodos', true);
    expect(vista.componentInstance.estadoRed()?.clase).toBe('alert-info');
  });

  it('Tabla de nodos: última lectura legible y estado', () => {
    const vista = TestBed.createComponent(TablaNodosComponent);
    vista.componentRef.setInput('nodos', []);
    vista.detectChanges();
    expect(vista.nativeElement.textContent).toContain('No hay nodos registrados');

    vista.componentRef.setInput('nodos', [NODO, { ...NODO, idSensor: 'n2', zona: null, minutosDesdeUltimaLectura: 7, enLinea: false }, { ...NODO, idSensor: 'n3', minutosDesdeUltimaLectura: null, enLinea: false }]);
    vista.detectChanges();
    expect(vista.componentInstance.filas().map((x) => [x.ultimaLectura, x.estado, x.zona])).toEqual([
      ['Hace menos de 1 min', 'En línea', 'Plazoleta'],
      ['Hace 7 min', 'Sin señal', '—'],
      ['Nunca', 'Sin señal', 'Plazoleta'],
    ]);
    expect(vista.nativeElement.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('Tabla de zonas: aforo acotado al 100 % y hora local', () => {
    const vista = TestBed.createComponent(TablaZonasComponent);
    vista.componentRef.setInput('zonas', []);
    vista.detectChanges();
    expect(vista.nativeElement.textContent).toContain('Aún no hay ocupación consolidada');

    vista.componentRef.setInput('zonas', [
      ZONA,
      { ...ZONA, idZona: 'z2', porcentajeAforo: 130, actualizadoEn: 'no-es-fecha' },
      { ...ZONA, idZona: 'z3', capacidadMax: null, porcentajeAforo: null, actualizadoEn: null },
      { ...ZONA, idZona: 'z4', porcentajeAforo: null },
    ]);
    vista.detectChanges();
    const filas = vista.componentInstance.filas();
    expect(filas[0]).toMatchObject({ claseNivel: 'level-media', aforo: { ancho: 25, texto: '25 % de 40' }, actualizado: '12:05' });
    expect(filas[1]).toMatchObject({ aforo: { ancho: 100 }, actualizado: '—' });
    expect(filas[2]).toMatchObject({ aforo: null, actualizado: '—' });
    expect(filas[3].aforo?.ancho).toBe(0);
    expect(vista.nativeElement.textContent).toContain('Sin aforo definido');
  });
});
