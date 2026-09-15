/**
 * @file public-section.ts
 * @description Ocupación en tiempo real, abierta a cualquiera (`/public`).
 *
 * ## Qué muestra
 * El plano del espacio con sus nodos situados y el calor de la ocupación. Nada
 * más: ni direcciones MAC, ni identificadores de dispositivo, ni medidas por
 * dispositivo. Antes esta pantalla listaba cada dispositivo detectado con su
 * MAC, lo que permitía a cualquier visitante seguir a una persona por el
 * espacio; ahora el backend ni siquiera envía ese dato.
 *
 * ## Dos fuentes, dos ritmos
 * El mapa se pide por HTTP y se refresca cada {@link REFRESCO_MS}, porque
 * situar dispositivos exige consultar la base. El contador de la cabecera llega
 * por WebSocket en cuanto un nodo emite, y da la sensación de inmediatez que el
 * sondeo no puede dar.
 */

import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { describeHttpError } from '../../core/http-error';
import { MapaPublico, PublicoService, ZonaPublica } from '../../core/services/publico.service';
import { MapaLienzoComponent } from '../../shared/components/mapa-lienzo/mapa-lienzo';
import { CabeceraVivoComponent } from './cabecera-vivo/cabecera-vivo';
import { SelectorZonasComponent } from './selector-zonas/selector-zonas';
import { CabeceraLugarComponent } from './cabecera-lugar/cabecera-lugar';
import { AvisoMapaComponent, AvisoMapa } from './aviso-mapa/aviso-mapa';
import { SocketService } from '../../socket/socket.service';
import { crearLimitador } from '../../core/limitar-frecuencia';

/** Periodo de refresco del mapa, en milisegundos. */
const REFRESCO_MS = 30_000;

/** Intervalo mínimo entre recargas provocadas por lecturas en vivo, en milisegundos. */
const RECARGA_EN_VIVO_MS = 2_000;

/** Aviso por fallo de carga, o `null` si la carga fue bien. */
const avisoDeError = (error: string): AvisoMapa | null =>
  error
    ? { clase: 'aviso-error', icono: 'error_outline', texto: error, reintentable: true }
    : null;

/**
 * Aviso sobre lo que el mapa trae, o `null` si ya muestra manchas.
 *
 * Situar un dispositivo exige que al menos dos nodos lo vean a la vez: con uno
 * solo emitiendo los hay, pero no se sabe dónde, que no es lo mismo que no
 * haber nadie. Un backend anterior a `sinPosicion` no envía el campo y se
 * trata como cero, de modo que cae en el aviso genérico en lugar de anunciar
 * «undefined dispositivos».
 */
const avisoDelMapa = (mapa: MapaPublico | null): AvisoMapa | null => {
  if (!mapa || mapa.situados > 0) return null;

  const sinUbicar = mapa.sinPosicion ?? 0;
  if (sinUbicar === 0) {
    return {
      clase: 'aviso-neutro',
      icono: 'sensors_off',
      texto: `Sin detecciones en los últimos ${mapa.ventanaMinutos} minutos.`,
      reintentable: false,
    };
  }

  return {
    clase: 'aviso-neutro',
    icono: 'location_searching',
    texto: `Se están detectando ${sinUbicar} dispositivos, pero hace falta más de un`
         + ' nodo activo para situarlos en el plano.',
    reintentable: false,
  };
};

/** Vista pública: mapa de calor por espacio, sin autenticación y actualizado en vivo. */
@Component({
  selector: 'app-public-section',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MapaLienzoComponent,
    CabeceraVivoComponent,
    SelectorZonasComponent,
    CabeceraLugarComponent,
    AvisoMapaComponent,
  ],
  templateUrl: './public-section.html',
  styleUrl: './public-section.css'
})
export class PublicSection implements OnInit, OnDestroy {
  /** Origen de las zonas y del mapa. */
  private publicoService = inject(PublicoService);

  /** Flujo en vivo del conteo por nodo. */
  private readonly socketService = inject(SocketService);

  /** Suscripciones al socket, que se cierran al salir. */
  private suscripciones = new Subscription();

  /** Temporizador del refresco del mapa. */
  private temporizador: ReturnType<typeof setInterval> | null = null;

  /** Espacios consultables. */
  zonas = signal<ZonaPublica[]>([]);

  /** Zona seleccionada. */
  zonaSeleccionada = signal<string>('');

  /** Mapa recibido, o `null` mientras no llegue. */
  mapa = signal<MapaPublico | null>(null);

  /** `true` durante la primera carga. */
  cargando = signal<boolean>(true);

  /** Mensaje de error, vacío si no hay ninguno. */
  error = signal<string>('');

  /** `true` mientras el WebSocket está conectado. */
  enVivo = signal<boolean>(false);

  /** `true` en cuanto llega por el socket la primera lectura de un nodo. */
  private recibiendoLecturas = signal<boolean>(false);

  /**
   * Recarga el mapa como mucho cada {@link RECARGA_EN_VIVO_MS} al llegar
   * lecturas, para reflejar los cambios en menos de 5 s sin pedir el mapa en
   * cada mensaje de cada nodo.
   */
  private recargarEnVivo = crearLimitador(RECARGA_EN_VIVO_MS);

  /** Zona seleccionada, resuelta a su objeto. */
  zonaActual = computed(() =>
    this.zonas().find((zona) => zona.idZona === this.zonaSeleccionada()) ?? null,
  );

  /**
   * `true` sólo si están llegando lecturas ahora mismo.
   *
   * No basta con que el WebSocket esté conectado: se conecta al abrir la
   * página, antes de que ningún nodo haya emitido.
   */
  enDirecto = computed(() => this.enVivo() && this.recibiendoLecturas());

  /**
   * Cifra que encabeza la página: los dispositivos presentes en el espacio.
   *
   * Sale siempre del mapa, que ya descarta los puntos de acceso y lo que llega
   * de otros pisos, y no del total que emite cada nodo por el socket. Ese total
   * lo cuenta todo, y además sumarlo entre nodos contaba tres veces a quien
   * oyen los tres: la cabecera anunciaba cientos de dispositivos sobre un mapa
   * casi vacío.
   *
   * Incluye a los presentes que no se pudieron situar, porque también están.
   */
  conteoVisible = computed<number | null>(() => {
    const mapa = this.mapa();
    return mapa ? mapa.situados + (mapa.sinPosicion ?? 0) : null;
  });

  /**
   * Aviso a mostrar bajo el plano, o `null` si no hay nada que advertir.
   *
   * Un fallo de carga manda sobre cualquier otra cosa; si no lo hay, el aviso
   * depende de lo que traiga el mapa.
   */
  aviso = computed<AvisoMapa | null>(() => avisoDeError(this.error()) ?? avisoDelMapa(this.mapa()));

  /**
   * Arranca la carga inicial, el refresco periódico y la escucha del socket.
   *
   * El sondeo convive con el socket porque cubren cosas distintas: el socket
   * sólo indica que los nodos están emitiendo, mientras que quién está presente
   * lo decide el backend al recalcular el mapa, y sólo llega al pedirlo.
   */
  ngOnInit(): void {
    this.cargarZonas();
    this.temporizador = setInterval(() => this.cargarMapa(true), REFRESCO_MS);

    this.suscripciones.add(
      this.socketService.connected$.subscribe((conectado) => this.enVivo.set(conectado)),
    );
    this.suscripciones.add(
      this.socketService.sensorData$.subscribe(() => {
        this.recibiendoLecturas.set(true);
        this.recargarEnVivo(() => this.cargarMapa(true));
      }),
    );
  }

  /**
   * Detiene el refresco y cancela las suscripciones.
   *
   * Sin esto el temporizador seguiría pidiendo el mapa después de salir de la
   * página, y cada visita dejaría una suscripción más viva.
   */
  ngOnDestroy(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
    this.suscripciones.unsubscribe();
  }

  /** Carga los espacios y selecciona el primero. */
  private cargarZonas(): void {
    this.publicoService.zonas().subscribe({
      next: (res) => {
        this.zonas.set(res.data);
        if (res.data.length > 0) {
          this.zonaSeleccionada.set(res.data[0].idZona);
          this.cargarMapa();
        } else {
          this.cargando.set(false);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudo cargar la información de los espacios.'));
        this.cargando.set(false);
      },
    });
  }

  /**
   * Pide el mapa del espacio seleccionado.
   *
   * @param silencioso - `true` en los refrescos, para no parpadear.
   */
  cargarMapa(silencioso = false): void {
    const zona = this.zonaSeleccionada();
    if (!zona) return;

    if (!silencioso) {
      this.cargando.set(true);
      this.error.set('');
    }

    this.publicoService.mapa(zona).subscribe({
      next: (res) => {
        this.mapa.set(res.data);
        this.cargando.set(false);
        this.error.set('');
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudo cargar el mapa de ocupación.'));
        this.cargando.set(false);
      },
    });
  }

  /** Cambia de espacio y recarga. */
  alCambiarZona(idZona: string): void {
    this.zonaSeleccionada.set(idZona);
    this.mapa.set(null);
    this.cargarMapa();
  }
}
