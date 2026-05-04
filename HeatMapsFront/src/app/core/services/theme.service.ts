import { Injectable, signal, computed } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _theme = signal<Theme>(this.getInitialTheme());

  theme = computed(() => this._theme());
  isDark = computed(() => this._theme() === 'dark');

  private getInitialTheme(): Theme {
    return (localStorage.getItem('theme') as Theme) ?? 'dark';
  }

  init(): void {
    document.body.setAttribute('data-theme', this._theme());
  }

  toggle(): void {
    const next: Theme = this._theme() === 'dark' ? 'light' : 'dark';
    this._theme.set(next);
    localStorage.setItem('theme', next);
    document.body.setAttribute('data-theme', next);
  }
}
