/**
 * Genera `src/app/core/config.ts` a partir del `.env`.
 *
 * Angular no lee variables de entorno en tiempo de ejecución: el bundle es
 * estático y se sirve desde un CDN. Por eso la configuración se materializa
 * como un módulo TypeScript antes de compilar, y este script se engancha a
 * `prestart` y `prebuild` para que nunca se compile con un `config.ts` obsoleto.
 *
 * Falla de forma explícita si falta alguna variable: preferimos no arrancar a
 * arrancar apuntando a un backend equivocado o sin clave de cifrado.
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config();

/** Ruta del módulo generado, relativa a la raíz del proyecto. */
const OUTPUT = path.join('src', 'app', 'core', 'config.ts');

/** Variables que deben estar definidas en el `.env`. */
const REQUIRED = ['API_URL', 'ENCRYPTION_KEY'];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  process.stderr.write(`ERROR: faltan ${missing.join(', ')} en .env\n`);
  process.exit(1);
}

const contents = [
  '/**',
  ' * @file config.ts',
  ' * @description Configuración de compilación generada automáticamente.',
  ' *',
  ' * NO EDITAR A MANO: lo reescribe `npm run set-env` en cada `start` y `build`',
  ' * a partir del `.env`. Cualquier cambio manual se pierde en la siguiente',
  ' * compilación.',
  ' */',
  '',
  '/** URL base de la API REST, con el sufijo `/api` ya incluido. */',
  `export const apiUrl = ${JSON.stringify(`${process.env.API_URL}/api`)};`,
  '',
  '/** Clave AES-256-GCM compartida con el backend para cifrar los payloads. */',
  `export const encryptionKey = ${JSON.stringify(process.env.ENCRYPTION_KEY)};`,
  '',
].join('\n');

fs.writeFileSync(OUTPUT, contents);
// `process.stdout` y no `console`: esto es un script de Node del proceso de
// compilación, no código que llegue al navegador, y así queda dicho también
// para quien lo lea.
process.stdout.write('config.ts generado desde .env\n');
