import { TestBed } from '@angular/core/testing';
import { CryptoService } from '../core/crypto/crypto.service';
import { CREAR_SOCKET, SocketService } from './socket.service';
import { ResumenSensor } from './sensor-data.model';

describe('SocketService', () => {
  let manejadores: Record<string, (dato?: unknown) => void>;
  let socket: { on: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  let fabrica: ReturnType<typeof vi.fn>;
  let servicio: SocketService;
  let crypto: CryptoService;

  beforeEach(() => {
    manejadores = {};
    socket = { on: vi.fn((evento: string, fn: (dato?: unknown) => void) => { manejadores[evento] = fn; }), disconnect: vi.fn() };
    fabrica = vi.fn(() => socket);
    TestBed.configureTestingModule({ providers: [{ provide: CREAR_SOCKET, useValue: fabrica }] });
    servicio = TestBed.inject(SocketService);
    crypto = TestBed.inject(CryptoService);
  });

  it('se conecta a la raíz del servidor sólo por WebSocket y con reintentos acotados', () => {
    const [url, opciones] = fabrica.mock.calls[0];
    expect(url).not.toMatch(/\/api$/);
    expect(opciones).toEqual({ transports: ['websocket'], reconnectionAttempts: 5, reconnectionDelay: 2000 });
  });

  it('refleja el estado de la conexión', () => {
    const estados: boolean[] = [];
    servicio.connected$.subscribe((estado) => estados.push(estado));
    manejadores['connect']();
    manejadores['disconnect']();
    manejadores['connect']();
    manejadores['connect_error']();
    expect(estados).toEqual([false, true, false, true, false]);
  });

  it('publica el resumen ya descifrado', async () => {
    const resumen: ResumenSensor = { sensor_id: 'nodo-1', total_devices: 3, timestamp: '12:00', received_at: 'x' };
    const recibido = new Promise<ResumenSensor>((resolver) => {
      servicio.sensorData$.subscribe(resolver);
    });

    manejadores['sensor-data']({ data: await crypto.encrypt(resumen) });

    expect(await recibido).toEqual(resumen);
  });

  it('ignora sobres vacíos, mal formados o que no se descifran', async () => {
    const recibido = vi.fn();
    servicio.sensorData$.subscribe(recibido);

    manejadores['sensor-data'](null);
    manejadores['sensor-data']({ data: 42 });
    manejadores['sensor-data']({ data: 'no-es-un-cifrado' });
    await new Promise((resolver) => {
      setTimeout(resolver, 20);
    });

    expect(recibido).not.toHaveBeenCalled();
  });

  it('al destruirse cierra el socket y completa los flujos', () => {
    const completado = vi.fn();
    servicio.sensorData$.subscribe({ complete: completado });
    servicio.ngOnDestroy();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(completado).toHaveBeenCalled();
  });
});
