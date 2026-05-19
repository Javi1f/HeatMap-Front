/**
 * @file crypto.service.ts
 * @description Servicio de cifrado/descifrado simétrico AES-256-GCM usando
 * la Web Crypto API nativa del navegador.
 *
 * ## Formato del payload cifrado
 * El backend espera (y produce) un buffer con la siguiente estructura binaria,
 * codificada en Base64 para su transporte como JSON:
 *
 * ```
 * [ iv (12 bytes) | authTag (16 bytes) | ciphertext (N bytes) ]
 * ```
 *
 * La Web Crypto API entrega el resultado de `encrypt` como `ciphertext + authTag`,
 * por lo que es necesario reordenar antes de empaquetar y al desempaquetar.
 *
 * @see {@link CryptoInterceptor} — usa este servicio de forma transparente en todas
 * las peticiones y respuestas HTTP bajo `/api/*` y `/kafka/*`.
 */

import { Injectable } from '@angular/core';
import { encryptionKey } from '../config';

/**
 * Servicio singleton que encapsula la criptografía de capa de aplicación.
 *
 * Importa la clave AES-256 una única vez al instanciarse (lazy via Promise) y
 * la reutiliza en todas las operaciones de cifrado/descifrado del ciclo de vida
 * de la aplicación, evitando el coste de `importKey` en cada petición.
 */
@Injectable({ providedIn: 'root' })
export class CryptoService {
  /**
   * Promise que resuelve la `CryptoKey` importada.
   * Se inicializa una sola vez en la construcción del servicio; todas las
   * operaciones hacen `await` sobre ella, por lo que son seguras aunque la
   * importación no haya terminado todavía.
   */
  private keyPromise: Promise<CryptoKey> = this.importKey();

  /**
   * Importa la clave hexadecimal de configuración como `CryptoKey` AES-GCM.
   *
   * La clave se marca como `extractable: false` para impedir que el material
   * crudo sea exportado desde el contexto del browser una vez importado.
   *
   * @returns Promise que resuelve la `CryptoKey` lista para usar.
   */
  private async importKey(): Promise<CryptoKey> {
    const hex = encryptionKey;
    const keyBytes = Uint8Array.from(
      hex.match(/.{2}/g)!.map(b => parseInt(b, 16))
    );
    return crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,                          // extractable: false — no exportable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Cifra un objeto arbitrario con AES-256-GCM y lo devuelve en Base64.
   *
   * Pasos internos:
   * 1. Serializa `data` a JSON y codifica como UTF-8.
   * 2. Genera un IV aleatorio de 12 bytes con CSPRNG.
   * 3. Cifra con AES-GCM (tag de 128 bits).
   * 4. Reordena el buffer al formato `iv | authTag | ciphertext`.
   * 5. Codifica el resultado en Base64.
   *
   * @param data - Cualquier valor serializable a JSON (objetos, arrays, primitivos).
   * @returns Base64 del buffer `iv (12B) | authTag (16B) | ciphertext (NB)`.
   */
  async encrypt(data: unknown): Promise<string> {
    const key = await this.keyPromise;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(data));

    // Web Crypto devuelve ciphertext+authTag concatenados
    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plain)
    );

    // Separar ciphertext y authTag (los últimos 16 bytes)
    const ciphertext = encrypted.slice(0, encrypted.length - 16);
    const authTag    = encrypted.slice(encrypted.length - 16);

    // Reordenar al layout esperado por el backend: iv | authTag | ciphertext
    const combined = new Uint8Array(12 + 16 + ciphertext.length);
    combined.set(iv,         0);
    combined.set(authTag,    12);
    combined.set(ciphertext, 28);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Descifra un payload Base64 producido por el backend (o por {@link encrypt})
   * y lo devuelve parseado como tipo `T`.
   *
   * Pasos internos:
   * 1. Decodifica Base64 a `Uint8Array`.
   * 2. Extrae `iv` (bytes 0-11), `authTag` (bytes 12-27) y `ciphertext` (bytes 28+).
   * 3. Reordena al layout de Web Crypto: `ciphertext | authTag`.
   * 4. Descifra con AES-GCM; cualquier modificación del payload lanza error.
   * 5. Decodifica UTF-8 y parsea JSON.
   *
   * @typeParam T - Tipo esperado del objeto JSON descifrado. Por defecto `unknown`.
   * @param base64 - Cadena Base64 con el layout `iv | authTag | ciphertext`.
   * @returns El objeto descifrado y parseado como `T`.
   * @throws `DOMException` si el authTag no coincide (tamper detection) o la clave es incorrecta.
   */
  async decrypt<T = unknown>(base64: string): Promise<T> {
    const key = await this.keyPromise;
    const buf = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    // Extraer las tres partes del buffer
    const iv         = buf.slice(0, 12);
    const authTag    = buf.slice(12, 28);
    const ciphertext = buf.slice(28);

    // Reordenar al layout de Web Crypto: ciphertext | authTag
    const combined = new Uint8Array(ciphertext.length + 16);
    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);

    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      combined
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  }
}
