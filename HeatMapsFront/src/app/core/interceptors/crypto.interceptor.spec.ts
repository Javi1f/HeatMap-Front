import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { CryptoService } from '../crypto/crypto.service';
import { cryptoInterceptor } from './crypto.interceptor';

/**
 * Espera a que la petición salga: el cifrado es asíncrono y la primera vez
 * además importa la clave, así que no basta con ceder un turno.
 */
const pendiente = async (backend: HttpTestingController, url: string): Promise<TestRequest> => {
  // Sondeo en serie: cada vuelta espera a la anterior antes de volver a mirar.
  for (let i = 0; i < 100; i++) {
    const [peticion] = backend.match(url);
    if (peticion) return peticion;
    await new Promise((resolver) => { // skipcq: JS-0032
      setTimeout(resolver, 5);
    });
  }
  return backend.expectOne(url);
};

describe('cryptoInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let crypto: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([cryptoInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    crypto = TestBed.inject(CryptoService);
  });

  afterEach(() => backend.verify());

  it('cifra el cuerpo de la petición y descifra la respuesta', async () => {
    const respuesta = firstValueFrom(http.post<{ ok: boolean }>('/api/x', { secreto: 'valor' }));
    const peticion = await pendiente(backend, '/api/x');
    const cuerpo = peticion.request.body as { data: string };
    expect(Object.keys(cuerpo)).toEqual(['data']);
    expect(JSON.stringify(cuerpo)).not.toContain('valor');
    expect(await crypto.decrypt(cuerpo.data)).toEqual({ secreto: 'valor' });

    peticion.flush({ data: await crypto.encrypt({ ok: true }) });
    expect(await respuesta).toEqual({ ok: true });
  });

  it('no toca peticiones sin cuerpo ni respuestas sin sobre cifrado', async () => {
    const respuesta = firstValueFrom(http.get('/ping'));
    const peticion = await pendiente(backend, '/ping');
    expect(peticion.request.body).toBeNull();
    peticion.flush({ message: 'pong' });
    expect(await respuesta).toEqual({ message: 'pong' });
  });

  it('descifra el cuerpo de un error conservando el estado', async () => {
    const respuesta = firstValueFrom(http.get('/api/y'));
    const peticion = await pendiente(backend, '/api/y');
    peticion.flush({ data: await crypto.encrypt({ message: 'Rol requerido', code: 'FORBIDDEN' }) }, { status: 403, statusText: 'Forbidden' });

    const error = (await respuesta.catch((fallo) => fallo)) as HttpErrorResponse;
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error.status).toBe(403);
    expect(error.error).toEqual({ message: 'Rol requerido', code: 'FORBIDDEN' });
  });

  it('relanza intacto un error sin sobre cifrado', async () => {
    const respuesta = firstValueFrom(http.get('/api/z'));
    const peticion = await pendiente(backend, '/api/z');
    peticion.flush({ message: 'en claro' }, { status: 400, statusText: 'Bad Request' });

    const error = (await respuesta.catch((fallo) => fallo)) as HttpErrorResponse;
    expect(error.status).toBe(400);
    expect(error.error).toEqual({ message: 'en claro' });
  });
});
