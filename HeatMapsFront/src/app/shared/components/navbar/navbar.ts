import { Component, computed, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SidebarService } from '../../../core/services/sidebar.service';
import { ModalService } from '../../../core/services/modal.service';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent {
  isCollapsed = computed(() => this.sidebarService.isCollapsed());
  isMobileOpen = computed(() => this.sidebarService.isMobileOpen());
  isLoggedIn = computed(() => this.authService.isAuthenticated());
  currentAdmin = computed(() => this.authService.currentAdmin());

  navItems: NavItem[] = [
    { label: 'Inicio', route: '/', icon: 'home' },
    { label: 'Sección pública', route: '/public', icon: 'public' }
  ];

  adminItems: NavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', icon: 'dashboard' }
  ];

  constructor(
    private authService: AuthService,
    private sidebarService: SidebarService,
    private modalService: ModalService,
    private router: Router
  ) {
    this.sidebarService.initResponsive();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.sidebarService.initResponsive();
  }

  toggleSidebar(): void { this.sidebarService.toggle(); }

  openLogin(): void {
    this.modalService.openLogin();
    this.sidebarService.closeMobile();
  }

  logout(): void {
    this.sidebarService.closeMobile();
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/']) // clearSession ya fue llamado
    });
  }

  navigate(route: string): void {
    this.router.navigate([route]);
    this.sidebarService.closeMobile();
  }
}
