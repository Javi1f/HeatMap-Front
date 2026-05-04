import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, of, switchMap, catchError, throwError, map } from 'rxjs';
import { CryptoService } from '../crypto/crypto.service';

export const cryptoInterceptor: HttpInterceptorFn = (req, next) => {
  const crypto = inject(CryptoService);

  const encryptRequest$ = req.body !== null
    ? from(crypto.encrypt(req.body)).pipe(
      map(encrypted => req.clone({ body: { data: encrypted } }))
    )
    : of(req);

  return encryptRequest$.pipe(
    switchMap(encryptedReq => next(encryptedReq)),
    switchMap(event => {
      if (
        event instanceof HttpResponse &&
        event.body !== null &&
        typeof event.body === 'object' &&
        'data' in event.body
      ) {
        const body = event.body as { data: string };
        return from(crypto.decrypt(body.data)).pipe(
          map(decrypted => event.clone({ body: decrypted }))
        );
      }
      return of(event);
    }),
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.error !== null &&
        typeof error.error === 'object' &&
        'data' in error.error
      ) {
        const errorBody = error.error as { data: string };
        return from(crypto.decrypt(errorBody.data)).pipe(
          switchMap(decrypted =>
            throwError(() => new HttpErrorResponse({
              error: decrypted,
              status: error.status,
              statusText: error.statusText,
              url: error.url ?? undefined,
              headers: error.headers
            }))
          )
        );
      }
      return throwError(() => error);
    })
  );
};
