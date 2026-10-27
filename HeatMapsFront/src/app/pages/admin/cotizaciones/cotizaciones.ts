/**
 * @file cotizaciones.ts
 * @description Gestión comercial de las solicitudes de cotización
 * (`/admin/cotizaciones`).
 *
 * Es el embudo que la web alimenta: la solicitud llega «nueva», el equipo
 * la revisa, contacta al posible cliente y la cierra (o la descarta). Cada
 * movimiento de estado viaja con notas opcionales y queda en la auditoría.
 *
 * ## Acceso
 * Requiere autenticación de administrador; protegido por `authGuard` en las
 * rutas, igual que los reportes. No exige root: atender solicitudes es el
 * trabajo normal del despacho.
 */

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { describeHttpError } from '../../../core/http-error';
import {
  CotizacionService,
  DocumentoSolicitud,
  ESTADOS_SOLICITUD,
  ETIQUETAS_ESTADO,
  EstadoSolicitud,
  SolicitudDetalle,
  SolicitudResumen,
  descargarJson,
} from '../../../core/services/cotizacion.service';
import { ETIQUETAS_TIPO_RECINTO } from '../../../core/estimacion-nodos';

/** Etiquetas legibles de cada estado, reexportadas para la plantilla. */
const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = ETIQUETAS_ESTADO;

/** Página de cotizaciones: el ciclo comercial de lo que llega de la web. */
@Component({
  selector: 'app-cotizaciones',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cotizaciones.html',
  styleUrl: './cotizaciones.css'
})
export class Cotizaciones implements OnInit {
  /** Cliente de la API de cotización. */
  private cotizacionService = inject(CotizacionService);

  /** Constructor del formulario del ciclo comercial. */
  private fb = inject(FormBuilder);

  /** Estados por los que una solicitud puede pasar. */
  readonly estados = ESTADOS_SOLICITUD;

  /** Estado activo del filtro; vacío muestra todas. */
  filtro = signal<EstadoSolicitud | ''>('');

  /** Solicitudes del listado. */
  solicitudes = signal<SolicitudResumen[]>([]);

  /** `true` durante la carga del listado. */
  isCargando = signal(true);

  /** Mensaje de error, vacío si no hay. */
  error = signal('');

  /** Solicitud abierta con su detalle, o `null` si ninguna. */
  abierta = signal<SolicitudDetalle | null>(null);

  /** `true` mientras se abre o se guarda la solicitud abierta. */
  isOcupado = signal(false);

  /** Id de la solicitud con confirmación de borrado pendiente. */
  porEliminar = signal<string | null>(null);

  /** Formulario del ciclo comercial: estado y notas van juntos. */
  formEstado: FormGroup = this.fb.group({
    estado: ['nueva' as EstadoSolicitud, Validators.required],
    notas: [''],
  });

  /** Carga el listado según el filtro vigente. */
  ngOnInit(): void {
    this.cargar();
  }

  /** Solicitudes, de la más reciente hacia atrás, filtradas por estado. */
  cargar(): void {
    this.isCargando.set(true);
    this.error.set('');
    this.cotizacionService.listar(this.filtro() || undefined).subscribe({
      next: (res) => {
        this.solicitudes.set(res.data);
        this.isCargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudieron cargar las solicitudes.'));
        this.isCargando.set(false);
      },
    });
  }

  /** Cambia el filtro y recarga. */
  cambiarFiltro(estado: EstadoSolicitud | ''): void {
    this.filtro.set(estado);
    this.cargar();
  }

  /** Abre una solicitud y arma el formulario de ciclo con sus valores. */
  abrir(id: string): void {
    this.isOcupado.set(true);
    this.error.set('');
    this.cotizacionService.obtener(id).subscribe({
      next: (res) => {
        this.abierta.set(res.data);
        this.formEstado.setValue({
          estado: res.data.estado,
          notas: res.data.notasComerciales ?? '',
        });
        this.isOcupado.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudo abrir la solicitud.'));
        this.isOcupado.set(false);
      },
    });
  }

  /** Cierra el detalle sin cambiar nada. */
  cerrar(): void {
    this.abierta.set(null);
    this.porEliminar.set(null);
  }

  /** Guarda el estado y las notas; el listado se refresca por si acaso. */
  guardar(): void {
    const abierta = this.abierta();
    if (!abierta || this.formEstado.invalid) return;

    this.isOcupado.set(true);
    this.error.set('');
    const valores = this.formEstado.value;
    const notas = String(valores.notas ?? '').trim();

    this.cotizacionService
      .cambiarEstado(abierta.idSolicitud, valores.estado, notas || undefined)
      .subscribe({
        next: (res) => {
          this.abierta.set(res.data);
          this.isOcupado.set(false);
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(describeHttpError(err, 'No se pudo guardar el cambio.'));
          this.isOcupado.set(false);
        },
      });
  }

  /** Pide confirmación antes de borrar: es una solicitud de un cliente. */
  pedirEliminar(id: string): void {
    this.porEliminar.set(id);
  }

  /** Cancela la confirmación de borrado. */
  cancelarEliminar(): void {
    this.porEliminar.set(null);
  }

  /** Elimina tras la confirmación, cierra el detalle y recarga. */
  confirmarEliminar(): void {
    const id = this.porEliminar();
    if (!id) return;

    this.isOcupado.set(true);
    this.cotizacionService.eliminar(id).subscribe({
      next: () => {
        this.porEliminar.set(null);
        this.cerrar();
        this.isOcupado.set(false);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudo eliminar la solicitud.'));
        this.porEliminar.set(null);
        this.isOcupado.set(false);
      },
    });
  }

  /** Descarga el documento .json de la solicitud abierta. */
  descargar(): void {
    const abierta = this.abierta();
    if (!abierta) return;

    this.cotizacionService.documento(abierta.idSolicitud).subscribe({
      next: (res: { data: DocumentoSolicitud }) => {
        const doc = res.data;
        descargarJson(`solicitud-cotizacion-${doc.idSolicitud.slice(0, 8)}`, doc);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudo descargar el documento.'));
      },
    });
  }

  /** Etiqueta legible de un estado del ciclo. */
  etiquetaEstado(estado: EstadoSolicitud): string {
    return ETIQUETA_ESTADO[estado];
  }

  /** Icono del tipo de recinto, el mismo que vio el cliente en el formulario. */
  iconoTipo(clave: string): string {
    return ETIQUETAS_TIPO_RECINTO[clave as keyof typeof ETIQUETAS_TIPO_RECINTO]?.icono ?? 'apartment';
  }

  /**
   * Requisitos declarados por el cliente, tal como llegaron en el documento.
   * Devuelve `null` si el documento no los trae (una solicitud antigua).
   */
  requisitosDe(s: SolicitudDetalle): {
    camaras: boolean;
    analisisRed: boolean;
    seguridadPrivada: boolean;
    ventilacionRemota: boolean;
    notas?: string;
  } | null {
    const requisitos = s.datos['requisitos'];
    if (!requisitos || typeof requisitos !== 'object') return null;
    const r = requisitos as Record<string, unknown>;
    return {
      camaras: Boolean(r['camaras']),
      analisisRed: Boolean(r['analisisRed']),
      seguridadPrivada: Boolean(r['seguridadPrivada']),
      ventilacionRemota: Boolean(r['ventilacionRemota']),
      notas: typeof r['notas'] === 'string' ? r['notas'] : undefined,
    };
  }

  /** Etiqueta legible del tipo de recinto. */
  etiquetaTipo(clave: string): string {
    return ETIQUETAS_TIPO_RECINTO[clave as keyof typeof ETIQUETAS_TIPO_RECINTO]?.nombre ?? clave;
  }

  /** Fecha corta en es-CO: día y mes, sin el año en curso. */
  fechaCorta(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  }
}
