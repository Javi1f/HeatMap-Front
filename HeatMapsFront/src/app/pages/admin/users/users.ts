/**
 * @file users.ts
 * @description Administración de usuarios (`/admin/users`).
 *
 * Reúne las tres caras del control de acceso al panel:
 *
 * 1. **Correos permitidos** — quién *puede* registrarse (lista blanca).
 * 2. **Administradores** — quién *ya está* registrado.
 * 3. **Sesiones activas** — quién está dentro *ahora* y desde dónde.
 *
 * Antes vivía solo la primera en `/admin/dashboard`; el dashboard quedó para
 * las métricas de ocupación, que es lo que el sistema produce.
 *
 * ## Funcionalidades
 * - **Listar** los correos permitidos con información de quién los añadió y cuándo.
 * - **Añadir** nuevos correos con validación de formato en el cliente.
 * - **Eliminar** correos con confirmación mediante un modal para evitar borrados accidentales.
 * - **Revisar** los administradores registrados y su estado de verificación.
 * - **Revocar** sesiones abiertas, propias o ajenas, con efecto inmediato.
 *
 * ## Protecciones de UI
 * - El correo del administrador autenticado no puede eliminarse a sí mismo.
 * - El correo con el ID más bajo (correo fundador) no puede eliminarse.
 * - Ambas restricciones se calculan mediante `computed` reactivos para mantenerse
 *   sincronizados con el estado actual de la lista y la sesión.
 *
 * ## Acceso
 * Requiere autenticación; protegido por {@link authGuard} en las rutas.
 */

import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AllowedEmailsService } from '../../../core/services/allowed-emails.service';
import {
  AdminSummary,
  SessionSummary,
  UsersService,
} from '../../../core/services/users.service';
import { AllowedEmail } from '../../../core/models/admin.model';
import { describeHttpError } from '../../../core/http-error';
import { EmailRowComponent } from './email-row';
import { AddEmailFormComponent } from './add-email-form';
import { DeleteConfirmModalComponent } from './delete-confirm-modal';

/**
 * Componente de administración de usuarios.
 * Gestiona la lista blanca de correos, el listado de administradores y las
 * sesiones abiertas.
 */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmailRowComponent, AddEmailFormComponent, DeleteConfirmModalComponent],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  /** Identifica al admin en sesion, para las protecciones de la lista. */
  private authService         = inject(AuthService);

  /** CRUD de la lista blanca de correos. */
  private allowedEmailsService = inject(AllowedEmailsService);

  /** Consulta de administradores y sesiones abiertas. */
  private usersService        = inject(UsersService);

  /** Necesario para salir de la pantalla al revocar la sesion propia. */
  private router              = inject(Router);

  /** Constructor del formulario reactivo de alta de correos. */
  private fb                  = inject(FormBuilder);

  /** Lista actual de correos permitidos, cargada desde el backend. */
  emails = signal<AllowedEmail[]>([]);

  /** `true` mientras se realiza la carga inicial de la lista. */
  isLoading = signal<boolean>(false);

  /** `true` mientras se procesa la petición de añadir un correo. */
  isAdding = signal<boolean>(false);

  /** Mensaje de error general (carga o eliminación), vacío si no hay error. */
  error = signal<string>('');

  /** Mensaje de error específico del formulario de añadir correo. */
  addError = signal<string>('');

  /**
   * ID del correo que está siendo eliminado actualmente.
   * Se usa para mostrar el spinner en la fila correspondiente durante la petición.
   * `null` cuando no hay eliminación en curso.
   */
  deletingId = signal<number | null>(null);

  /**
   * ID del correo pendiente de confirmación en el modal de borrado.
   * `null` cuando el modal de confirmación no está visible.
   */
  confirmDeleteId = signal<number | null>(null);

  /** Formulario reactivo para el campo de email del formulario de añadir. */
  addForm: FormGroup = this.fb.group({
    email: ['', [
      Validators.required,
      Validators.email,
      Validators.pattern('^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$')
    ]]
  });

  /**
   * Email del administrador autenticado actualmente.
   * Se usa para la restricción que impide eliminar el propio correo.
   * Cadena vacía si no hay sesión activa.
   */
  currentAdminEmail = computed(() => this.authService.currentAdmin()?.email ?? '');

  /**
   * ID numérico más pequeño de la lista (el "correo fundador").
   * Se protege de eliminación independientemente de quién lo añadió.
   * `null` si la lista está vacía.
   */
  firstEmailId = computed(() => {
    const list = this.emails();
    if (!list.length) return null;
    return list.reduce((minId, e) => (e.id < minId ? e.id : minId), list[0].id);
  });

  /**
   * Entidad `AllowedEmail` que está esperando confirmación para ser eliminada.
   * Derivado reactivamente de `confirmDeleteId` y la lista `emails`.
   * `null` cuando no hay ningún correo pendiente de confirmación.
   */
  emailBeingDeleted = computed(() => {
    const id = this.confirmDeleteId();
    return this.emails().find(e => e.id === id) ?? null;
  });

  /**
   * Acceso directo a los controles del formulario de añadir correo.
   * Conveniente para verificar el estado de validación en la plantilla.
   */
  /** Acceso directo a los controles del formulario de añadir correo. */
  get f() { return this.addForm.controls; }

  /**
   * Carga la lista de correos permitidos al inicializar el componente.
   * @see {@link loadEmails}
   */

  /** Administradores registrados en el sistema. */
  admins = signal<AdminSummary[]>([]);

  /** Sesiones actualmente abiertas. */
  sessions = signal<SessionSummary[]>([]);

  /** `true` mientras se cargan administradores o sesiones. */
  isLoadingAccounts = signal<boolean>(false);

  /** Mensaje de error del bloque de administradores/sesiones. */
  accountsError = signal<string>('');

  /** Id de la sesión que se está revocando, para el spinner de su fila. */
  revokingSessionId = signal<string | null>(null);

  /** Carga los tres bloques de la pantalla al montar el componente. */
  ngOnInit(): void {
    this.loadEmails();
    this.loadAccounts();
  }

  /**
   * Carga administradores y sesiones en paralelo.
   *
   * Se piden juntos porque la tabla de administradores muestra si cada cuenta
   * tiene sesión viva, dato que sale del cruce de ambas listas en el backend.
   */
  loadAccounts(): void {
    this.isLoadingAccounts.set(true);
    this.accountsError.set('');

    this.usersService.listAdmins().subscribe({
      next: (res) => {
        this.admins.set(res.data);
        this.isLoadingAccounts.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.accountsError.set(describeHttpError(err, 'No se pudo cargar la lista de administradores.'));
        this.isLoadingAccounts.set(false);
      }
    });

    this.usersService.listSessions().subscribe({
      next: (res) => this.sessions.set(res.data),
      error: (err: HttpErrorResponse) =>
        this.accountsError.set(describeHttpError(err, 'No se pudieron cargar las sesiones activas.'))
    });
  }

  /**
   * Revoca una sesión.
   *
   * Si el administrador cierra la suya propia, el token deja de ser válido de
   * inmediato: se limpia la sesión local y se redirige al inicio, en lugar de
   * dejar la pantalla en un estado donde cada petición devolvería 401.
   */
  revokeSession(session: SessionSummary): void {
    this.revokingSessionId.set(session.idSesion);

    this.usersService.revokeSession(session.idSesion).subscribe({
      next: () => {
        this.revokingSessionId.set(null);

        if (session.esActual) {
          this.authService.clearSession();
          void this.router.navigate(['/']);
          return;
        }

        this.sessions.update(list => list.filter(s => s.idSesion !== session.idSesion));
        this.loadAccounts();
      },
      error: (err: HttpErrorResponse) => {
        this.accountsError.set(err.error?.message ?? 'No se pudo cerrar la sesión.');
        this.revokingSessionId.set(null);
      }
    });
  }

  /**
   * Carga la lista completa de correos permitidos desde el backend.
   * Activa el estado de carga y limpia errores previos antes de la petición.
   * Se puede llamar manualmente para reintentar en caso de error.
   */
  loadEmails(): void {
    this.isLoading.set(true);
    this.error.set('');

    this.allowedEmailsService.getAll().subscribe({
      next: (response) => {
        this.emails.set(response.data);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(describeHttpError(err, 'No se pudo cargar la lista de correos.'));
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Procesa el envío del formulario para añadir un correo a la lista blanca.
   *
   * Valida el formulario localmente antes de hacer la petición.
   * En caso de éxito, añade el nuevo correo a la lista sin recargar todos.
   *
   * @fires addError — se actualiza con el mensaje de error del backend si falla.
   */
  onAddEmail(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.isAdding.set(true);
    this.addError.set('');

    this.allowedEmailsService.add(this.addForm.value.email.trim()).subscribe({
      next: (response) => {
        this.emails.update(list => [...list, response.data]);
        this.addForm.reset();
        this.isAdding.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.addError.set(err.error?.message ?? 'Error al añadir el correo.');
        this.isAdding.set(false);
      }
    });
  }

  /**
   * Determina si un correo puede ser eliminado.
   *
   * Un correo **no puede** eliminarse si:
   * - Es el correo del administrador que está actualmente autenticado.
   * - Es el correo fundador (el de menor ID en la lista).
   *
   * @param email - Correo a evaluar.
   * @returns `true` si el correo puede ser eliminado por el admin actual.
   */
  canDelete(email: AllowedEmail): boolean {
    return (
      email.email !== this.currentAdminEmail() &&
      email.id !== this.firstEmailId()
    );
  }

  /**
   * Devuelve el texto del tooltip del botón de eliminar según el estado del correo.
   *
   * @param email - Correo para el que se quiere el tooltip.
   * @returns Texto descriptivo del estado o la acción disponible.
   */
  getDeleteTooltip(email: AllowedEmail): string {
    if (email.id === this.firstEmailId())        return 'No puedes eliminar el correo fundador';
    if (email.email === this.currentAdminEmail()) return 'No puedes eliminar tu propio correo';
    return 'Eliminar correo';
  }

  /**
   * Inicia el flujo de confirmación de borrado mostrando el modal.
   *
   * @param id - ID del correo a eliminar.
   */
  requestDelete(id: number): void {
    this.confirmDeleteId.set(id);
  }

  /**
   * Cancela el flujo de confirmación y cierra el modal sin eliminar nada.
   */
  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  /**
   * Ejecuta la eliminación del correo tras la confirmación en el modal.
   *
   * Guarda el ID, cierra el modal y realiza la petición DELETE.
   * En éxito, filtra el correo de la lista local sin recargar.
   * En error, muestra el mensaje del backend en el área de error general.
   */
  confirmDelete(): void {
    const id = this.confirmDeleteId();
    if (id === null) return;

    this.deletingId.set(id);
    this.confirmDeleteId.set(null);

    this.allowedEmailsService.delete(id).subscribe({
      next: () => {
        this.emails.update(list => list.filter(e => e.id !== id));
        this.deletingId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Error al eliminar el correo.');
        this.deletingId.set(null);
      }
    });
  }
}
