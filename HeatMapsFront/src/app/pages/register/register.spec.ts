import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Register } from './register';

const VALIDO = { username: 'ana', email: 'ana@unbosque.edu.co', password: 'ClaveSegura1!', confirmPassword: 'ClaveSegura1!' };

/** Rechazo del código de verificación, con los intentos restantes si se indican. */
const errorVerificacion = (attemptsLeft?: number) =>
  throwError(() => new HttpErrorResponse({
    status: 400,
    error: attemptsLeft === undefined ? null : { message: 'Código incorrecto', details: { attemptsLeft } },
  }));

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let auth: Record<string, ReturnType<typeof vi.fn>>;
  let router: { navigate: ReturnType<typeof vi.fn> };

  /** Crea la página de registro y ejecuta la primera detección de cambios. */
  const crear = () => {
    fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  /** Elemento raíz del componente. */
  const html = () => fixture.nativeElement as HTMLElement;
  /** Envía el formulario de registro y actualiza la vista. */
  const enviar = () => {
    (html().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    auth = {
      register: vi.fn(() => of({ message: 'ok', verificationRequired: true })),
      verifyCode: vi.fn(() => of({ admin: { id: 1 }, token: 't' })),
      cancelVerification: vi.fn(() => of({ message: 'ok' })),
    };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      imports: [Register],
      providers: [{ provide: AuthService, useValue: auth }, { provide: Router, useValue: router }],
    });
  });

  it('valida cada campo y explica el problema', () => {
    const componente = crear();
    enviar();
    expect(auth['register']).not.toHaveBeenCalled();
    expect(html().textContent).toContain('El usuario es obligatorio.');
    expect(html().textContent).toContain('El correo es obligatorio.');
    expect(html().textContent).toContain('La contraseña es obligatoria.');

    componente.registerForm.setValue({ username: 'an', email: 'no-correo', password: 'corta', confirmPassword: 'otra' });
    componente.registerForm.markAllAsTouched();
    fixture.detectChanges();
    expect(html().textContent).toContain('Mínimo 3 caracteres.');
    expect(html().textContent).toContain('Ingresa un correo válido.');
    expect(html().textContent).toContain('Mínimo 8 caracteres.');
    expect(html().textContent).toContain('Las contraseñas no coinciden.');

    // Se escribe como lo haría el usuario: el evento del DOM es lo que marca la
    // vista para revisar; cambiar el control por código no lo hace sin zone.js.
    const clave = html().querySelector('#password') as HTMLInputElement;
    clave.value = 'sinsimbolos123';
    clave.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(html().textContent).toContain('Debe incluir mayúscula');

  });

  it('exige que las contraseñas coincidan', () => {
    const componente = crear();
    componente.registerForm.setValue({ ...VALIDO, confirmPassword: 'Distinta1!' });
    expect(componente.registerForm.errors).toEqual({ passwordMismatch: true });
    componente.registerForm.setValue(VALIDO);
    expect(componente.registerForm.valid).toBe(true);
  });

  it('registra y abre la verificación; muestra u oculta contraseñas', () => {
    const componente = crear();
    componente.registerForm.setValue(VALIDO);
    enviar();
    expect(auth['register']).toHaveBeenCalledWith({ username: 'ana', email: 'ana@unbosque.edu.co', password: 'ClaveSegura1!' });
    expect(componente.showModal()).toBe(true);
    expect(html().textContent).toContain('Intentos restantes:');

    componente.togglePassword();
    componente.toggleConfirmPassword();
    expect([componente.showPassword(), componente.showConfirmPassword()]).toEqual([true, true]);
  });

  it('si el backend no pide verificación no abre el cuadro', () => {
    auth['register'].mockReturnValue(of({ message: 'ok', verificationRequired: false }));
    const componente = crear();
    componente.registerForm.setValue(VALIDO);
    componente.onSubmit();
    expect(componente.showModal()).toBe(false);
    expect(componente.isLoading()).toBe(false);
  });

  it('muestra el motivo del rechazo del registro', () => {
    const componente = crear();
    componente.registerForm.setValue(VALIDO);
    auth['register'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Este correo no está autorizado para registrarse' } })));
    componente.onSubmit();
    expect(componente.formError()).toBe('Este correo no está autorizado para registrarse');
    auth['register'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    componente.onSubmit();
    fixture.detectChanges();
    expect(html().querySelector('.alert-error')?.textContent).toContain('Error al registrarse.');
  });

  describe('verificación', () => {
    let componente: Register;
    beforeEach(() => {
      componente = crear();
      componente.registerForm.setValue(VALIDO);
      componente.onSubmit();
      fixture.detectChanges();
    });

    it('no envía un código vacío', () => {
      componente.verificationCodeValue = '   ';
      componente.onVerify();
      expect(auth['verifyCode']).not.toHaveBeenCalled();
    });

    it('con el código correcto entra al dashboard', () => {
      componente.verificationCodeValue = '12345';
      (html().querySelector('.modal-actions .btn-primary') as HTMLButtonElement).click();
      expect(auth['verifyCode']).toHaveBeenCalledWith('ana@unbosque.edu.co', '12345');
      expect(componente.showModal()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    });

    it('con un código incorrecto descuenta intentos', () => {
      auth['verifyCode'].mockReturnValue(errorVerificacion(2));
      componente.verificationCodeValue = '00000';
      componente.onVerify();
      fixture.detectChanges();
      expect(componente.attemptsLeft()).toBe(2);
      expect(html().textContent).toContain('Te quedan 2 intentos.');

      auth['verifyCode'].mockReturnValue(errorVerificacion());
      componente.onVerify();
      expect(componente.verificationError()).toBe('Has agotado todos los intentos.');
    });

    it('al agotar los intentos cierra y pide volver a registrarse', () => {
      auth['verifyCode'].mockReturnValue(errorVerificacion(0));
      componente.verificationCodeValue = '00000';
      componente.onVerify();
      expect(componente.showModal()).toBe(false);
      expect(componente.registerForm.value.email).toBeNull();
      expect(componente.formError()).toBe('Verificación errónea. Solicita un nuevo código.');
    });

    it('cancelar descarta el registro pendiente; el clic dentro del cuadro no lo cierra', () => {
      (html().querySelector('.modal-card') as HTMLElement).click();
      expect(componente.showModal()).toBe(true);
      (html().querySelector('.modal-overlay') as HTMLElement).click();
      expect(auth['cancelVerification']).toHaveBeenCalledWith('ana@unbosque.edu.co');
      expect(componente.showModal()).toBe(false);
      expect(componente.registerForm.value.username).toBeNull();
    });
  });
});
