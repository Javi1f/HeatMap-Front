/**
 * @file login-state.service.ts
 * @description Servicio de estado local para el formulario de login.
 *
 * Encapsula toda la lógica de la pantalla de login (validación de formulario,
 * llamada al backend, conteo de intentos fallidos y bloqueo temporal) para que
 * pueda ser compartida entre dos componentes distintos que muestran el mismo
 * formulario en contextos diferentes:
 *
 * - {@link LoginComponent} — página de login a pantalla completa (`/login`).
 * - {@link LoginModalComponent} — modal de login flotante, accesible desde cualquier página.
 *
 * ## Ciclo de vida
 * Este servicio está decorado con `@Injectable()` sin `providedIn`, lo que
 * significa que **no es singleton**. Cada componente que lo incluya en su
 * array `providers` creará una instancia independiente, garantizando que el
 * estado del formulario de uno no interfiera con el del otro.
 *
 * El componente que lo use debe llamar a {@link destroy} en su `ngOnDestroy`
 * para cancelar el intervalo de cuenta atrás si está activo.
 */

import { Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './auth.service';


import { noop } from 'rxjs';
/**
 * Servicio de estado no-singleton para el formulario de login.
 *
 * Provisto a nivel de componente (`providers: [LoginStateService]`) para que
 * cada instancia del formulario (página y modal) tenga su propio estado aislado.
 */
// skipcq: JS-0579 — providedIn: null is intentional; service is component-scoped via providers[]
@Injectable({ providedIn: null })
export class LoginStateService {
  /** Formulario reactivo con los campos `identifier` y `password`. */
  loginForm: FormGroup;

  /** Mensaje de error del último intento fallido, vacío si no hay error. */
  loginError = signal<string>('');

  /**
   * `true` cuando el usuario ha fallado 3 veces (o múltiplo de 3) y está
   * en el período de bloqueo temporal de 10 segundos.
   */
  isBlocked = signal<boolean>(false);

  /**
   * Segundos restantes del bloqueo temporal.
   * Solo relevante cuando `isBlocked()` es `true`.
   */
  countdown = signal<number>(10);

  /** `true` cuando la contraseña se muestra en texto plano en el input. */
  showPassword = signal<boolean>(false);

  /**
   * `true` desde que se envían las credenciales hasta que llega la respuesta:
   * bloquea el formulario y despliega la cortina de verificación, y evita
   * que se vuelva a enviar la misma petición.
   */
  isSubmitting = signal<boolean>(false);

  /**
   * `true` cuando la respuesta fue correcta: la cortina anuncia el acceso
   * durante un instante antes de navegar, para que el cierre del proceso
   * se vea en lugar de saltarse.
   */
  isGranted = signal<boolean>(false);

  /**
   * Contador acumulado de intentos fallidos en la sesión actual del componente.
   * Se usa para aplicar el bloqueo cada 3 fallos consecutivos.
   */
  private failedAttempts = 0;

  /**
   * Referencia al intervalo de cuenta atrás activo, o `null` si no hay bloqueo.
   * Se usa para limpiarlo en {@link clearCountdown} y evitar fugas de memoria.
   */
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Suscripción a la petición de login en vuelo, o `null` si no hay ninguna.
   * Guardarla permite abortarla si el usuario cierra el formulario mientras
   * las credenciales se están verificando.
   */
  private peticionLogin: Subscription | null = null;

  /**
   * Temporizador del instante de «acceso concedido», o `null` si no está activo.
   * Se cancela al cerrar el formulario para que no dispare la navegación.
   */
  private tempoAcceso: ReturnType<typeof setTimeout> | null = null;

  /** Instante que la cortina anuncia «Acceso concedido» antes de navegar (ms). */
  private readonly latidoAcceso = 900;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      /** Campo unificado que acepta tanto el username como el email del administrador. */
      identifier: ['', Validators.required],
      /** Contraseña del administrador. */
      password: ['', Validators.required]
    });
  }

  /**
   * Acceso directo a los controles del formulario reactivo.
   * Útil en la plantilla para verificar estados de validación por campo.
   *
   * @returns Los controles del `loginForm`.
   */
  get controles() {
    return this.loginForm.controls;
  }

  /**
   * Alterna la visibilidad de la contraseña entre texto plano y `password`.
   */
  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  /**
   * Procesa el envío del formulario de login.
   *
   * Si el formulario es inválido, el usuario está bloqueado o ya hay una
   * petición en vuelo, marca todos los campos como tocados (para mostrar
   * validaciones) y no hace nada más.
   *
   * Al enviar, enciende {@link isSubmitting}: el formulario queda bloqueado
   * y la cortina de verificación lo cubre hasta que llega la respuesta. Con
   * error, la cortina se aparta y revela el aviso; con éxito, cambia a
   * «acceso concedido» ({@link isGranted}) durante {@link latidoAcceso} y
   * solo entonces cierra la vista y navega al dashboard.
   *
   * En éxito, `AuthService.login` ya persiste la sesión internamente via `tap`.
   * Se puede pasar un callback `onSuccess` para ejecutar lógica adicional
   * (por ejemplo, cerrar el modal) antes de la navegación.
   *
   * En error, incrementa el contador de fallos y aplica el bloqueo temporal
   * cada 3 intentos fallidos consecutivos.
   *
   * @param onSuccess - Callback opcional ejecutado tras login exitoso,
   *                    antes de navegar al dashboard.
   */
  onSubmit(onSuccess?: () => void): void {
    if (this.loginForm.invalid || this.isBlocked() || this.isSubmitting()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const request = {
      username: this.loginForm.value.identifier,
      password: this.loginForm.value.password
    };

    // Limpio restos del intento anterior y despliego la cortina.
    this.loginError.set('');
    this.isGranted.set(false);
    this.isSubmitting.set(true);

    this.peticionLogin = this.authService.login(request).subscribe({
      next: () => {
        this.failedAttempts = 0;
        this.isGranted.set(true);

        /** Respira el instante de acceso y después abre paso. */
        this.tempoAcceso = setTimeout(() => {
          this.tempoAcceso = null;
          this.peticionLogin = null;
          this.isSubmitting.set(false);
          onSuccess?.();
          this.router.navigate(['/admin/dashboard']).catch(noop);
        }, this.latidoAcceso);
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.failedAttempts++;
        this.loginError.set(
          err instanceof HttpErrorResponse && err.status >= 500
            ? 'Error del servidor, inténtalo de nuevo en unos segundos.'
            : 'Credenciales incorrectas.'
        );
        if (this.failedAttempts % 3 === 0) {
          this.startBlockCountdown();
        }
      }
    });
  }

  /**
   * Resetea el formulario a su estado inicial: limpia valores, errores,
   * bloqueo y cuenta atrás. Aborta también cualquier petición de login en
   * vuelo, de modo que cerrar el formulario durante la verificación no
   * navegue más tarde.
   *
   * Llamado cuando el usuario cierra el modal sin completar el login, o cuando
   * se reutiliza el componente después de un logout.
   */
  reset(): void {
    this.loginForm.reset();
    this.loginError.set('');
    this.isBlocked.set(false);
    this.clearCountdown();
    this.cancelarVuelo();
  }

  /**
   * Limpia los recursos del servicio. Debe ser invocado desde `ngOnDestroy`
   * del componente que proporciona este servicio para evitar fugas de memoria
   * si el componente se destruye durante un bloqueo o una petición activos.
   */
  destroy(): void {
    this.clearCountdown();
    this.cancelarVuelo();
  }

  /**
   * Cancela el intervalo de cuenta atrás activo y libera la referencia.
   * Operación segura: no hace nada si no hay intervalo activo.
   */
  private clearCountdown(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Aborta la petición de login en vuelo y cancela el temporizador del
   * instante de acceso, si los hay, y apaga ambos signals de estado.
   * Operación segura: no hace nada si no hay petición activa.
   */
  private cancelarVuelo(): void {
    if (this.peticionLogin !== null) {
      this.peticionLogin.unsubscribe();
      this.peticionLogin = null;
    }
    if (this.tempoAcceso !== null) {
      clearTimeout(this.tempoAcceso);
      this.tempoAcceso = null;
    }
    this.isSubmitting.set(false);
    this.isGranted.set(false);
  }

  /**
   * Inicia el bloqueo temporal de 10 segundos tras superar el umbral de intentos.
   *
   * Establece `isBlocked` a `true`, arranca un intervalo de 1 segundo que
   * decrementa `countdown`, y al llegar a 0 limpia el intervalo y desbloquea.
   */
  private startBlockCountdown(): void {
    this.isBlocked.set(true);
    this.countdown.set(10);
    this.loginError.set('');

    this.countdownInterval = setInterval(() => {
      const current = this.countdown() - 1;
      this.countdown.set(current);

      if (current === 0) {
        this.clearCountdown();
        this.isBlocked.set(false);
        this.countdown.set(10);
      }
    }, 1000);
  }
}
