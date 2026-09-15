/**
 * @file tabla-auditoria.ts
 * @description Últimos eventos de auditoría de acciones administrativas.
 *
 * Solo presenta: la pantalla de usuarios carga los eventos y los pasa aquí.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AdminSummary, EventoAuditoria } from '../../../../core/services/users.service';

/** Texto legible de cada tipo de evento. */
const ETIQUETAS: Record<string, string> = {
  inicio_sesion: 'Inicio de sesión',
  inicio_sesion_fallido: 'Inicio de sesión fallido',
  cierre_sesion: 'Cierre de sesión',
  registro_completado: 'Registro completado',
  sesion_revocada: 'Sesión revocada',
  correo_permitido_agregado: 'Correo permitido añadido',
  correo_permitido_eliminado: 'Correo permitido eliminado',
  rol_cambiado: 'Rol cambiado',
  admin_activado: 'Cuenta activada',
  admin_desactivado: 'Cuenta desactivada',
  reporte_eliminado: 'Reporte eliminado',
  consumidor_iniciado: 'Ingesta iniciada',
  consumidor_detenido: 'Ingesta detenida',
};

/** Una fila con el texto ya resuelto. */
interface FilaEvento {
  readonly id: string;
  readonly fecha: string;
  readonly quien: string;
  readonly accion: string;
  readonly detalle: string;
  readonly ip: string;
  readonly fallido: boolean;
}

/** Quién realizó la acción: su nombre, su identificador si ya no existe o una raya si no se identificó. */
const autorDe = (idAdmin: number | null, nombres: ReadonlyMap<number, string>): string => {
  if (idAdmin === null) return '—';
  return nombres.get(idAdmin) ?? `#${idAdmin}`;
};

/** Evento de auditoría convertido en fila legible. */
const aFila = (evento: EventoAuditoria, nombres: ReadonlyMap<number, string>): FilaEvento => ({
  id: evento.id,
  fecha: new Date(evento.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' }),
  quien: autorDe(evento.idAdmin, nombres),
  accion: ETIQUETAS[evento.tipo] ?? evento.tipo,
  detalle: evento.detalle ?? '',
  ip: evento.ipOrigen ?? '—',
  fallido: evento.tipo === 'inicio_sesion_fallido',
});

/** Tabla de los últimos eventos de auditoría, con acciones y administradores legibles. */
@Component({
  selector: 'app-tabla-auditoria',
  standalone: true,
  imports: [],
  templateUrl: './tabla-auditoria.html',
  styleUrls: ['../users.css', './tabla-auditoria.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaAuditoriaComponent {
  /** Eventos a mostrar, del más reciente al más antiguo. */
  readonly eventos = input.required<EventoAuditoria[]>();

  /** Administradores, para mostrar el nombre en lugar del identificador. */
  readonly admins = input<AdminSummary[]>([]);

  /** Filas listas para pintar. */
  readonly filas = computed<FilaEvento[]>(() => {
    const nombres = new Map(this.admins().map((admin) => [admin.id, admin.username]));
    return this.eventos().map((evento) => aFila(evento, nombres));
  });
}
