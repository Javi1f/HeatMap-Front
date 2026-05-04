import { Injectable, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable()
export class LoginStateService {
  loginForm: FormGroup;
  loginError = signal<string>('');
  isBlocked = signal<boolean>(false);
  countdown = signal<number>(10);
  showPassword = signal<boolean>(false);

  private failedAttempts = 0;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      identifier: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  onSubmit(onSuccess?: () => void): void {
    if (this.loginForm.invalid || this.isBlocked()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const request = {
      username: this.loginForm.value.identifier,
      password: this.loginForm.value.password
    };

    this.authService.login(request).subscribe({
      next: (response) => {
        this.failedAttempts = 0;
        this.authService.saveSession(response);
        onSuccess?.();
        this.router.navigate(['/admin/dashboard']);
      },
      error: () => {
        this.failedAttempts++;
        this.loginError.set('Credenciales incorrectas.');
        if (this.failedAttempts % 3 === 0) {
          this.startBlockCountdown();
        }
      }
    });
  }

  reset(): void {
    this.loginForm.reset();
    this.loginError.set('');
    this.isBlocked.set(false);
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  destroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  private startBlockCountdown(): void {
    this.isBlocked.set(true);
    this.countdown.set(10);
    this.loginError.set('');

    this.countdownInterval = setInterval(() => {
      const current = this.countdown() - 1;
      this.countdown.set(current);

      if (current === 0) {
        clearInterval(this.countdownInterval!);
        this.countdownInterval = null;
        this.isBlocked.set(false);
        this.countdown.set(10);
      }
    }, 1000);
  }
}
