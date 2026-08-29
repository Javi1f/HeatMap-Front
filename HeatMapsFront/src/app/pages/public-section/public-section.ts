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
import { SocketService } from '../../socket/socket.service';

/** Periodo de refresco del mapa, en milisegundos. */
const REFRESCO_MS = 30_000;

/** Etiquetas de cada nivel de ocupación. */
const ETIQUETA_NIVEL: Record<string, string> = {
  baja: 'Poca gente',
  media: 'Moderado',
  alta: 'Muy concurrido',
  'sin datos': 'Sin datos',
};

@Component({
  selector: 'app-public-section',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaLienzoComponent],
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

  /**
   * Último conteo comunicado por cada nodo.
   *
   * Se guarda por nodo y no como total acumulado porque cada uno emite a su
   * ritmo: sumar lecturas de instantes distintos daría una cifra que nunca
   * existió.
   */
  private conteoPorNodo = signal<Record<string, number>>({});

  /** Dispositivos vistos ahora mismo, sumando la última lectura de cada nodo. */
  enVivoTotal = computed(() =>
    Object.values(this.conteoPorNodo()).reduce((a, b) => a + b, 0),
  );

  /** Zona seleccionada, resuelta a su objeto. */
  zonaActual = computed(() =>
    this.zonas().find((z) => z.idZona === this.zonaSeleccionada()) ?? null,
  );

  /**
   * `true` sólo si están llegando lecturas ahora mismo.
   *
   * No basta con que el WebSocket esté conectado: se conecta al abrir la
   * página, y hasta que un nodo emite el conteo es cero. Anunciar «0
   * dispositivos ahora» sobre un mapa lleno de manchas hacía dudar de las dos
   * cifras a la vez.
   */
  enDirecto = computed(() => this.enVivo() && this.enVivoTotal() > 0);

  /**
   * Cifra que encabeza la página.
   *
   * Prefiere el directo cuando lo hay y, si no, cae en el conteo que el
   * backend ya calculó para dibujar el mapa. Así el número y las manchas
   * salen siempre del mismo hecho.
   */
  conteoVisible = computed<number | null>(() => {
    if (this.enDirecto()) return this.enVivoTotal();
    return this.mapa()?.situados ?? null;
  });

  /** Aclara a qué momento se refiere la cifra de arriba. */
  conteoLeyenda = computed<string>(() => {
    if (this.enDirecto()) return 'ahora';
    const minutos = this.mapa()?.ventanaMinutos;
    return minutos ? `en los últimos ${minutos} min` : '';
  });

  /**
   * `true` si merece la pena mostrar el distintivo de nivel.
   *
   * El nivel sale de las ventanas ya consolidadas y el mapa de las detecciones
   * recientes, así que al arrancar puede haber mapa con manchas y todavía
   * ningún nivel. En ese caso el distintivo decía «Sin datos» al lado de un
   * mapa con datos; se calla y deja hablar a la cifra de la portada.
   */
  mostrarNivel(nivel: string): boolean {
    if (nivel !== 'sin datos') return true;
    return (this.mapa()?.situados ?? 0) === 0;
  }

  ngOnInit(): void {
    this.cargarZonas();
    this.temporizador = setInterval(() => this.cargarMapa(true), REFRESCO_MS);

    this.suscripciones.add(
      this.socketService.connected$.subscribe((c) => this.enVivo.set(c)),
    );
    this.suscripciones.add(
      this.socketService.sensorData$.subscribe((r) =>
        this.conteoPorNodo.update((prev) => ({ ...prev, [r.sensor_id]: r.total_devices })),
      ),
    );
  }

  ngOnDestroy(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
    this.suscripciones.unsubscribe();
  }

  /** Texto legible de un nivel de ocupación. */
  etiquetaNivel(nivel: string): string {
    return ETIQUETA_NIVEL[nivel] ?? nivel;
  }

  /**
   * Clase CSS de un nivel de ocupación.
   *
   * El nivel llega como `sin datos`, con espacio, y un atributo `class` se
   * parte por los espacios: concatenarlo daba dos clases sueltas
   * (`nivel-sin` y `datos`) y ninguna regla llegaba a aplicarse, así que el
   * distintivo salía transparente y con el borde en blanco.
   */
  claseNivel(nivel: string): string {
    return 'nivel-' + nivel.replace(/\s+/g, '-');
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
