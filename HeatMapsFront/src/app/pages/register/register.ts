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

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  registerForm: FormGroup;
  showModal = signal<boolean>(false);
  verificationCodeValue = '';
  formError = signal<string>('');
  isLoading = signal<boolean>(false);
  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);

  private pendingEmail = '';

  get attemptsLeft() { return this.verificationService.attemptsLeft; }
  get verificationError() { return this.verificationService.verificationError; }

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private verificationService: VerificationService,
    private router: Router
  ) {
    this.registerForm = this.fb.group(
      {
        username: ['', [Validators.required, Validators.minLength(3)]],
        email: ['', [
          Validators.required,
          Validators.email,
          Validators.pattern('^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$')
        ]],
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

  passwordMatchValidator(group: AbstractControl) {
    const password = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return password === confirm ? null : { passwordMismatch: true };
  }

  get f() { return this.registerForm.controls; }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.formError.set('');

    this.authService.register({
      username: this.registerForm.value.username,
      email: this.registerForm.value.email,
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

  onVerify(): void {
    if (!this.verificationCodeValue.trim()) return;

    this.authService.verifyCode(this.pendingEmail, this.verificationCodeValue).subscribe({
      next: () => {
        this.showModal.set(false);
        this.router.navigate(['/admin/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as VerifyCodeErrorResponse;

        if (body?.attemptsLeft === 0) {
          this.showModal.set(false);
          this.registerForm.reset();
          this.verificationCodeValue = '';
          this.verificationService.reset();
          this.formError.set('Verificación errónea. Solicita un nuevo código.');
        } else {
          this.verificationService.handleServerError(body?.attemptsLeft ?? 0);
        }
      }
    });
  }

  onCloseModal(): void {
    this.authService.cancelVerification(this.pendingEmail).subscribe();
    this.showModal.set(false);
    this.pendingEmail = '';
    this.registerForm.reset();
    this.verificationCodeValue = '';
    this.verificationService.reset();
    this.formError.set('');
  }

  togglePassword(): void { this.showPassword.set(!this.showPassword()); }
  toggleConfirmPassword(): void { this.showConfirmPassword.set(!this.showConfirmPassword()); }
}
