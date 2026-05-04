import { Component, computed, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar';
import { AuthService } from './core/services/auth.service';
import { SidebarService } from './core/services/sidebar.service';
import { ModalService } from './core/services/modal.service';
import { LoginModalComponent } from './shared/components/login-modal/login-modal';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, LoginModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit {
  isCollapsed = computed(() => this.sidebarService.isCollapsed());
  showLogin   = computed(() => this.modalService.showLogin());

  constructor(
    private authService:  AuthService,
    private sidebarService: SidebarService,
    private modalService: ModalService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.init(); // aplica el tema guardado al arrancar
    if (this.authService.getToken()) {
      this.authService.checkSession().subscribe({ error: () => {} });
    }
  }
}
