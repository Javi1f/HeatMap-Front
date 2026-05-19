/**
 * @file config.ts
 * @description Constantes de configuración generadas automáticamente en tiempo de build.
 *
 * Este archivo **no debe editarse a mano**. Es sobreescrito cada vez que se ejecuta
 * el script `set-env` (definido en `package.json`) antes de `npm start` / `npm build`.
 *
 * El script lee las variables de entorno `API_URL` y `ENCRYPTION_KEY` desde el
 * archivo `.env` de la raíz del proyecto y las inyecta aquí como constantes
 * tipadas, disponibles en toda la aplicación sin necesidad de `import.meta.env`.
 *
 * @example
 * // .env
 * API_URL=https://mi-backend.com
 * ENCRYPTION_KEY=e886102e...
 *
 * // Resultado generado:
 * export const apiUrl = "https://mi-backend.com/api";
 * export const encryptionKey = "e886102e...";
 */

/**
 * URL base para todas las llamadas HTTP a la API REST.
 * Incluye el segmento `/api` al final; no añadir barra final en los servicios.
 *
 * @example `${apiUrl}/auth/login`  →  `https://host/api/auth/login`
 */
export const apiUrl="http://localhost:3000/api";

/**
 * Clave de cifrado AES-256-GCM compartida entre frontend y backend.
 * Representada como cadena hexadecimal de 64 caracteres (256 bits).
 *
 * ⚠️  Debe coincidir exactamente con `FRONTEND_ENCRYPTION_KEY` del backend.
 * ⚠️  Nunca exponer en logs, errores ni bundlers con source-maps en producción.
 */
export const encryptionKey="e886102e06ff0b1ac8e972ba11600e4f183d13f8dc35c2a79f44dac8cc68900e";
