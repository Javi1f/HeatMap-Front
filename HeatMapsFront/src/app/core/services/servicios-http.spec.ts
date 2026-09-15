import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { noop } from 'rxjs';
import { apiUrl } from '../config';
import { AllowedEmailsService } from './allowed-emails.service';
import { MetricsService } from './metrics.service';
import { PublicoService } from './publico.service';
import { ReportesService } from './reportes.service';
import { UsersService } from './users.service';

/**
 * Cada servicio HTTP es una lista de rutas: aquí se fija qué método y qué URL
 * usa cada operación, que es el contrato con el backend.
 */
describe('Servicios HTTP', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Suscribe, comprueba método, URL y cuerpo, y responde. */
  const comprobar = (llamada: () => { subscribe: (o?: object) => unknown }, metodo: string, ruta: string, cuerpo?: unknown) => {
    llamada().subscribe();
    const peticion = backend.expectOne(`${apiUrl}${ruta}`);
    expect(peticion.request.method).toBe(metodo);
    if (cuerpo !== undefined) expect(peticion.request.body).toEqual(cuerpo);
    peticion.flush({ success: true, data: [] });
  };

  it('AllowedEmailsService', () => {
    const servicio = TestBed.inject(AllowedEmailsService);
    comprobar(() => servicio.getAll(), 'GET', '/allowed-emails');
    comprobar(() => servicio.add('a@b.co'), 'POST', '/allowed-emails', { email: 'a@b.co' });
    comprobar(() => servicio.delete(4), 'DELETE', '/allowed-emails/4');
  });

  it('MetricsService', () => {
    const servicio = TestBed.inject(MetricsService);
    comprobar(() => servicio.overview(), 'GET', '/metrics/overview');
    comprobar(() => servicio.zones(), 'GET', '/metrics/zones');
    comprobar(() => servicio.occupancy(), 'GET', '/metrics/occupancy?hours=6');
    comprobar(() => servicio.occupancy(12, 'zona 1/a'), 'GET', '/metrics/occupancy?hours=12&zoneId=zona%201%2Fa');
    comprobar(() => servicio.sensors(), 'GET', '/metrics/sensors');
    comprobar(() => servicio.alerts(), 'GET', '/metrics/alerts');
    comprobar(() => servicio.resolveAlert('a1'), 'POST', '/metrics/alerts/a1/resolve', {});
    comprobar(() => servicio.parameters(), 'GET', '/metrics/parameters');
  });

  it('PublicoService', () => {
    const servicio = TestBed.inject(PublicoService);
    comprobar(() => servicio.zonas(), 'GET', '/publico/zonas');
    comprobar(() => servicio.mapa('z&1'), 'GET', '/publico/mapa?zonaId=z%261&minutos=5');
    comprobar(() => servicio.mapa('z', 15), 'GET', '/publico/mapa?zonaId=z&minutos=15');
  });

  it('UsersService', () => {
    const servicio = TestBed.inject(UsersService);
    comprobar(() => servicio.listAdmins(), 'GET', '/users/admins');
    comprobar(() => servicio.listSessions(), 'GET', '/users/sessions');
    comprobar(() => servicio.revokeSession('s1'), 'DELETE', '/users/sessions/s1');
    comprobar(() => servicio.cambiarRol(2, 'root'), 'PATCH', '/users/admins/2/rol', { rol: 'root' });
    comprobar(() => servicio.cambiarActivo(2, false), 'PATCH', '/users/admins/2/activo', { activo: false });
    comprobar(() => servicio.listarAuditoria(), 'GET', '/users/auditoria?limite=50');
    comprobar(() => servicio.listarAuditoria(10), 'GET', '/users/auditoria?limite=10');
  });

  it('ReportesService', () => {
    const servicio = TestBed.inject(ReportesService);
    const cuerpo = { tipoReporte: 'alertas' as const, rangoInicio: 'a', rangoFin: 'b' };
    comprobar(() => servicio.crear(cuerpo), 'POST', '/reportes', cuerpo);
    comprobar(() => servicio.listar(), 'GET', '/reportes');
    comprobar(() => servicio.obtener('r1'), 'GET', '/reportes/r1');
    comprobar(() => servicio.eliminar('r1'), 'DELETE', '/reportes/r1');
  });

  it('ReportesService descarga el CSV construyendo un enlace temporal', () => {
    const servicio = TestBed.inject(ReportesService);
    const crearUrl = vi.fn(() => 'blob:csv');
    const revocar = vi.fn();
    Object.assign(URL, { createObjectURL: crearUrl, revokeObjectURL: revocar });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(noop);

    servicio.descargarCsv('r1').subscribe();
    backend.expectOne(`${apiUrl}/reportes/r1/csv`).flush({ success: true, data: { nombreArchivo: 'alertas.csv', contenido: '"a"' } });

    expect(crearUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(clic).toHaveBeenCalledOnce();
    const enlace = clic.mock.contexts[0] as HTMLAnchorElement;
    expect(enlace.download).toBe('alertas.csv');
    expect(document.body.contains(enlace)).toBe(false);
    expect(revocar).toHaveBeenCalledWith('blob:csv');
    clic.mockRestore();
  });
});
