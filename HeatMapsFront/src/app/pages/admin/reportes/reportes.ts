/**
 * @file reportes.ts
 * @description Generación y consulta de reportes de ocupación (`/admin/reportes`).
 *
 * ## Cómo funciona
 * Se elige tipo, rango y zona; el backend guarda esa definición y devuelve los
 * datos ya calculados. Las definiciones quedan listadas para volver a abrirlas
 * más adelante, momento en el que **se recalculan**: un reporte no es una foto
 * congelada, sino una consulta guardada.
 *
 * ## Tabla genérica
 * El backend devuelve `columnas` y `filas` alineadas, así que esta pantalla
 * pinta cualquier tipo de reporte sin conocer su forma. Añadir un tipo nuevo en
 * el backend no obliga a tocar este componente.
 *
 * ## Acceso
 * Requiere autenticación; protegido por {@link authGuard} en las rutas.
 */

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { describeHttpError } from '../../../core/http-error';
import { MetricsService, ZoneOccupancy } from '../../../core/services/metrics.service';
import {
  ETIQUETAS_TIPO,
  ReporteGenerado,
  ReporteResumen,
  ReportesService,
  TipoReporte,
} from '../../../core/services/reportes.service';
import { ResultadoReporteComponent } from './resultado-reporte/resultado-reporte';
import { ReportesGuardadosComponent } from './reportes-guardados/reportes-guardados';

/** Opciones del desplegable de tipo, derivadas de las etiquetas del servicio. */
const TIPOS = Object.entries(ETIQUETAS_TIPO) as [TipoReporte, string][];

/** Días que abarca el rango propuesto por defecto al abrir la pantalla. */
const DIAS_POR_DEFECTO = 7;

/**
 * Formatea una fecha como `YYYY-MM-DD`, que es lo que espera `<input type="date">`.
 *
 * Se construye a partir de los componentes locales y no de `toISOString`, que
 * convierte a UTC y en zonas con desfase negativo devolvería el día anterior.
 */
const paraInputDate = (fecha: Date): string => {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};


/** Página de reportes: genera, abre, descarga y elimina consultas sobre el histórico. */
@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ResultadoReporteComponent, ReportesGuardadosComponent],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css'
})
export class Reportes implements OnInit {
  /** Origen de los reportes guardados y de la exportación. */
  private reportesService = inject(ReportesService);

  /** Se usa solo para poblar el desplegable de zonas. */
  private metricsService = inject(MetricsService);

  /** Constructor del formulario reactivo. */
  private fb = inject(FormBuilder);

  /** Tipos disponibles, para el desplegable. */
  tipos = TIPOS;

  /** Zonas activas, para acotar el reporte. */
  zonas = signal<ZoneOccupancy[]>([]);

  /** Definiciones guardadas. */
  guardados = signal<ReporteResumen[]>([]);

  /** Reporte abierto con sus datos, o `null` si no hay ninguno. */
  actual = signal<ReporteGenerado | null>(null);

  /** `true` mientras se genera o se abre un reporte. */
  isGenerando = signal<boolean>(false);

  /** `true` durante la carga del listado. */
  isCargando = signal<boolean>(true);

  /** Id del reporte que se está eliminando, para el spinner de su fila. */
  eliminandoId = signal<string | null>(null);

  /** Id del reporte que se está descargando. */
  descargandoId = signal<string | null>(null);

  /** Mensaje de error, vacío si no hay ninguno. */
  error = signal<string>('');

  /** Formulario de generación. */
  form: FormGroup = this.fb.group({
    tipoReporte: ['serie_temporal' as TipoReporte, Validators.required],
    rangoInicio: ['', Validators.required],
    rangoFin: ['', Validators.required],
    idZona: [''],
  });

  /**
   * Deja la pantalla lista para generar un reporte sin teclear nada.
   *
   * Propone el rango antes de pedir datos: así el formulario aparece ya
   * relleno aunque las dos consultas tarden en responder.
   */
  ngOnInit(): void {
    this.proponerRango();
    this.cargarZonas();
    this.cargarGuardados();
  }

  /**
   * Rellena el rango con la última semana.
   *
   * Un formulario de fechas vacío obliga a teclear dos veces antes de ver
   * nada; con un rango razonable ya puesto, generar el primer reporte es un
   * solo clic.
   */
  private proponerRango(): void {
    const fin = new Date();
    const inicio = new Date(fin.getTime() - DIAS_POR_DEFECTO * 24 * 60 * 60 * 1000);
    this.form.patchValue({
      rangoInicio: paraInputDate(inicio),
      rangoFin: paraInputDate(fin),
    });
  }

  /** Carga las zonas activas para el desplegable. */
  private cargarZonas(): void {
    this.metricsService.zones().subscribe({
      next: (res) => this.zonas.set(res.data),
      error: () => this.zonas.set([]),
    });
  }

  /** Carga el listado de definiciones guardadas. */
  cargarGuardados(): void {
    this.isCargando.set(true);
    this.reportesService.listar().subscribe({
      next: (res) => {
        this.guardados.set(res.data);
        this.isCargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudieron cargar los reportes guardados.'));
        this.isCargando.set(false);
      },
    });
  }

  /** Genera un reporte con los valores del formulario y lo abre.
   *
   * El campo de fecha solo aporta el día, así que el rango se extiende a la
   * jornada completa: de otro modo el último día quedaría fuera del reporte.
   */
  generar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isGenerando.set(true);
    this.error.set('');

    const valores = this.form.value;
    this.reportesService
      .crear({
        tipoReporte: valores.tipoReporte,
        rangoInicio: new Date(`${valores.rangoInicio}T00:00:00`).toISOString(),
        rangoFin: new Date(`${valores.rangoFin}T23:59:59`).toISOString(),
        idZona: valores.idZona || undefined,
      })
      .subscribe({
        next: (res) => {
          this.actual.set(res.data);
          this.isGenerando.set(false);
          this.cargarGuardados();
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(describeHttpError(err, 'No se pudo generar el reporte.'));
          this.isGenerando.set(false);
        },
      });
  }

  /** Abre un reporte guardado, recalculando sus datos. */
  abrir(id: string): void {
    this.isGenerando.set(true);
    this.error.set('');

    this.reportesService.obtener(id).subscribe({
      next: (res) => {
        this.actual.set(res.data);
        this.isGenerando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudo abrir el reporte.'));
        this.isGenerando.set(false);
      },
    });
  }

  /** Descarga un reporte como CSV. */
  descargar(id: string): void {
    this.descargandoId.set(id);
    this.reportesService.descargarCsv(id).subscribe({
      next: () => this.descargandoId.set(null),
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudo descargar el reporte.'));
        this.descargandoId.set(null);
      },
    });
  }

  /** Elimina una definición guardada. */
  eliminar(id: string): void {
    this.eliminandoId.set(id);
    this.reportesService.eliminar(id).subscribe({
      next: () => {
        this.guardados.update((list) => list.filter((registro) => registro.idReporte !== id));
        if (this.actual()?.idReporte === id) this.actual.set(null);
        this.eliminandoId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudo eliminar el reporte.'));
        this.eliminandoId.set(null);
      },
    });
  }

  /** Cierra el reporte abierto sin eliminarlo. */
  cerrar(): void {
    this.actual.set(null);
  }

  /** Acceso a los controles del formulario desde la plantilla. */
  get controles() {
    return this.form.controls;
  }
}

