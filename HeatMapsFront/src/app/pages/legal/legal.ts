/**
 * @file legal.ts
 * @description Apartado legal del sitio (`/legal/*`).
 *
 * Reúne en una sola superficie de lectura los documentos que hacen visible el
 * cumplimiento normativo del sistema, conforme a la Ley 1581 de 2012 (régimen
 * de protección de datos personales), al Decreto 1377 de 2013 y a la vigilancia
 * de la Superintendencia de Industria y Comercio (SIC):
 *
 * 1. **Política de Privacidad y Tratamiento de Datos Personales**
 *    (`/legal/privacidad`) — responsable, finalidades, derechos y canal.
 * 2. **Aviso Legal** (`/legal/aviso`) — identificación del titular del sitio.
 * 3. **Términos y Condiciones de Uso** (`/legal/terminos`) — reglas de uso,
 *    propiedad intelectual, responsabilidad y jurisdicción.
 * 4. **Política de Cookies** (`/legal/cookies`) — cookies y almacenamiento
 *    local del navegador.
 *
 * Los cuatro documentos comparten este único componente: cada ruta fija en su
 * `data` cuál se muestra (`documento`), la maqueta es idéntica y el contenido
 * vive en la plantilla. No hay superficie que recoja datos aquí: la única que
 * los pide es el registro, y la autorización se pide en la propia casilla del
 * formulario (`register.html`) enlazada a la política.
 *
 * ## Navegación entre documentos
 * La lista de fichas alimenta el conmutador bajo el encabezado. Cada ruta
 * destruye y crea la instancia, así que se lee la `data` del `snapshot`: no
 * hay parámetro que siga vivo dentro de un mismo componente.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';

/** Identificadores válidos de los documentos del apartado legal. */
export type DocumentoLegal = 'privacidad' | 'aviso' | 'terminos' | 'cookies';

/**
 * Descripción estable de cada documento legal: alimenta el conmutador, el
 * encabezado de la página y la lista de «otros documentos» al pie.
 */
export interface FichaLegal {
  /** Identificador interno, igual al `documento` fijado en la ruta. */
  id: DocumentoLegal;
  /** Ruta completa dentro de la aplicación. */
  ruta: string;
  /** Etiqueta corta del conmutador. */
  etiqueta: string;
  /** Icono de Material Icons para el conmutador y las filas de otros. */
  icono: string;
  /** Título completo que encabeza el documento. */
  titulo: string;
  /** Antetítulo de una o dos frases bajo el título. */
  resumen: string;
  /** Propósito en una línea, para la fila del bloque de otros documentos. */
  proposito: string;
}

/** Catálogo de los documentos del apartado, mantenido en un solo sitio. */
const FICHAS: FichaLegal[] = [
  {
    id: 'privacidad',
    ruta: '/legal/privacidad',
    etiqueta: 'Privacidad',
    icono: 'verified_user',
    titulo: 'Política de Privacidad y Tratamiento de Datos Personales',
    resumen:
      'Qué información recoge PlaceAt, para qué la usa, cuánto tiempo la conserva y cómo ' +
      'puede usted conocerla, corregirla o eliminarla.',
    proposito: 'Los datos que usamos y sus derechos',
  },
  {
    id: 'aviso',
    ruta: '/legal/aviso',
    etiqueta: 'Aviso legal',
    icono: 'badge',
    titulo: 'Aviso Legal e Identificación del Titular',
    resumen:
      'Quién opera el sitio PlaceAt, a qué responde el servicio y con qué proveedores ' +
      'trabajamos para mantenerlo en línea.',
    proposito: 'Titularidad, contacto y terceros',
  },
  {
    id: 'terminos',
    ruta: '/legal/terminos',
    etiqueta: 'Términos',
    icono: 'gavel',
    titulo: 'Términos y Condiciones de Uso',
    resumen:
      'Las reglas de uso del sitio y del panel, lo que puede esperar del servicio y los ' +
      'límites de nuestra responsabilidad.',
    proposito: 'Reglas de uso y responsabilidad',
  },
  {
    id: 'cookies',
    ruta: '/legal/cookies',
    etiqueta: 'Cookies',
    icono: 'toggle_on',
    titulo: 'Política de Cookies y Almacenamiento Local',
    resumen:
      'El navegador guarda tres cosas cuando usted usa el sitio: qué son, para qué sirven y ' +
      'cómo borrarlas o bloquearlas.',
    proposito: 'El almacenamiento del navegador',
  },
];

/**
 * Rótulos del sello de versión del encabezado: el apartado legal se publica y
 * se versiona en conjunto, y el sello queda fijo en su esquina.
 */
const VERSION = {
  codigo: 'Versión 1.0',
  sello: 'Vigente 10 OCT 2026',
};

/**
 * Superficie de lectura de los documentos legales. El documento concreto lo
 * fija la ruta mediante `data.documento`; el conmutador de la plantilla viaja
 * entre ellos sin recargar la superficie base.
 */
@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './legal.html',
  styleUrl: './legal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Legal {
  /**
   * Ruta actual. Va primero porque el signal del documento se inicializa con
   * ella: los inicializadores corren en orden de declaración.
   */
  private readonly activatedRoute = inject(ActivatedRoute);

  /** Documento que debe renderizar la ruta actual, según su `data`. */
  readonly documento = signal<DocumentoLegal>(
    (this.activatedRoute.snapshot.data?.['documento'] as DocumentoLegal | undefined) ?? 'privacidad',
  );

  /** Ficha del documento activo: título, resumen e icono del encabezado. */
  readonly ficha = computed<FichaLegal>(
    () => FICHAS.find((ficha) => ficha.id === this.documento()) ?? FICHAS[0],
  );

  /** Las otras tres fichas, para el bloque de documentos hermanos. */
  readonly relacionados = computed<FichaLegal[]>(() =>
    FICHAS.filter((ficha) => ficha.id !== this.documento()),
  );

  /** Las cuatro fichas, en orden de publicación, para el conmutador. */
  readonly fichas = FICHAS;

  /** Año de publicación, citado por la cláusula de propiedad intelectual. */
  readonly anio = new Date().getFullYear();

  /** Rótulos de versión del encabezado. */
  readonly version = VERSION;
}
