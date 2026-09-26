/**
 * @file tabla-administradores.ts
 * @description Tabla de cuentas de administrador con su rol, su estado y la
 * acción de activarlas o desactivarlas.
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminSummary } from '../../../../core/services/users.service';
import { SenalComponent, Tono } from '../../../../shared/indicadores/indicadores';

/**
 * Estado de una cuenta tal como lo dibuja su indicador de señal.
 *
 * Las barras ordenan los estados de mejor a peor: dentro ahora (4), lista para
 * entrar (3), a medio registrar (1) y apagada (0).
 */
interface EstadoCuenta {
  /** Barras encendidas, de 0 a 4. */
  readonly barras: number;
  /** Color del indicador. */
  readonly tono: Tono;
  /** Texto del estado. */
  readonly texto: string;
  /** `true` si tiene una sesión abierta en este momento. */
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
  if (!admin.activo) return { barras: 0, tono: 'peligro', texto: 'Desactivada', enLinea: false };
  if (admin.conSesionActiva) return { barras: 4, tono: 'ok', texto: 'En línea', enLinea: true };
  return admin.isVerified
    ? { barras: 3, tono: 'neutro', texto: 'Verificado', enLinea: false }
    : { barras: 1, tono: 'aviso', texto: 'Sin verificar', enLinea: false };
};

/** Tabla de administradores registrados. */
@Component({
  selector: 'app-tabla-administradores',
  standalone: true,
  imports: [DatePipe, SenalComponent],
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
  readonly cambiandoId = input<string | null>(null);

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
