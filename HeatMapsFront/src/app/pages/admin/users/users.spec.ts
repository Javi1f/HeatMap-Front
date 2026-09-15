import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AllowedEmailsService } from '../../../core/services/allowed-emails.service';
import { AdminSummary, SessionSummary, UsersService } from '../../../core/services/users.service';
import { TablaAuditoriaComponent } from './tabla-auditoria/tabla-auditoria';
import { Users } from './users';

const EMAILS = [
  { id: 1, email: 'fundador@unbosque.edu.co', addedBy: 'sistema', createdAt: '2026-01-01' },
  { id: 2, email: 'yo@unbosque.edu.co', addedBy: 'fundador', createdAt: '2026-02-01' },
  { id: 3, email: 'otro@unbosque.edu.co', addedBy: 'yo', createdAt: '2026-03-01' },
];

/** Resumen de administrador, activo, verificado y con rol `admin`. */
const admin = (id: number, campos: Partial<AdminSummary> = {}): AdminSummary => ({
  id, username: `u${id}`, email: `u${id}@unbosque.edu.co`, isVerified: true, createdAt: '2026-01-01T00:00:00Z',
  conSesionActiva: false, rol: 'admin', activo: true, ...campos,
});

const ADMINS = [
  admin(1, { rol: 'root', email: 'yo@unbosque.edu.co', conSesionActiva: true }),
  admin(2),
  admin(3, { activo: false }),
  admin(4, { isVerified: false }),
];

/** Sesión abierta del administrador 1. */
const sesion = (idSesion: string, esActual = false): SessionSummary => ({
  idSesion, idAdmin: 1, username: esActual ? 'u1' : null, ipOrigen: null,
  fechaInicio: '2026-09-14T10:00:00Z', fechaExpiracion: '2026-09-14T11:00:00Z', esActual,
});

/** Petición que falla con el estado y, si se indica, el mensaje del backend. */
const errorCon = (status: number, message?: string) =>
  throwError(() => new HttpErrorResponse({ status, error: message ? { message } : null }));

describe('Users', () => {
  let fixture: ComponentFixture<Users>;
  let correos: Record<string, ReturnType<typeof vi.fn>>;
  let usuarios: Record<string, ReturnType<typeof vi.fn>>;
  let auth: { currentAdmin: ReturnType<typeof signal>; clearSession: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  /** Crea la página de usuarios y ejecuta la primera detección de cambios. */
  const crear = () => {
    fixture = TestBed.createComponent(Users);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  /** Elemento raíz del componente. */
  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    correos = {
      getAll: vi.fn(() => of({ success: true, data: EMAILS })),
      add: vi.fn((email: string) => of({ success: true, data: { id: 9, email, addedBy: 'yo', createdAt: '2026-09-14' } })),
      delete: vi.fn(() => of({ success: true, message: 'ok' })),
    };
    usuarios = {
      listAdmins: vi.fn(() => of({ success: true, data: ADMINS })),
      listSessions: vi.fn(() => of({ success: true, data: [sesion('s1', true), sesion('s2')] })),
      listarAuditoria: vi.fn(() => of({ success: true, data: [] })),
      revokeSession: vi.fn(() => of({ success: true, message: 'ok' })),
      cambiarRol: vi.fn(() => of({ success: true, message: 'ok' })),
      cambiarActivo: vi.fn(() => of({ success: true, message: 'ok' })),
    };
    auth = { currentAdmin: signal({ id: 1, username: 'u1', email: 'yo@unbosque.edu.co' }), clearSession: vi.fn() };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      imports: [Users],
      providers: [
        { provide: AllowedEmailsService, useValue: correos },
        { provide: UsersService, useValue: usuarios },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  });

  describe('correos permitidos', () => {
    it('lista los correos y protege al fundador y al propio', () => {
      const componente = crear();
      expect(componente.firstEmailId()).toBe(1);
      expect(EMAILS.map((correo) => componente.canDelete(correo))).toEqual([false, false, true]);
      expect(EMAILS.map((correo) => componente.getDeleteTooltip(correo))).toEqual([
        'No puedes eliminar el correo fundador', 'No puedes eliminar tu propio correo', 'Eliminar correo',
      ]);
      expect(html().querySelectorAll('tr[appEmailRow]')).toHaveLength(3);
      expect(html().textContent).toContain('fundador');
    });

    it('sin correos ni sesión propia no hay fundador ni correo actual', () => {
      correos['getAll'].mockReturnValue(of({ success: true, data: [] }));
      auth.currentAdmin.set(null);
      const componente = crear();
      expect(componente.firstEmailId()).toBeNull();
      expect(componente.currentAdminEmail()).toBe('');
      expect(html().textContent).toContain('No hay correos permitidos registrados');
    });

    it('un fallo al cargar se puede reintentar', () => {
      correos['getAll'].mockReturnValue(errorCon(0));
      const componente = crear();
      expect(componente.error()).toContain('No hay conexión');
      correos['getAll'].mockReturnValue(of({ success: true, data: EMAILS }));
      fixture.detectChanges();
      (html().querySelector('.retry-btn') as HTMLButtonElement).click();
      expect(componente.emails()).toHaveLength(3);
    });

    it('no añade un correo inválido', () => {
      const componente = crear();
      componente.addForm.setValue({ email: 'no-es-correo' });
      componente.onAddEmail();
      expect(correos['add']).not.toHaveBeenCalled();
      fixture.detectChanges();
      expect(html().textContent).toContain('Ingresa un correo electrónico válido.');
    });

    it('añade el correo desde el formulario y lo limpia', () => {
      const componente = crear();
      componente.addForm.setValue({ email: 'nuevo@unbosque.edu.co' });
      (html().querySelector('.add-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      expect(correos['add']).toHaveBeenCalledWith('nuevo@unbosque.edu.co');
      expect(componente.emails()).toHaveLength(4);
      expect(componente.addForm.value.email).toBeNull();
    });

    it('muestra el motivo si el backend rechaza el alta', () => {
      const componente = crear();
      componente.addForm.setValue({ email: 'otro@unbosque.edu.co' });
      correos['add'].mockReturnValue(errorCon(409, 'El correo ya está en la lista'));
      componente.onAddEmail();
      correos['add'].mockReturnValue(errorCon(500));
      componente.onAddEmail();
      fixture.detectChanges();
      expect(componente.addError()).toBe('Error al añadir el correo.');
      expect(componente.isAdding()).toBe(false);
    });

    it('pide confirmación antes de eliminar y puede cancelarse', () => {
      const componente = crear();
      (html().querySelector('tr[appEmailRow] button.btn-delete') as HTMLButtonElement).click();
      expect(componente.emailBeingDeleted()?.id).toBe(3);
      fixture.detectChanges();
      expect(html().querySelector('app-delete-confirm-modal')?.textContent).toContain('otro@unbosque.edu.co');

      (html().querySelector('.btn-secondary') as HTMLButtonElement).click();
      expect(componente.confirmDeleteId()).toBeNull();
      expect(correos['delete']).not.toHaveBeenCalled();
    });

    it('confirmar elimina el correo; un fallo se informa', () => {
      const componente = crear();
      componente.confirmDelete();
      expect(correos['delete']).not.toHaveBeenCalled();

      componente.requestDelete(3);
      fixture.detectChanges();
      (html().querySelector('.btn-danger') as HTMLButtonElement).click();
      expect(correos['delete']).toHaveBeenCalledWith(3);
      expect(componente.emails().map((correo) => correo.id)).toEqual([1, 2]);

      correos['delete'].mockReturnValue(errorCon(404, 'Correo no encontrado'));
      componente.requestDelete(2);
      componente.confirmDelete();
      expect(componente.error()).toBe('Correo no encontrado');
      correos['delete'].mockReturnValue(errorCon(500));
      componente.requestDelete(2);
      componente.confirmDelete();
      expect(componente.error()).toBe('Error al eliminar el correo.');
      expect(componente.deletingId()).toBeNull();
    });

    it('el clic fuera del cuadro de confirmación cancela; dentro no', () => {
      const componente = crear();
      componente.requestDelete(3);
      fixture.detectChanges();
      (html().querySelector('.modal-card') as HTMLElement).click();
      expect(componente.confirmDeleteId()).toBe(3);
      (html().querySelector('.modal-overlay') as HTMLElement).click();
      expect(componente.confirmDeleteId()).toBeNull();
    });
  });

  describe('cuentas y sesiones', () => {
    it('muestra estado, rol y acciones de cada cuenta, sin tocar la propia', () => {
      crear();
      const filas = html().querySelectorAll<HTMLTableRowElement>('section:nth-of-type(2) tbody tr');
      expect([...filas].map((fila) => fila.querySelector('.pill')?.textContent?.trim())).toEqual(['En línea', 'Verificado', 'Desactivada', 'Sin verificar']);
      expect(filas[0].querySelector<HTMLSelectElement>('select')?.disabled).toBe(true);
      expect(filas[0].querySelector('.btn-cuenta')).toBeNull();
      expect(filas[2].querySelector('.btn-cuenta')?.textContent?.trim()).toBe('Activar');
      expect(html().textContent).toContain('esta sesión');
      expect(html().textContent).toContain('Cuenta eliminada');
    });

    it('cambia el rol desde el selector y recarga; ignora valores extraños', () => {
      const componente = crear();
      const selector = html().querySelectorAll<HTMLSelectElement>('select.selector-rol')[1];
      selector.value = 'root';
      selector.dispatchEvent(new Event('change'));
      expect(usuarios['cambiarRol']).toHaveBeenCalledWith(2, 'root');
      expect(usuarios['listAdmins']).toHaveBeenCalledTimes(2);

      componente.cambiarRol(ADMINS[1], 'superusuario');
      expect(usuarios['cambiarRol']).toHaveBeenCalledTimes(1);
    });

    it('activa y desactiva cuentas', () => {
      const componente = crear();
      (html().querySelectorAll<HTMLButtonElement>('.btn-cuenta')[0]).click();
      expect(usuarios['cambiarActivo']).toHaveBeenCalledWith(2, false);
      componente.alternarActivo(ADMINS[2]);
      expect(usuarios['cambiarActivo']).toHaveBeenLastCalledWith(3, true);
      expect(componente.cambiandoCuentaId()).toBeNull();
    });

    it('si el backend rechaza el cambio, el motivo queda visible tras recargar', () => {
      const componente = crear();
      usuarios['cambiarRol'].mockReturnValue(errorCon(409, 'Debe quedar al menos un administrador root activo'));
      componente.cambiarRol(ADMINS[0], 'admin');
      fixture.detectChanges();
      expect(componente.accountsError()).toBe('Debe quedar al menos un administrador root activo');
      expect(html().textContent).toContain('Debe quedar al menos un administrador root activo');

      usuarios['cambiarActivo'].mockReturnValue(errorCon(500));
      componente.alternarActivo(ADMINS[1]);
      expect(componente.accountsError()).toBe('No se pudo actualizar la cuenta.');
      expect(componente.cambiandoCuentaId()).toBeNull();
    });

    it.each([
      ['listAdmins', 'No se pudo cargar la lista de administradores.'],
      ['listSessions', 'No se pudieron cargar las sesiones activas.'],
      ['listarAuditoria', 'No se pudo cargar la auditoría.'],
    ])('un fallo en %s se muestra', (metodo, mensaje) => {
      usuarios[metodo].mockReturnValue(errorCon(404));
      const componente = crear();
      expect(componente.accountsError()).toBe(mensaje);
      expect(componente.isLoadingAccounts()).toBe(false);
    });

    it('sin cuentas ni sesiones lo indica', () => {
      usuarios['listAdmins'].mockReturnValue(of({ success: true, data: [] }));
      usuarios['listSessions'].mockReturnValue(of({ success: true, data: [] }));
      crear();
      expect(html().textContent).toContain('Todavía no hay administradores registrados');
      expect(html().textContent).toContain('No hay sesiones abiertas');
    });

    it('mientras carga muestra el indicador', () => {
      usuarios['listAdmins'].mockReturnValue(new Subject());
      crear();
      expect(html().textContent).toContain('Cargando administradores...');
    });

    it('cerrar una sesión ajena la quita y recarga', () => {
      const componente = crear();
      componente.revokeSession(sesion('s2'));
      expect(usuarios['revokeSession']).toHaveBeenCalledWith('s2');
      expect(componente.revokingSessionId()).toBeNull();
      expect(usuarios['listSessions']).toHaveBeenCalledTimes(2);
    });

    it('cerrar la sesión propia saca al inicio', () => {
      crear();
      (html().querySelector('button[title="Cerrar tu sesión actual"]') as HTMLButtonElement).click();
      expect(auth.clearSession).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('un fallo al cerrar sesión se informa', () => {
      const componente = crear();
      usuarios['revokeSession'].mockReturnValue(errorCon(404, 'La sesión no existe o ya estaba cerrada'));
      componente.revokeSession(sesion('s2'));
      expect(componente.accountsError()).toBe('La sesión no existe o ya estaba cerrada');
      usuarios['revokeSession'].mockReturnValue(errorCon(500));
      componente.revokeSession(sesion('s2'));
      expect(componente.accountsError()).toBe('No se pudo cerrar la sesión.');
    });
  });
});

describe('TablaAuditoriaComponent', () => {
  it('traduce las acciones, resuelve el administrador y marca los accesos fallidos', () => {
    const vista = TestBed.createComponent(TablaAuditoriaComponent);
    vista.componentRef.setInput('eventos', []);
    vista.detectChanges();
    expect(vista.nativeElement.textContent).toContain('Todavía no hay eventos registrados');

    vista.componentRef.setInput('admins', [admin(1)]);
    vista.componentRef.setInput('eventos', [
      { id: '1', fecha: '2026-09-14T12:00:00Z', idAdmin: 1, tipo: 'rol_cambiado', detalle: 'admin=2 rol=root', ipOrigen: '10.0.0.1' },
      { id: '2', fecha: '2026-09-14T12:01:00Z', idAdmin: null, tipo: 'inicio_sesion_fallido', detalle: null, ipOrigen: null },
      { id: '3', fecha: '2026-09-14T12:02:00Z', idAdmin: 7, tipo: 'tipo_nuevo', detalle: null, ipOrigen: null },
    ]);
    vista.detectChanges();

    const filas = vista.componentInstance.filas();
    expect(filas[0]).toMatchObject({ quien: 'u1', accion: 'Rol cambiado', detalle: 'admin=2 rol=root', ip: '10.0.0.1', fallido: false });
    expect(filas[1]).toMatchObject({ quien: '—', accion: 'Inicio de sesión fallido', detalle: '', ip: '—', fallido: true });
    expect(filas[2]).toMatchObject({ quien: '#7', accion: 'tipo_nuevo' });
    expect(vista.nativeElement.querySelectorAll('.accion-fallida')).toHaveLength(1);
  });
});
