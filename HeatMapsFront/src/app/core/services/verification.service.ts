import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VerificationService {
  attemptsLeft = signal<number>(3);
  verificationError = signal<string>('');

  handleServerError(serverAttemptsLeft: number): void {
    this.attemptsLeft.set(serverAttemptsLeft);
    if (serverAttemptsLeft === 0) {
      this.verificationError.set('Has agotado todos los intentos.');
    } else {
      const s = serverAttemptsLeft === 1 ? '' : 's';
      this.verificationError.set(
        `Código incorrecto. Te quedan ${serverAttemptsLeft} intento${s}.`
      );
    }
  }

  reset(): void {
    this.attemptsLeft.set(3);
    this.verificationError.set('');
  }
}
