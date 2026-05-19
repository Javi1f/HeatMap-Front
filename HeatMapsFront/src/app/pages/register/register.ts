/**
 * @file register.ts
 * @description Página de registro de nuevos administradores (`/register`).
 *
 * Implementa un flujo de dos pasos:
 *
 * ### Paso 1 — Formulario de registro
 * El usuario introduce `username`, `email`, `password` y `confirmPassword`.
 * Al enviar, el backend valida los datos, comprueba que el email esté en la
 * lista blanca y envía un código de verificación de 5 dígitos al correo.
 *
 * ### Paso 2 — Modal de verificación
 * Un modal superpuesto solicita el código recibido por email.
 * - Si el código es correcto: el backend crea la cuenta, devuelve el JWT
 *   y el usuario queda autenticado. Se navega al dashboard.
 * - Si el código es incorrecto: {@link VerificationService} actualiza el
 *   mensaje de error con los intentos restantes (según `details.attemptsLeft`).
 * - Si se agotan los intentos (0): el backend elimina el pending, el modal
 *   se cierra y el usuario debe volver a registrarse.
 * - Si el usuario cierra el modal manualmente: se llama a `cancelVerification`
 *   para limpiar el estado pendiente en el backend.
 *
 * ## Validaciones del lado cliente
 * Las validaciones del formulario replican las reglas del backend para dar
 * feedback inmediato sin necesidad de una petición HTTP:
 * - `username`: mínimo 3 caracteres.
 * - `email`: formato RFC.
 * - `password`: mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.
 * - `confirmPassword`: debe coincidir con `password` (validador de grupo).
 */

import { Component, signal } from '@angular/core';
import {
  AbstractControl, FormBuilder, FormGroup,
  FormsModule, ReactiveFormsModule, Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { VerificationService } from '../../core/services/verification.service';
import { VerifyCodeErrorResponse } from '../../core/models/admin.model';

/**
 * Componente de la página de registro.
 * Gestiona el formulario, el modal de verificación y la comunicación con el backend.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  /** Formulario reactivo con los cuatro campos de registro y el validador de grupo. */
  registerForm: FormGroup;

  /** `true` cuando el modal de verificación por código está visible. */
  showModal = signal<boolean>(false);

  /** Valor actual del input de código en el modal. Enlazado con `ngModel`. */
  verificationCodeValue = '';

  /** Mensaje de error general del formulario de registro (registro fallido, etc.). */
  formError = signal<string>('');

  /** `true` mientras la petición de registro está en curso. */
  isLoading = signal<boolean>(false);

  /** `true` cuando la contraseña del campo `password` se muestra en texto plano. */
  showPassword = signal<boolean>(false);

  /** `true` cuando la contraseña del campo `confirmPassword` se muestra en texto plano. */
  showConfirmPassword = signal<boolean>(false);

  /**
   * Email del registro pendiente de verificación.
   * Se usa para llamar a `verifyCode` y `cancelVerification`.
   * Se limpia al completar o cancelar el flujo.
   */
  private pendingEmail = '';

  /**
   * Intentos de verificación restantes, sincronizados con el backend.
   * Proxy del signal de {@link VerificationService}.
   */
  get attemptsLeft()      { return this.verificationService.attemptsLeft;      }

  /**
   * Mensaje de error del modal de verificación (código incorrecto, agotado, etc.).
   * Proxy del signal de {@link VerificationService}.
   */
  get verificationError() { return this.verificationService.verificationError; }

  constructor(
    private fb:                  FormBuilder,
    private authService:         AuthService,
    private verificationService: VerificationService,
    private router:              Router
  ) {
    this.registerForm = this.fb.group(
      {
        username: ['', [Validators.required, Validators.minLength(3)]],
        email: ['', [
          Validators.required,
          Validators.email,
          Validators.pattern('^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$')
        ]],
        /** Contraseña con requisitos de complejidad: mayúscula, minúscula, número, símbolo. */
        password: ['', [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$')
        ]],
        confirmPassword: ['', Validators.required]
      },
      { validators: this.passwordMatchValidator }
    );
  }

  /**
   * Validador de grupo que comprueba que `password` y `confirmPassword` coincidan.
   *
   * @param group - El `FormGroup` completo del registro.
   * @returns `null` si las contraseñas coinciden, o `{ passwordMismatch: true }` si no.
   */
  passwordMatchValidator(group: AbstractControl) {
    const password = group.get('password')?.value;
    const confirm  = group.get('confirmPassword')?.value;
    return password === confirm ? null : { passwordMismatch: true };
  }

  /**
   * Acceso directo a los controles del formulario reactivo.
   * Útil en la plantilla para verificar estados de validación por campo.
   */
  get f() { return this.registerForm.controls; }

  /**
   * Procesa el envío del formulario de registro (Paso 1).
   *
   * Valida el formulario localmente; si es válido, envía los datos al backend.
   * En caso de éxito, guarda el email pendiente, resetea el servicio de verificación
   * y abre el modal del código.
   *
   * @fires showModal — se establece a `true` si el backend confirma `verificationRequired`.
   */
  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.formError.set('');

    this.authService.register({
      username: this.registerForm.value.username,
      email:    this.registerForm.value.email,
      password: this.registerForm.value.password
    }).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.verificationRequired) {
          this.pendingEmail = this.registerForm.value.email;
          this.verificationService.reset();
          this.verificationCodeValue = '';
          this.showModal.set(true);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.formError.set(err.error?.message ?? 'Error al registrarse.');
      }
    });
  }

  /**
   * Procesa el envío del código de verificación (Paso 2).
   *
   * Si hay código ingresado, lo envía al backend.
   * - **Éxito**: cierra el modal y navega al dashboard.
   * - **Error con intentos restantes > 0**: actualiza el mensaje de error en el modal.
   * - **Error con intentos restantes = 0** o `TOO_MANY_ATTEMPTS`: cierra el modal,
   *   resetea el formulario y pide al usuario que vuelva a registrarse.
   */
  onVerify(): void {
    if (!this.verificationCodeValue.trim()) return;

    this.authService.verifyCode(this.pendingEmail, this.verificationCodeValue).subscribe({
      next: () => {
        this.showModal.set(false);
        void this.router.navigate(['/admin/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as VerifyCodeErrorResponse;

        if (body?.details?.attemptsLeft === 0) {
          // Intentos agotados: el backend eliminó el pending; reiniciar flujo
          this.showModal.set(false);
          this.registerForm.reset();
          this.verificationCodeValue = '';
          this.verificationService.reset();
          this.formError.set('Verificación errónea. Solicita un nuevo código.');
        } else {
          // Código incorrecto pero quedan intentos: actualizar el modal
          this.verificationService.handleServerError(body?.details?.attemptsLeft ?? 0);
        }
      }
    });
  }

  /**
   * Cancela el flujo de verificación cuando el usuario cierra el modal manualmente.
   *
   * Llama a `cancelVerification` para limpiar el estado pendiente en el backend,
   * cierra el modal y resetea el formulario de registro.
   */
  onCloseModal(): void {
    // Notificar al backend para que elimine el registro pendiente
    this.authService.cancelVerification(this.pendingEmail).subscribe();
    this.showModal.set(false);
    this.pendingEmail = '';
    this.registerForm.reset();
    this.verificationCodeValue = '';
    this.verificationService.reset();
    this.formError.set('');
  }

  /** Alterna la visibilidad del campo `password`. */
  togglePassword(): void        { this.showPassword.set(!this.showPassword());               }
  /** Alterna la visibilidad del campo `confirmPassword`. */
  toggleConfirmPassword(): void { this.showConfirmPassword.set(!this.showConfirmPassword()); }
}
