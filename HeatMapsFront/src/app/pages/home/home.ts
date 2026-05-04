import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ModalService } from '../../core/services/modal.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  isLoggedIn = computed(() => this.authService.isAuthenticated());
  alreadyLoggedMsg = signal<boolean>(false);
  private msgTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private modalService: ModalService,
    private authService: AuthService,
    protected router: Router
  ) {}

  openLogin(): void {
    if (this.isLoggedIn()) {
      this.showAlreadyLogged();
      return;
    }
    this.modalService.openLogin();
  }

  goToRegister(): void {
    if (this.isLoggedIn()) {
      this.authService.logout().subscribe({
        next: () => this.router.navigate(['/register']),
        error: () => this.router.navigate(['/register']) // limpia igual
      });
      return;
    }
    this.router.navigate(['/register']);
  }

  goToMaps(): void {
    this.router.navigate(['/public']);
  }

  private showAlreadyLogged(): void {
    this.alreadyLoggedMsg.set(true);
    if (this.msgTimeout) clearTimeout(this.msgTimeout);
    this.msgTimeout = setTimeout(() => this.alreadyLoggedMsg.set(false), 3000);
  }
}
