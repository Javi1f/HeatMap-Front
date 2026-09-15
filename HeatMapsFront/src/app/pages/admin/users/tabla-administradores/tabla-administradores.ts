/**
 * @file tabla-administradores.ts
 * @description Tabla de cuentas de administrador con su rol, su estado y la
 * acción de activarlas o desactivarlas.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminSummary } from '../../../../core/services/users.service';

/** Estado de una cuenta tal como se muestra en su píldora. */
interface EstadoCuenta {
  /** Clase de color de la píldora. */
  readonly clase: string;
  /** Texto de la píldora. */
  readonly texto: string;
  /** `true` si lleva el punto de «en línea». */
  readonly enLinea: boolean;
}

/** Administrador con lo que la fila necesita ya resuelto. */
interface FilaAdmin {
  /** Cuenta que se muestra. */
  readonly admin: AdminSummary;
  /** `true` si es la cuenta de quien consulta: no puede cambiarse a sí misma. */
  readonly esPropia: boolean;
  /** `true` mientras se guarda un cambio de esta cuenta. */
  readonly cambiando: boolean;
  /** Estado de la cuenta. */
  readonly estado: EstadoCuenta;
  /** Texto del botón de activación. */
  readonly accion: string;
}

/** Cambio de rol pedido desde el selector de una fila. */
export interface CambioRol {
  /** Cuenta afectada. */
  readonly admin: AdminSummary;
  /** Rol elegido. */
  readonly rol: string;
}

/** Estado que se muestra para una cuenta, del más al menos prioritario. */
const estadoDe = (admin: AdminSummary): EstadoCuenta => {
  if (!admin.activo) return { clase: 'pill-warn', texto: 'Desactivada', enLinea: false };
  if (admin.conSesionActiva) return { clase: 'pill-ok', texto: 'En línea', enLinea: true };
  return admin.isVerified
    ? { clase: 'pill-idle', texto: 'Verificado', enLinea: false }
    : { clase: 'pill-warn', texto: 'Sin verificar', enLinea: false };
};

/** Tabla de administradores registrados. */
@Component({
  selector: 'app-tabla-administradores',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './tabla-administradores.html',
  styleUrls: ['../users.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaAdministradoresComponent {
  /** Cuentas a mostrar. */
  readonly admins = input.required<AdminSummary[]>();

  /** Correo de quien consulta, para proteger su propia cuenta. */
  readonly correoPropio = input<string>('');

  /** Cuenta cuyo cambio se está guardando. */
  readonly cambiandoId = input<number | null>(null);

  /** Se pide cambiar el rol de una cuenta. */
  readonly cambiarRol = output<CambioRol>();

  /** Se pide activar o desactivar una cuenta. */
  readonly alternarActivo = output<AdminSummary>();

  /** Filas listas para pintar. */
  readonly filas = computed<FilaAdmin[]>(() =>
    this.admins().map((admin) => ({
      admin,
      esPropia: admin.email === this.correoPropio(),
      cambiando: admin.id === this.cambiandoId(),
      estado: estadoDe(admin),
      accion: admin.activo ? 'Desactivar' : 'Activar',
    })),
  );
}
