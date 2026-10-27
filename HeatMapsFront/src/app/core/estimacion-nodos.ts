/**
 * @file estimacion-nodos.ts
 * @description Estimación de nodos del lado del cliente para el módulo de
 * cotización.
 *
 * **Espejo de `HeatMap-Back/src/modules/cotizacion/estimacion.ts`.** Las
 * constantes deben cambiar juntas: el panel «Tu lectura» calcula en vivo
 * con este módulo, y el backend recalcula con autoridad al recibir la
 * solicitud. Si las dos copias se separan, el cliente vería una cifra y
 * guardaría otra.
 *
 * De dónde salen las constantes (igual que en el backend): del piloto de la
 * plazoleta — tres nodos cubrieron 248,6 m², ≈ 83 m² por nodo en aire
 * libre, con la exigencia de que dos nodos oigan a cada dispositivo.
 */

/** Tipos de recinto que el formulario conoce. Debe coincidir con el backend. */
export const TIPOS_RECINTO = [
  'auditorio',
  'centro-convenciones',
  'universidad',
  'estadio',
  'centro-comercial',
  'plaza-publica',
  'otro',
] as const;

/** Clase de recinto descrita por el cliente. */
export type TipoRecinto = (typeof TIPOS_RECINTO)[number];

/**
 * Área efectiva planificada por nodo, en m², por tipo de recinto.
 *
 * Incluye el solape de triangulación: la presencia exige que al menos dos
 * nodos oigan cada dispositivo. Los interiores bajan porque muros, butas y
 * entrepisos atenúan la señal; los graderíos abiertos suben.
 */
export const M2_POR_NODO: Record<TipoRecinto, number> = {
  'plaza-publica': 85,
  auditorio: 75,
  'centro-convenciones': 85,
  universidad: 70,
  estadio: 110,
  'centro-comercial': 65,
  otro: 80,
};

/** Dispositivos simultáneos que un nodo procesa con margen holgado. */
export const DISPOSITIVOS_POR_NODO = 400;

/** Dispositivos estimados por persona: el sistema cuenta dispositivos. */
export const DISPOSITIVOS_POR_PERSONA = 0.9;

/** Mínimo de nodos: el del piloto, que sostiene la triangulación. */
export const NODOS_MINIMOS = 3;

/** Eventos al año a partir de los que conviene un nodo de repuesto. */
export const EVENTOS_PARA_RESPALDO = 100;

/** Y a partir de los que convienen dos. */
export const EVENTOS_PARA_DOS_RESPALDOS = 250;

/** Etiquetas de cada tipo de recinto, en el lenguaje del posible cliente. */
export const ETIQUETAS_TIPO_RECINTO: Record<TipoRecinto, { nombre: string; icono: string; ayuda: string }> = {
  auditorio: {
    nombre: 'Auditorio',
    icono: 'theater_comedy',
    ayuda: 'Un salón con butas, escenario o gradería fija.',
  },
  'centro-convenciones': {
    nombre: 'Centro de convenciones',
    icono: 'domain',
    ayuda: 'Salones múltiples que se dividen y se unen según el evento.',
  },
  universidad: {
    nombre: 'Universidad o campus',
    icono: 'school',
    ayuda: 'Aulas, pasillos y zonas comunes de un campus.',
  },
  estadio: {
    nombre: 'Estadio',
    icono: 'stadium',
    ayuda: 'Graderías amplias, preferiblemente al aire libre.',
  },
  'centro-comercial': {
    nombre: 'Centro comercial',
    icono: 'storefront',
    ayuda: 'Varios pisos de circulación continua de visitantes.',
  },
  'plaza-publica': {
    nombre: 'Plaza o espacio abierto',
    icono: 'park',
    ayuda: 'Aire libre sin muros: la señal viaja mejor y el nodo alcanza más lejos.',
  },
  otro: {
    nombre: 'Otro recinto',
    icono: 'apartment',
    ayuda: 'Cuéntanoslo en tus notas y el equipo lo levanta en la visita.',
  },
};

/** Una línea del desglose: la cifra y su porqué. */
export interface LineaDesglose {
  titulo: string;
  valor: string;
  detalle: string;
}

/** Estimación completa, tal como la devuelve el estimador. */
export interface EstimacionCotizacion {
  nodos: number;
  nodosOperativos: number;
  nodosRespaldo: number;
  dispositivosEstimados: number;
  m2PorNodo: number;
  desglose: LineaDesglose[];
  integraciones: string[];
  notas: string[];
}

/** Lo que el estimador necesita para responder. */
export interface EntradaEstimacion {
  tipoRecinto: TipoRecinto;
  areaM2: number;
  aforoMinimo: number;
  aforoMaximo: number;
  eventosAnuales: number;
  requisitos: Requisitos;
}

/** Requisitos especiales que el formulario pregunta. */
export interface Requisitos {
  camaras: boolean;
  analisisRed: boolean;
  seguridadPrivada: boolean;
  ventilacionRemota: boolean;
  notas?: string;
}

/** Texto fijo de cada integración, en el vocabulario del sistema. */
export const INTEGRACIONES: Array<{ clave: keyof Omit<Requisitos, 'notas'>; titulo: string; texto: string }> = [
  { clave: 'camaras', titulo: 'Cámaras existentes', texto: 'Enlace con el sistema de cámaras existente: referencias para verificar el aforo en sitio.' },
  { clave: 'analisisRed', titulo: 'Análisis de red', texto: 'Correlación con la herramienta de análisis de red que ya opera el recinto.' },
  { clave: 'seguridadPrivada', titulo: 'Seguridad privada', texto: 'Puente con el centro de seguridad privada: las alertas de aglomeración entran a su flujo de operación.' },
  { clave: 'ventilacionRemota', titulo: 'Ventilación remota', texto: 'Conexión del sistema de ventilación remoto a las alertas de ocupación del sistema.' },
];

/** Integraciones que pide un conjunto de requisitos, en orden fijo. */
export const integracionesDe = (requisitos: Requisitos): string[] =>
  INTEGRACIONES.filter(({ clave }) => requisitos[clave]).map(({ texto }) => texto);

/**
 * Estima los nodos de un despliegue completo. Espeja la función del backend:
 * la cifra que aquí se muestra en vivo debe ser la que se guarda.
 */
export const estimarNodos = (entrada: EntradaEstimacion): EstimacionCotizacion => {
  const m2PorNodo = M2_POR_NODO[entrada.tipoRecinto];
  const porArea = Math.ceil(entrada.areaM2 / m2PorNodo);

  const dispositivos = Math.ceil(entrada.aforoMaximo * DISPOSITIVOS_POR_PERSONA);
  const porAforo = Math.ceil(dispositivos / DISPOSITIVOS_POR_NODO);

  const operativos = Math.max(NODOS_MINIMOS, porArea, porAforo);
  const respaldo =
    entrada.eventosAnuales >= EVENTOS_PARA_DOS_RESPALDOS ? 2 :
    entrada.eventosAnuales >= EVENTOS_PARA_RESPALDO ? 1 : 0;

  const desglose: LineaDesglose[] = [
    {
      titulo: 'Por el área',
      valor: `${porArea} ${porArea === 1 ? 'nodo' : 'nodos'}`,
      detalle:
        `${entrada.areaM2.toLocaleString('es-CO')} m² ÷ ${m2PorNodo} m² por nodo, con el solape que exige ` +
        'que dos nodos oigan a cada dispositivo (la densidad viene del piloto de la plazoleta).',
    },
    {
      titulo: 'Por el aforo',
      valor: `${porAforo} ${porAforo === 1 ? 'nodo' : 'nodos'}`,
      detalle:
        `Aforo máximo ${entrada.aforoMaximo.toLocaleString('es-CO')} ≈ ${dispositivos.toLocaleString('es-CO')} dispositivos ` +
        `en el pico (el sistema cuenta dispositivos, no personas) ÷ ${DISPOSITIVOS_POR_NODO} por nodo.`,
    },
    {
      titulo: 'Mínimo del piloto',
      valor: `${NODOS_MINIMOS} nodos`,
      detalle:
        'La posición se estima cruzando señales de al menos dos nodos; con tres hay redundancia ' +
        'y el error no favorece a ninguna mitad del espacio.',
    },
  ];

  if (respaldo > 0) {
    desglose.push({
      titulo: 'Nodos de repuesto',
      valor: `${respaldo} ${respaldo === 1 ? 'nodo' : 'nodos'}`,
      detalle:
        `Con ${entrada.eventosAnuales.toLocaleString('es-CO')} eventos al año conviene un repuesto para reemplazar ` +
        'un nodo caído sin esperar logística.',
    });
  }

  const integraciones = integracionesDe(entrada.requisitos);

  const notas = [
    'Cada nodo es una Raspberry Pi con Kismet: hardware commodity, sin obra civil.',
    'El sistema cuenta dispositivos, no personas: el aforo se traduce a dispositivos antes de estimar.',
    'Estimación preliminar generada automáticamente; el equipo comercial la refina con un levantamiento en sitio.',
  ];
  if (operativos > 60) {
    notas.push(
      'Cobertura completa de un recinto tan grande se despliega por fases: el equipo comercial propone una fase inicial con las zonas de mayor afluencia.',
    );
  }

  return {
    nodos: operativos + respaldo,
    nodosOperativos: operativos,
    nodosRespaldo: respaldo,
    dispositivosEstimados: dispositivos,
    m2PorNodo,
    desglose,
    integraciones,
    notas,
  };
};

/** Lo que la lectura viva puede responder con lo que ya se contestó. */
export interface LecturaViva {
  /** `true` cuando el recinto ya está descrito por completo. */
  lista: boolean;
  /** Nodos totales estimados; `null` mientras falte algo. */
  nodos: number | null;
  /** Dispositivos esperados en el pico; `null` si falta el aforo. */
  dispositivos: number | null;
  /** Líneas que ya se pueden explicar con lo respondido. */
  desglose: LineaDesglose[];
  /** Integraciones que ya se han marcado. */
  integraciones: string[];
  /** Qué falta para completar la lectura, en lenguaje llano. */
  pendiente: string;
}

/** Valores parciales del formulario, con los números aún como texto. */
export interface ValoresParciales {
  tipoRecinto: TipoRecinto | '';
  areaM2: string | number;
  aforoMaximo: string | number;
  eventosAnuales: string | number;
  requisitos: Requisitos;
}

/**
 * Convierte lo que lleva respondido el formulario en una lectura parcial.
 *
 * A diferencia de {@link estimarNodos}, tolera lo que falta: cada línea del
 * desglose aparece solo cuando los datos que la explican ya existen, y el
 * rótulo de pendiente dice qué falta en lenguaje llano.
 */
export const lecturaViva = (valores: ValoresParciales): LecturaViva => {
  const area = Number(valores.areaM2);
  const aforo = Number(valores.aforoMaximo);
  const eventos = Number(valores.eventosAnuales);
  const hayTipo = valores.tipoRecinto !== '';
  const hayArea = hayTipo && area > 0;
  const hayAforo = hayTipo && aforo > 0;

  const desglose: LineaDesglose[] = [];
  if (hayArea) {
    desglose.push({
      titulo: 'Por el área',
      valor: `${Math.ceil(area / M2_POR_NODO[valores.tipoRecinto as TipoRecinto])} nodos`,
      detalle: `${area.toLocaleString('es-CO')} m² ÷ ${M2_POR_NODO[valores.tipoRecinto as TipoRecinto]} m² por nodo.`,
    });
  }
  if (hayAforo) {
    const dispositivos = Math.ceil(aforo * DISPOSITIVOS_POR_PERSONA);
    desglose.push({
      titulo: 'Por el aforo',
      valor: `${Math.ceil(dispositivos / DISPOSITIVOS_POR_NODO)} nodos`,
      detalle: `≈ ${dispositivos.toLocaleString('es-CO')} dispositivos en el pico ÷ ${DISPOSITIVOS_POR_NODO} por nodo.`,
    });
  }

  const pendiente = !hayTipo
    ? 'Elige el tipo de recinto para empezar la lectura.'
    : !hayArea
      ? 'Falta el área aproximada.'
      : !hayAforo
        ? 'Falta el aforo máximo esperado.'
        : '';

  return {
    lista: hayArea && hayAforo && eventos > 0,
    nodos: hayArea && hayAforo
      ? Math.max(
          NODOS_MINIMOS,
          Math.ceil(area / M2_POR_NODO[valores.tipoRecinto as TipoRecinto]),
          Math.ceil(aforo * DISPOSITIVOS_POR_PERSONA / DISPOSITIVOS_POR_NODO),
        )
      : null,
    dispositivos: hayAforo ? Math.ceil(aforo * DISPOSITIVOS_POR_PERSONA) : null,
    desglose,
    integraciones: integracionesDe(valores.requisitos),
    pendiente,
  };
};
