import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import {
  Admin, LoginRequest, LoginResponse,
  RegisterRequest, RegisterResponse,
  SessionResponse
} from '../models/admin.model';
import { apiUrl as API_URL } from '../config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private _isAuthenticated = signal<boolean>(false);
  private _currentAdmin = signal<Admin | null>(null);

  isAuthenticated = computed(() => this._isAuthenticated());
  currentAdmin = computed(() => this._currentAdmin());

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_URL}/auth/login`, request).pipe(
      tap(response => this.saveSession(response))
    );
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${API_URL}/auth/register`, request);
  }

  verifyCode(email: string, code: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_URL}/auth/verify-code`, { email, code })
      .pipe(tap(response => this.saveSession(response)));
  }

  cancelVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${API_URL}/auth/cancel-verification`,
      { email }
    );
  }

  checkSession(): Observable<SessionResponse> {
    return this.http.get<SessionResponse>(`${API_URL}/auth/session`).pipe(
      tap(response => {
        if (response.isValid) {
          this._isAuthenticated.set(true);
          this._currentAdmin.set(response.admin);
        } else {
          this.clearSession();
        }
      }),
      catchError(err => {
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  logout(): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${API_URL}/auth/logout`, {})
      .pipe(
        tap(() => this.clearSession()),
        catchError(err => {
          this.clearSession();
          return throwError(() => err);
        })
      );
  }

  saveSession(response: LoginResponse): void {
    localStorage.setItem('token', response.token);
    this._isAuthenticated.set(true);
    this._currentAdmin.set(response.admin);
  }

  clearSession(): void {
    localStorage.removeItem('token');
    this._isAuthenticated.set(false);
    this._currentAdmin.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }
}
