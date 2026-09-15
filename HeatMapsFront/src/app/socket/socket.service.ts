/**
 * @file socket.service.ts
 * @description Servicio singleton que gestiona la conexión WebSocket con el
 * backend mediante Socket.IO, y propaga los eventos de sensores como
 * Observables RxJS para su consumo reactivo en los componentes.
 *
 * ## Arquitectura de la conexión
 * ```
 * Broker Kafka → Backend (KafkaConsumerService)
 *                       ↓ io.emit('sensor-data', { data: cifrado })
 *             Socket.IO server (misma URL que la API, path /socket.io/)
 *                       ↓ WebSocket
 *             SocketService (este archivo)
 *                       ↓ sensorData$ Observable
 *             PublicSection component (contador en vivo)
 * ```
 *
 * ## Singleton y reconexión
 * Al ser `providedIn: 'root'`, existe una única instancia durante toda la
 * vida de la aplicación. Socket.IO gestiona la reconexión automáticamente
 * con hasta 5 intentos espaciados 2 segundos entre sí.
 *
 * ## Todo llega cifrado
 * Cada evento viaja como `{ data: "<base64>" }` con AES-256-GCM, el mismo
 * sobre y la misma clave que las respuestas de la API REST, y se descifra aquí
 * antes de publicarse en el flujo. Los componentes reciben ya el objeto en
 * claro y no saben que hubo cifrado de por medio.
 *
 * ## Canal abierto: solo viajan agregados
 * El canal no exige autenticación: cualquiera que abra una conexión recibe lo
 * que se emita, y la clave de descifrado viaja en el propio bundle del
 * navegador. El cifrado da integridad y uniformidad con el resto de la API, no
 * confidencialidad frente a un tercero decidido; de eso responde el TLS del
 * transporte (HTTPS/WSS). Por eso el servidor difunde únicamente el conteo por
 * nodo y nunca el detalle de los dispositivos: la garantía de privacidad está
 * en no publicar el dato, no en cifrarlo.
 *
 * @see {@link PublicSection} — componente que consume `sensorData$`.
 * @see {@link ResumenSensor} — interfaz del payload del evento `sensor-data`.
 */

import { Injectable, InjectionToken, OnDestroy, inject } from '@angular/core';
import { Subject, BehaviorSubject, Observable, noop } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { ResumenSensor } from './sensor-data.model';
import { apiUrl } from '../core/config';
import { CryptoService } from '../core/crypto/crypto.service';

/** Sobre en el que viaja todo evento del servidor. */
interface SobreCifrado {
  /** Carga cifrada en Base64, con el layout `iv | authTag | ciphertext`. */
  data: string;
}

/**
 * URL del servidor Socket.IO.
 * Se deriva de `apiUrl` quitando el sufijo `/api` ya que el socket
 * se conecta a la raíz del servidor, no al prefijo de la API REST.
 *
 * @example
 * apiUrl   = "https://backend.com/api"
 * SOCKET_URL = "https://backend.com"
 */
const SOCKET_URL = apiUrl.replace(/\/api$/, '');

/**
 * Fábrica del cliente Socket.IO.
 *
 * Es un token y no una llamada directa a `io` para que las pruebas sustituyan
 * la conexión por un doble sin abrir un WebSocket de verdad.
 */
export const CREAR_SOCKET = new InjectionToken<typeof io>('CREAR_SOCKET', {
  providedIn: 'root',
  factory: () => io,
});

/**
 * Servicio singleton que encapsula el cliente Socket.IO y expone los eventos
 * del servidor como Observables RxJS.
 *
 * La conexión se inicia al instanciarse el servicio (primer inject) y se
 * mantiene activa hasta que Angular destruye la aplicación (`ngOnDestroy`).
 * Los componentes solo necesitan suscribirse a `sensorData$` y `connected$`.
 */
@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  /**
   * Descifra los eventos entrantes. Es el mismo servicio que usa el
   * interceptor con las respuestas HTTP: un solo lugar donde vive la clave y
   * un solo formato de sobre para los dos canales.
   */
  private readonly crypto = inject(CryptoService);

  /**
   * Instancia del cliente Socket.IO.
   * Configurado con transporte WebSocket exclusivo (sin fallback a polling)
   * y reconexión automática limitada a 5 intentos.
   */
  private readonly socket: Socket;

  /**
   * Subject interno para el flujo de datos de sensores.
   * Completado en `ngOnDestroy` para limpiar todas las suscripciones derivadas.
   */
  private readonly sensorDataSubject = new Subject<ResumenSensor>();

  /**
   * Subject interno del estado de conexión.
   * `BehaviorSubject` para que los nuevos suscriptores reciban el estado actual
   * inmediatamente sin esperar el próximo evento.
   */
  private readonly connectedSubject = new BehaviorSubject<boolean>(false);

  /**
   * Observable público que emite cada {@link ResumenSensor} recibida del servidor.
   *
   * Cada emisión corresponde a un mensaje del evento `sensor-data` de Socket.IO,
   * que a su vez proviene de una lectura procesada del broker Kafka.
   *
   * Los suscriptores reciben el dato tan pronto como llega, sin buffer ni debounce.
   */
  readonly sensorData$: Observable<ResumenSensor> = this.sensorDataSubject.asObservable();

  /**
   * Observable público del estado de la conexión WebSocket.
   *
   * - Emite `true` cuando el socket se conecta o reconecta.
   * - Emite `false` cuando se desconecta o falla la conexión.
   *
   * Gracias a `BehaviorSubject`, los suscriptores tardíos reciben el último
   * estado conocido en el momento de suscribirse.
   */
  readonly connected$: Observable<boolean> = this.connectedSubject.asObservable();

  /**
   * Abre la conexión y registra los manejadores.
   *
   * El de `sensor-data` es síncrono y el descifrado no lo es, así que la
   * promesa queda suelta. Se le engancha un `catch` en lugar de descartarla
   * con `void`: hoy no puede rechazar porque atrapa sus propios errores, pero
   * si algún día dejara de hacerlo, la escucha seguiría viva en vez de morir
   * con un rechazo sin atender.
   */
  constructor() {
    this.socket = inject(CREAR_SOCKET)(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect',       () => { this.connectedSubject.next(true);  });
    this.socket.on('disconnect',    () => { this.connectedSubject.next(false); });
    this.socket.on('connect_error', () => { this.connectedSubject.next(false); });

    this.socket.on('sensor-data', (sobre: SobreCifrado) => {
      this.recibirResumen(sobre).catch(noop);
    });
  }

  /**
   * Descifra un evento y lo publica en el flujo.
   *
   * El descifrado es asíncrono porque la Web Crypto API lo es, así que no puede
   * hacerse dentro del manejador del socket. Un sobre que no se pueda descifrar
   * se descarta en silencio: significa que el mensaje no lo emitió este backend
   * o que las claves no coinciden, y en ninguno de los dos casos hay nada que
   * mostrar al visitante. Cortar el flujo por un mensaje corrupto dejaría la
   * pantalla congelada en lugar de saltarse una lectura.
   */
  private async recibirResumen(sobre: SobreCifrado): Promise<void> {
    if (!sobre || typeof sobre.data !== 'string') return;

    try {
      const resumen = await this.crypto.decrypt<ResumenSensor>(sobre.data);
      this.sensorDataSubject.next(resumen);
    } catch {
      // Sobre ajeno o con otra clave: se descarta sin cortar el flujo (ver arriba).
    }
  }

  /**
   * Destruye la conexión Socket.IO y completa todos los Observables públicos.
   *
   * Angular llama a este método cuando la aplicación se destruye (cierre de tab,
   * hot-reload en desarrollo, etc.). Completar los subjects garantiza que todas
   * las suscripciones derivadas se cierren limpiamente sin llamadas a `unsubscribe`.
   */
  ngOnDestroy(): void {
    this.socket.disconnect();
    this.sensorDataSubject.complete();
    this.connectedSubject.complete();
  }
}
