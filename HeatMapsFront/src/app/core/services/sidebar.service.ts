import { Injectable, signal, computed, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';

const MOBILE_BREAKPOINT = '(max-width: 768px)';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  private breakpointObserver = inject(BreakpointObserver);
  private _isCollapsed = signal<boolean>(false);
  private _isMobileOpen = signal<boolean>(false);

  isCollapsed = computed(() => this._isCollapsed());
  isMobileOpen = computed(() => this._isMobileOpen());

  private get isMobile(): boolean {
    return this.breakpointObserver.isMatched(MOBILE_BREAKPOINT);
  }

  toggle(): void {
    if (this.isMobile) {
      this._isMobileOpen.set(!this._isMobileOpen());
    } else {
      this._isCollapsed.set(!this._isCollapsed());
    }
  }

  initResponsive(): void {
    if (this.isMobile) {
      this._isCollapsed.set(true);
      this._isMobileOpen.set(false);
    }
  }

  closeMobile(): void {
    this._isMobileOpen.set(false);
  }
}
