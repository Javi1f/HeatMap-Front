import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ModalService {
  private _showLogin = signal<boolean>(false);
  showLogin = computed(() => this._showLogin());

  openLogin(): void {
    this._showLogin.set(true);
  }

  closeLogin(): void {
    this._showLogin.set(false);
  }
}
