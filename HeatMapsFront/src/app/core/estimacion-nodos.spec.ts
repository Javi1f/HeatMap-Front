import {
  DISPOSITIVOS_POR_NODO,
  DISPOSITIVOS_POR_PERSONA,
  ETIQUETAS_TIPO_RECINTO,
  estimarNodos,
  EVENTOS_PARA_DOS_RESPALDOS,
  EVENTOS_PARA_RESPALDO,
  integracionesDe,
  lecturaViva,
  M2_POR_NODO,
  NODOS_MINIMOS,
} from './estimacion-nodos';

/** Recinto del tamaño del piloto de la plazoleta. */
const plazoleta = () => ({
  tipoRecinto: 'plaza-publica' as const,
  areaM2: 248,
  aforoMinimo: 50,
  aforoMaximo: 300,
  eventosAnuales: 24,
  requisitos: { camaras: false, analisisRed: false, seguridadPrivada: false, ventilacionRemota: false },
});

describe('estimarNodos', () => {
  it('reproduce el piloto de la plazoleta con tres nodos', () => {
    expect(estimarNodos(plazoleta()).nodos).toBe(3);
  });

  it('cada línea del desglose lleva su porqué', () => {
    for (const linea of estimarNodos(plazoleta()).desglose) {
      expect(linea.detalle.length).toBeGreaterThan(20);
    }
  });

  it('el aforo se traduce a dispositivos antes de estimar', () => {
    expect(estimarNodos(plazoleta()).dispositivosEstimados).toBe(
      Math.ceil(300 * DISPOSITIVOS_POR_PERSONA),
    );
  });

  it('los eventos anuales piden nodos de repuesto, nunca de cobertura', () => {
    const conUno = estimarNodos({ ...plazoleta(), eventosAnuales: EVENTOS_PARA_RESPALDO });
    const conDos = estimarNodos({ ...plazoleta(), eventosAnuales: EVENTOS_PARA_DOS_RESPALDOS });
    expect(conUno.nodosRespaldo).toBe(1);
    expect(conDos.nodosRespaldo).toBe(2);
  });

  it('los requisitos declarados se convierten en integraciones', () => {
    const integraciones = integracionesDe({
      camaras: true,
      analisisRed: false,
      seguridadPrivada: true,
      ventilacionRemota: true,
    });
    expect(integraciones).toHaveLength(3);
    expect(integraciones.join(' ')).toContain('ventilación remoto');
  });

  it('declara siempre que es una estimación preliminar', () => {
    expect(estimarNodos(plazoleta()).notas.join(' ')).toMatch(/preliminar/i);
  });

  it('la espejo con el backend mantiene las mismas constantes', () => {
    // Si este test falla, la lectura viva del formulario ya no coincide con
    // lo que el backend guardará: actualizar las dos copias juntas.
    expect(M2_POR_NODO).toEqual({
      'plaza-publica': 85,
      auditorio: 75,
      'centro-convenciones': 85,
      universidad: 70,
      estadio: 110,
      'centro-comercial': 65,
      otro: 80,
    });
    expect(DISPOSITIVOS_POR_NODO).toBe(400);
    expect(NODOS_MINIMOS).toBe(3);
  });

  it('cada tipo de recinto tiene etiqueta e icono para el formulario', () => {
    for (const clave of Object.keys(M2_POR_NODO)) {
      expect(ETIQUETAS_TIPO_RECINTO[clave as keyof typeof M2_POR_NODO]?.nombre).toBeTruthy();
      expect(ETIQUETAS_TIPO_RECINTO[clave as keyof typeof M2_POR_NODO]?.ayuda).toBeTruthy();
    }
  });
});

describe('lecturaViva', () => {
  it('no responde nada mientras no se elija el tipo de recinto', () => {
    const lectura = lecturaViva({
      tipoRecinto: '',
      areaM2: '300',
      aforoMaximo: '500',
      eventosAnuales: '',
      requisitos: { camaras: false, analisisRed: false, seguridadPrivada: false, ventilacionRemota: false },
    });
    expect(lectura.nodos).toBeNull();
    expect(lectura.desglose).toHaveLength(0);
    expect(lectura.pendiente).toMatch(/tipo de recinto/i);
  });

  it('responde por el área en cuanto hay tipo y área', () => {
    const lectura = lecturaViva({
      tipoRecinto: 'auditorio',
      areaM2: '750',
      aforoMaximo: '',
      eventosAnuales: '',
      requisitos: { camaras: false, analisisRed: false, seguridadPrivada: false, ventilacionRemota: false },
    });
    expect(lectura.desglose).toHaveLength(1);
    expect(lectura.desglose[0].valor).toBe(`${Math.ceil(750 / M2_POR_NODO.auditorio)} nodos`);
    expect(lectura.pendiente).toMatch(/aforo máximo/i);
  });

  it('con área y aforo responde los nodos totales, respetando el mínimo', () => {
    const lectura = lecturaViva({
      tipoRecinto: 'auditorio',
      areaM2: '100',
      aforoMaximo: '50',
      eventosAnuales: '',
      requisitos: { camaras: false, analisisRed: false, seguridadPrivada: false, ventilacionRemota: false },
    });
    expect(lectura.nodos).toBe(NODOS_MINIMOS);
    expect(lectura.lista).toBe(false);
  });
});
