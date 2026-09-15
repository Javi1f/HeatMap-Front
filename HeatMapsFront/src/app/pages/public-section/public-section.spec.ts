import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { MapaPublico, PublicoService, ZonaPublica } from '../../core/services/publico.service';
import { SocketService } from '../../socket/socket.service';
import { PublicSection } from './public-section';
import { AvisoMapaComponent } from './aviso-mapa/aviso-mapa';
import { CabeceraLugarComponent } from './cabecera-lugar/cabecera-lugar';
import { CabeceraVivoComponent } from './cabecera-vivo/cabecera-vivo';
import { SelectorZonasComponent } from './selector-zonas/selector-zonas';

const ZONAS: ZonaPublica[] = [
  { idZona: 'z1', nombre: 'Plazoleta', descripcion: 'Tercer piso', nivelOcupacion: 'media' },
  { idZona: 'z2', nombre: 'Biblioteca', descripcion: null, nivelOcupacion: 'sin datos' },
];

/** Mapa público con dos dispositivos situados y uno sin situar. */
const mapa = (campos: Partial<MapaPublico> = {}): MapaPublico => ({
  nombre: 'Plazoleta', ancho: 11.84, alto: 21, ladoCelda: 0.5, columnas: 24, filas: 42, rejilla: [[1]],
  maximo: 1, situados: 2, sinPosicion: 1, nodos: [], ventanaMinutos: 5, hasta: '2026-09-14T12:00:00Z', ...campos,
});

describe('PublicSection', () => {
  let fixture: ComponentFixture<PublicSection>;
  let publico: { zonas: ReturnType<typeof vi.fn>; mapa: ReturnType<typeof vi.fn> };
  let conectado: BehaviorSubject<boolean>;
  let lecturas: Subject<unknown>;

  /** Crea la vista pública y ejecuta la primera detección de cambios. */
  const crear = () => {
    fixture = TestBed.createComponent(PublicSection);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  /** Texto visible del componente. */
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    publico = { zonas: vi.fn(() => of({ success: true, data: ZONAS })), mapa: vi.fn(() => of({ success: true, data: mapa() })) };
    conectado = new BehaviorSubject(false);
    lecturas = new Subject();
    TestBed.configureTestingModule({
      imports: [PublicSection],
      providers: [
        { provide: PublicoService, useValue: publico },
        { provide: SocketService, useValue: { connected$: conectado, sensorData$: lecturas } },
      ],
    });
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('carga las zonas, selecciona la primera y muestra su mapa', () => {
    const componente = crear();
    expect(publico.mapa).toHaveBeenCalledWith('z1');
    expect(componente.zonaActual()?.nombre).toBe('Plazoleta');
    expect(componente.conteoVisible()).toBe(3);
    expect(texto()).toContain('Plazoleta');
    expect(texto()).toContain('3 dispositivos en los últimos 5 min');
    expect(texto()).toContain('no personas');
  });

  it('sin espacios lo dice en lugar de mostrar un mapa vacío', () => {
    publico.zonas.mockReturnValue(of({ success: true, data: [] }));
    const componente = crear();
    expect(componente.cargando()).toBe(false);
    expect(publico.mapa).not.toHaveBeenCalled();
    expect(texto()).toContain('Todavía no hay espacios disponibles');
  });

  it('un fallo al cargar zonas se explica', () => {
    publico.zonas.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const componente = crear();
    expect(componente.error()).toContain('No hay conexión');
    expect(componente.cargando()).toBe(false);
  });

  it('un fallo del mapa se ofrece para reintentar', () => {
    publico.mapa.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const componente = crear();
    expect(componente.aviso()).toMatchObject({ clase: 'aviso-error', reintentable: true });

    publico.mapa.mockReturnValue(of({ success: true, data: mapa() }));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.reintentar') as HTMLButtonElement).click();
    expect(componente.error()).toBe('');
    expect(componente.aviso()).toBeNull();
  });

  it('distingue «sin detecciones» de «detectados pero sin situar»', () => {
    publico.mapa.mockReturnValue(of({ success: true, data: mapa({ situados: 0, sinPosicion: 0 }) }));
    const componente = crear();
    expect(componente.aviso()?.texto).toBe('Sin detecciones en los últimos 5 minutos.');

    publico.mapa.mockReturnValue(of({ success: true, data: mapa({ situados: 0, sinPosicion: 4 }) }));
    componente.cargarMapa();
    expect(componente.aviso()?.texto).toContain('Se están detectando 4 dispositivos');

    publico.mapa.mockReturnValue(of({ success: true, data: mapa({ situados: 0, sinPosicion: undefined }) }));
    componente.cargarMapa();
    expect(componente.conteoVisible()).toBe(0);
  });

  it('al cambiar de zona vacía el mapa y pide el nuevo', () => {
    const componente = crear();
    publico.mapa.mockReturnValue(new Subject());
    (fixture.nativeElement.querySelectorAll('.pastilla')[1] as HTMLButtonElement).click();
    expect(componente.zonaSeleccionada()).toBe('z2');
    expect(componente.mapa()).toBeNull();
    expect(publico.mapa).toHaveBeenLastCalledWith('z2');
  });

  it('refresca cada 30 s sin mostrar el indicador de carga', () => {
    const componente = crear();
    publico.mapa.mockClear();
    vi.advanceTimersByTime(30_000);
    expect(publico.mapa).toHaveBeenCalledTimes(1);
    expect(componente.cargando()).toBe(false);
  });

  it('en directo recarga con las lecturas, como mucho cada 2 s', () => {
    const componente = crear();
    conectado.next(true);
    expect(componente.enDirecto()).toBe(false);
    publico.mapa.mockClear();

    lecturas.next({});
    lecturas.next({});
    expect(componente.enDirecto()).toBe(true);
    expect(publico.mapa).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    lecturas.next({});
    expect(publico.mapa).toHaveBeenCalledTimes(2);
    fixture.detectChanges();
    expect(texto()).toContain('3 dispositivos ahora');
  });

  it('cargarMapa sin zona no hace nada y al destruirse deja de refrescar', () => {
    publico.zonas.mockReturnValue(of({ success: true, data: [] }));
    const componente = crear();
    componente.cargarMapa();
    expect(publico.mapa).not.toHaveBeenCalled();

    fixture.destroy();
    vi.advanceTimersByTime(60_000);
    lecturas.next({});
    expect(publico.mapa).not.toHaveBeenCalled();
  });
});

describe('Subcomponentes de la vista pública', () => {
  it('CabeceraVivo: sin valor no muestra contador; con valor indica cuándo', () => {
    const vista = TestBed.createComponent(CabeceraVivoComponent);
    vista.detectChanges();
    expect(vista.componentInstance.contador()).toBeNull();

    vista.componentRef.setInput('valor', 4);
    expect(vista.componentInstance.contador()).toEqual({ texto: '4 dispositivos', enDirecto: false });
    vista.componentRef.setInput('ventanaMinutos', 5);
    expect(vista.componentInstance.contador()?.texto).toBe('4 dispositivos en los últimos 5 min');
    vista.componentRef.setInput('enDirecto', true);
    vista.detectChanges();
    expect(vista.nativeElement.textContent).toContain('4 dispositivos ahora');
  });

  it('CabeceraLugar: oculta «sin datos» si hay dispositivos situados', () => {
    const vista = TestBed.createComponent(CabeceraLugarComponent);
    vista.componentRef.setInput('zona', ZONAS[0]);
    vista.detectChanges();
    expect(vista.componentInstance.nivel()).toEqual({ clase: 'nivel-media', etiqueta: 'Bastantes dispositivos' });
    expect(vista.nativeElement.textContent).toContain('Tercer piso');

    vista.componentRef.setInput('zona', ZONAS[1]);
    expect(vista.componentInstance.nivel()).toEqual({ clase: 'nivel-sin-datos', etiqueta: 'Sin datos' });
    vista.componentRef.setInput('situados', 2);
    expect(vista.componentInstance.nivel()).toBeNull();
  });

  it('SelectorZonas: marca la activa y emite la elegida', () => {
    const vista = TestBed.createComponent(SelectorZonasComponent);
    vista.componentRef.setInput('zonas', ZONAS);
    vista.componentRef.setInput('seleccionada', 'z2');
    vista.detectChanges();
    const elegida = vi.fn();
    vista.componentInstance.seleccionar.subscribe(elegida);

    const botones = vista.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    expect(botones[1].getAttribute('aria-pressed')).toBe('true');
    botones[0].click();
    expect(elegida).toHaveBeenCalledWith('z1');
  });

  it('AvisoMapa: sin aviso no pinta nada; sólo los errores ofrecen reintentar', () => {
    const vista = TestBed.createComponent(AvisoMapaComponent);
    vista.detectChanges();
    expect(vista.nativeElement.querySelector('.aviso')).toBeNull();

    vista.componentRef.setInput('aviso', { clase: 'aviso-neutro', icono: 'x', texto: 'Nada', reintentable: false });
    vista.detectChanges();
    expect(vista.nativeElement.querySelector('.reintentar')).toBeNull();

    const reintentar = vi.fn();
    vista.componentInstance.reintentar.subscribe(reintentar);
    vista.componentRef.setInput('aviso', { clase: 'aviso-error', icono: 'x', texto: 'Fallo', reintentable: true });
    vista.detectChanges();
    (vista.nativeElement.querySelector('.reintentar') as HTMLButtonElement).click();
    expect(reintentar).toHaveBeenCalled();
  });
});
