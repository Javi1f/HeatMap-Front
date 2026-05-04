import { Component, computed, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar';
import { AuthService } from './core/services/auth.service';
import { SidebarService } from './core/services/sidebar.service';
import { ModalService } from './core/services/modal.service';
import { LoginModalComponent } from './shared/components/login-modal/login-modal';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, LoginModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit {
  isCollapsed = computed(() => this.sidebarService.isCollapsed());
  showLogin = computed(() => this.modalService.showLogin());

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    if (this.authService.getToken()) {
      this.authService.checkSession().subscribe({
        error: () => {}
      });
    }
  }
}
