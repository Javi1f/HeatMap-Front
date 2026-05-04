import { Component, OnDestroy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LoginStateService } from '../../core/services/login-state.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
  providers: [LoginStateService]
})
export class Login implements OnDestroy {
  constructor(public loginState: LoginStateService) {}

  get loginForm() { return this.loginState.loginForm; }
  get f() { return this.loginState.f; }
  get loginError() { return this.loginState.loginError; }
  get isBlocked() { return this.loginState.isBlocked; }
  get countdown() { return this.loginState.countdown; }
  get showPassword() { return this.loginState.showPassword; }

  togglePassword(): void { this.loginState.togglePassword(); }
  onSubmit(): void { this.loginState.onSubmit(); }

  ngOnDestroy(): void { this.loginState.destroy(); }
}
