import { Component, OnDestroy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LoginStateService } from '../../../core/services/login-state.service';
import { ModalService } from '../../../core/services/modal.service';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './login-modal.html',
  styleUrl: './login-modal.css',
  providers: [LoginStateService]
})
export class LoginModalComponent implements OnDestroy {
  constructor(
    public loginState: LoginStateService,
    private modalService: ModalService
  ) {}

  get loginForm() { return this.loginState.loginForm; }
  get f() { return this.loginState.f; }
  get loginError() { return this.loginState.loginError; }
  get isBlocked() { return this.loginState.isBlocked; }
  get countdown() { return this.loginState.countdown; }
  get showPassword() { return this.loginState.showPassword; }

  togglePassword(): void { this.loginState.togglePassword(); }

  closeModal(): void {
    this.modalService.closeLogin();
    this.loginState.reset();
  }

  onSubmit(): void {
    this.loginState.onSubmit(() => this.closeModal());
  }

  ngOnDestroy(): void { this.loginState.destroy(); }
}
