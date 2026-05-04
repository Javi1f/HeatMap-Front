import { Injectable } from '@angular/core';
import { encryptionKey } from '../config';

@Injectable({ providedIn: 'root' })
export class CryptoService {
  private keyPromise: Promise<CryptoKey> = this.importKey();

  private async importKey(): Promise<CryptoKey> {
    const hex = encryptionKey;
    const keyBytes = Uint8Array.from(
      hex.match(/.{2}/g)!.map(b => parseInt(b, 16))
    );
    return crypto.subtle.importKey(
      'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
  }

  async encrypt(data: unknown): Promise<string> {
    const key = await this.keyPromise;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(data));

    // Web Crypto devuelve: ciphertext || authTag (authTag = últimos 16 bytes)
    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plain)
    );

    const ciphertext = encrypted.slice(0, encrypted.length - 16);
    const authTag    = encrypted.slice(encrypted.length - 16);

    // Formato del backend: IV(12) | AuthTag(16) | Ciphertext(N)
    const combined = new Uint8Array(12 + 16 + ciphertext.length);
    combined.set(iv,         0);
    combined.set(authTag,    12);
    combined.set(ciphertext, 28);

    return btoa(String.fromCharCode(...combined));
  }

  async decrypt<T = unknown>(base64: string): Promise<T> {
    const key = await this.keyPromise;
    const buf = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    const iv         = buf.slice(0, 12);
    const authTag    = buf.slice(12, 28);
    const ciphertext = buf.slice(28);

    // Web Crypto espera: ciphertext || authTag
    const combined = new Uint8Array(ciphertext.length + 16);
    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);

    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 }, key, combined
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  }
}
