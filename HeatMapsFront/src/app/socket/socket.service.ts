/**
 * @file socket.service.ts
 * @description Servicio singleton que gestiona la conexión WebSocket con el
 * backend mediante Socket.IO, y propaga los eventos de sensores como
 * Observables RxJS para su consumo reactivo en los componentes.
 *
 * ## Arquitectura de la conexión
 * ```
 * Broker Kafka → Backend (KafkaConsumerService)
 *                       ↓ io.emit('sensor-data', data)
 *             Socket.IO server (misma URL que la API, path /socket.io/)
 *                       ↓ WebSocket
 *             SocketService (este archivo)
 *                       ↓ sensorData$ Observable
 *             PublicSection component (tabla en tiempo real)
 * ```
 *
 * ## Singleton y reconexión
 * Al ser `providedIn: 'root'`, existe una única instancia durante toda la
 * vida de la aplicación. Socket.IO gestiona la reconexión automáticamente
 * con hasta 5 intentos espaciados 2 segundos entre sí.
 *
 * ## Sin cifrado a nivel aplicación
 * A diferencia de los endpoints REST, el canal Socket.IO no usa cifrado AES
 * adicional. La seguridad depende únicamente del TLS del transporte (HTTPS/WSS).
 *
 * @see {@link PublicSection} — componente que consume `sensorData$`.
 * @see {@link SensorData} — interfaz del payload del evento `sensor-data`.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { SensorData } from './sensor-data.model';
import { apiUrl } from '../core/config';

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
   * Instancia del cliente Socket.IO.
   * Configurado con transporte WebSocket exclusivo (sin fallback a polling)
   * y reconexión automática limitada a 5 intentos.
   */
  private readonly socket: Socket;

  /**
   * Subject interno para el flujo de datos de sensores.
   * Completado en `ngOnDestroy` para limpiar todas las suscripciones derivadas.
   */
  private readonly sensorDataSubject = new Subject<SensorData>();

  /**
   * Subject interno del estado de conexión.
   * `BehaviorSubject` para que los nuevos suscriptores reciban el estado actual
   * inmediatamente sin esperar el próximo evento.
   */
  private readonly connectedSubject = new BehaviorSubject<boolean>(false);

  /**
   * Observable público que emite cada {@link SensorData} recibida del servidor.
   *
   * Cada emisión corresponde a un mensaje del evento `sensor-data` de Socket.IO,
   * que a su vez proviene de una lectura procesada del broker Kafka.
   *
   * Los suscriptores reciben el dato tan pronto como llega, sin buffer ni debounce.
   */
  readonly sensorData$: Observable<SensorData> = this.sensorDataSubject.asObservable();

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

  constructor() {
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],    // Solo WebSocket; sin fallback a long-polling
      reconnectionAttempts: 5,      // Reintentos máximos antes de darse por vencido
      reconnectionDelay: 2000,      // Espera inicial entre reintentos (ms)
    });

    // Eventos del ciclo de vida de la conexión
    this.socket.on('connect',       () => { this.connectedSubject.next(true);  });
    this.socket.on('disconnect',    () => { this.connectedSubject.next(false); });
    this.socket.on('connect_error', () => { this.connectedSubject.next(false); });

    // Evento de dominio: nueva lectura de sensor procesada por el backend
    this.socket.on('sensor-data', (data: SensorData) => {
      this.sensorDataSubject.next(data);
    });
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
