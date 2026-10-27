/**
 * @file cotizacion.ts
 * @description Formulario asistido de solicitud de cotización (`/cotizacion`).
 *
 * Es la puerta comercial del sistema y se entra sin sesión: cualquier
 * responsable de recinto describe su espacio en cuatro pasos y el sistema
 * estima los nodos delante de sus ojos.
 *
 * ## Cómo está armado
 *  - Un solo `FormGroup` con todo el formulario; cada paso valida solo sus
 *    campos, y «Anterior» nunca exige nada (nadie queda prisionero de un paso).
 *  - El panel «Tu lectura» recalcula en vivo con {@link lecturaViva}: cada
 *    cifra aparece cuando los datos que la explican ya existen, con su porqué.
 *    Es el espejo del estimador del backend —la cifra que aquí se ve es la
 *    que se guarda—, y la versión del servidor es la autoridad.
 *  - Los campos no técnicos (área, aforo, eventos) llegan con comparaciones
 *    de referencia: aulas, canchas, ritmos de calendario. La idea es que
 *    quien no sabe de tecnología entienda qué se le pregunta y por qué.
 *
 * ## Datos personales
 * Solo piden contacto voluntario, con autorización expresa (art. 9, Ley 1581
 * de 2012). El correo viaja cifrado de extremo a extremo y queda cifrado en
 * la base; nada del formulario toca la medición del espacio.
 */

import { Component, inject, signal, Signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ETIQUETAS_TIPO_RECINTO,
  LecturaViva,
  TIPOS_RECINTO,
  TipoRecinto,
  lecturaViva,
} from '../../core/estimacion-nodos';
import {
  CotizacionService,
  SolicitudCotizacionPayload,
  SolicitudCreada,
  descargarJson,
} from '../../core/services/cotizacion.service';
import { ErrorCampoComponent } from '../register/error-campo/error-campo';
import { OndasComponent } from '../../shared/animacion/ondas';

/** Descripción de un paso del formulario, para el riel y los títulos. */
interface Paso {
  numero: number;
  titulo: string;
  icono: string;
  intro: string;
  /** Campos que el paso exige para poder continuar. */
  campos: string[];
}

/** Los cuatro pasos, en orden. El resumen vivo no es un paso: va siempre. */
const PASOS: Paso[] = [
  {
    numero: 1,
    titulo: 'Tu espacio',
    icono: 'meeting_room',
    intro: 'Cuéntanos qué recinto quieres escuchar. Con el área y el aforo, el sistema sabe cuántos nodos hacen falta.',
    campos: ['tipoRecinto', 'areaM2', 'aforoMinimo', 'aforoMaximo'],
  },
  {
    numero: 2,
    titulo: 'El ritmo',
    icono: 'event_repeat',
    intro: 'La frecuencia con la que el espacio se llena decide cuántos nodos de repuesto conviene tener.',
    campos: ['eventosAnuales'],
  },
  {
    numero: 3,
    titulo: 'Conexiones',
    icono: 'hub',
    intro: 'Si ya tienes otros sistemas, PlaceAt puede hablar con ellos. Nada de esto es obligatorio.',
    campos: [],
  },
  {
    numero: 4,
    titulo: 'Contacto',
    icono: 'badge',
    intro: 'Solo lo necesario para que el equipo comercial te escriba con la propuesta refinada.',
    campos: ['organizacion', 'nombreContacto', 'correoContacto', 'aceptaDatos'],
  },
];

/** Comparaciones de área que el usuario reconoce de una vez. */
const COMPARACIONES_AREA = [
  { etiqueta: 'Aula grande', m2: 80 },
  { etiqueta: 'Gimnasio', m2: 1_100 },
  { etiqueta: 'Cancha de fútbol', m2: 7_140 },
] as const;

/** Ritmos de eventos con su ejemplo de calendario. */
const COMPARACIONES_EVENTOS = [
  { etiqueta: 'Una vez al mes', valor: 12 },
  { etiqueta: 'Una vez a la semana', valor: 52 },
  { etiqueta: 'Dos a la semana', valor: 104 },
  { etiqueta: 'Casi a diario', valor: 365 },
] as const;

/** Mensaje por error de cada campo, en orden de prioridad. */
const MENSAJES_ERROR = {
  tipoRecinto: { required: 'Elige el tipo de recinto que más se parezca al tuyo.' },
  areaM2: { required: 'El área aproximada es obligatoria.', min: 'El área mínima es 10 m².', max: 'Ese área supera el límite del formulario; escríbenos directo.' },
  aforoMinimo: { required: 'El aforo mínimo es obligatorio.', min: 'Mínimo 1 persona.' },
  aforoMaximo: { required: 'El aforo máximo es obligatorio.', min: 'Mínimo 1 persona.', aforoIncoherente: 'El aforo máximo no puede ser menor que el mínimo.' },
  eventosAnuales: { required: 'El número de eventos al año es obligatorio.', min: 'Mínimo 1 evento al año.' },
  organizacion: { required: 'La organización es obligatoria.', minlength: 'Mínimo 2 caracteres.' },
  nombreContacto: { required: 'El nombre de contacto es obligatorio.', minlength: 'Mínimo 2 caracteres.' },
  correoContacto: { required: 'El correo es obligatorio.', email: 'Ingresa un correo válido.' },
  telefonoContacto: {},
  aceptaDatos: { required: 'Debes autorizar el tratamiento de datos para continuar.' },
} as const;

/**
 * Validador de grupo: el aforo máximo debe admitir al menos tanto como el
 * mínimo. Vive en el grupo porque compara dos controles.
 */
const aforoCoherente = (grupo: AbstractControl): ValidationErrors | null => {
  const minimo = Number(grupo.get('aforoMinimo')?.value);
  const maximo = Number(grupo.get('aforoMaximo')?.value);
  if (!minimo || !maximo) return null;
  return maximo >= minimo ? null : { aforoIncoherente: true };
};

/** Página de cotización: cuatro pasos, una lectura viva, un envío. */
@Component({
  selector: 'app-cotizacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ErrorCampoComponent, OndasComponent],
  templateUrl: './cotizacion.html',
  styleUrl: './cotizacion.css'
})
export class Cotizacion {
  /** Servicio de la API de cotización. */
  private cotizacionService = inject(CotizacionService);

  /** Pasos del formulario, para el riel y la plantilla. */
  readonly pasos = PASOS;

  /** Tipos de recinto en el orden del formulario, con su etiqueta didáctica. */
  readonly tipos = TIPOS_RECINTO.map((clave) => ({ clave, ...ETIQUETAS_TIPO_RECINTO[clave] }));

  /** Comparaciones de área y de ritmo, para los chips de ejemplo. */
  readonly comparacionesArea = COMPARACIONES_AREA;
  readonly comparacionesEventos = COMPARACIONES_EVENTOS;

  /** Conexiones que se pueden pedir, con su explicación en lenguaje llano. */
  readonly requisitosInfo = [
    {
      clave: 'camaras',
      icono: 'videocam',
      titulo: 'Cámaras existentes',
      detalle: 'Si el recinto ya tiene cámaras, pueden servir de referencia para verificar el aforo. PlaceAt no genera imagen ni necesita verlas.',
    },
    {
      clave: 'analisisRed',
      icono: 'lan',
      titulo: 'Análisis de red',
      detalle: 'Si ya analizan la red Wi-Fi del recinto, sus datos pueden cruzarse con las mediciones de ocupación.',
    },
    {
      clave: 'seguridadPrivada',
      icono: 'security',
      titulo: 'Seguridad privada',
      detalle: 'Las alertas de aglomeración pueden entrar al flujo del centro de seguridad, junto a lo que ya vigila.',
    },
    {
      clave: 'ventilacionRemota',
      icono: 'air',
      titulo: 'Ventilación remota',
      detalle: 'Si la ventilación se controla a distancia, se conecta a las alertas: cuando el sistema ve acumulación, se sabe dónde ventilar.',
    },
  ] as const;

  /** Mensajes de validación, para `app-error-campo`. */
  readonly mensajes = MENSAJES_ERROR;

  /** Paso visible ahora mismo. */
  paso = signal<number>(1);

  /** `true` mientras la solicitud viaja al servidor. */
  enviando = signal(false);

  /** Error del envío, vacío si no hay. */
  error = signal('');

  /** Respuesta del servidor tras el envío; con ella se muestra el éxito. */
  resultado = signal<SolicitudCreada | null>(null);

  /** El formulario completo: los cuatro pasos viven en un solo objeto. */
  form: FormGroup;

  /** Última fotografía de los valores, para la lectura viva. */
  private valoresFormulario!: Signal<any>;

  /** Acceso directo a los controles desde la plantilla. */
  get controles() { return this.form.controls as Record<string, AbstractControl>; }

  constructor() {
    this.form = new FormBuilder().group(
      {
        tipoRecinto: ['', Validators.required],
        areaM2: ['', [Validators.required, Validators.min(10), Validators.max(1_000_000)]],
        aforoMinimo: ['', [Validators.required, Validators.min(1)]],
        aforoMaximo: ['', [Validators.required, Validators.min(1)]],
        eventosAnuales: ['', [Validators.required, Validators.min(1), Validators.max(2_000)]],
        requisitos: new FormBuilder().group({
          camaras: [false],
          analisisRed: [false],
          seguridadPrivada: [false],
          ventilacionRemota: [false],
          notas: [''],
        }),
        organizacion: ['', [Validators.required, Validators.minLength(2)]],
        nombreContacto: ['', [Validators.required, Validators.minLength(2)]],
        correoContacto: ['', [Validators.required, Validators.email]],
        telefonoContacto: [''],
        /** Autorización previa, expresa e informada (art. 9, Ley 1581 de 2012). */
        aceptaDatos: [false, Validators.requiredTrue],
      },
      { validators: aforoCoherente },
    );

    this.valoresFormulario = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  }

  /** Lectura viva: lo que el estimador puede responder con lo ya respondido. */
  lectura(): LecturaViva {
    return lecturaViva(this.valoresFormulario());
  }

  /**
   * `true` si los campos del paso indicado están listos para avanzar.
   * El paso 3 no exige nada: las conexiones son opcionales.
   */
  private pasoValido(numero: number): boolean {
    if (numero === 1 && this.form.hasError('aforoIncoherente')) return false;
    return PASOS[numero - 1].campos.every((nombre) => this.controles[nombre]?.valid ?? true);
  }

  /**
   * Intenta avanzar al paso siguiente.
   *
   * Si el paso actual falla, marca sus campos tocados para que los mensajes
   * expliquen qué falta, y no avanza.
   */
  avanzar(): void {
    const actual = this.paso();
    if (!this.pasoValido(actual)) {
      for (const nombre of PASOS[actual - 1].campos) this.controles[nombre]?.markAsTouched();
      return;
    }
    this.paso.set(Math.min(actual + 1, PASOS.length));
    this.desenrollar();
  }

  /** Retrocede un paso; nunca exige nada para volver. */
  retroceder(): void {
    this.paso.set(Math.max(this.paso() - 1, 1));
    this.desenrollar();
  }

  /** Vuelve a un paso ya completado, haciendo clic en el riel. */
  irAPaso(numero: number): void {
    if (numero < this.paso()) {
      this.paso.set(numero);
      this.desenrollar();
    }
  }

  /** Rellena el área con una comparación de referencia. */
  ponerArea(m2: number): void {
    this.controles['areaM2'].setValue(m2);
    this.controles['areaM2'].markAsDirty();
    this.controles['areaM2'].markAsTouched();
  }

  /** Rellena el ritmo de eventos con una comparación de referencia. */
  ponerEventos(valor: number): void {
    this.controles['eventosAnuales'].setValue(valor);
    this.controles['eventosAnuales'].markAsDirty();
    this.controles['eventosAnuales'].markAsTouched();
  }

  /** Lleva la vista al pie del formulario cuando cambia de paso. */
  private desenrollar(): void {
    const panel = document.querySelector('.cotizacion .formulario');
    panel?.scrollIntoView?.({ block: 'nearest' });
  }

  /**
   * Envía la solicitud al backend.
   *
   * Convierte los números que llegaron como texto, omite el teléfono si
   * quedó vacío y manda la autorización tal cual la marcó el usuario.
   */
  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    const valores = this.form.value;
    const requisitos = valores.requisitos ?? {};
    const notas = String(requisitos.notas ?? '').trim();
    const telefono = String(valores.telefonoContacto ?? '').trim();

    const payload: SolicitudCotizacionPayload = {
      tipoRecinto: valores.tipoRecinto as TipoRecinto,
      organizacion: valores.organizacion,
      nombreContacto: valores.nombreContacto,
      correoContacto: valores.correoContacto,
      ...(telefono ? { telefonoContacto: telefono } : {}),
      areaM2: Number(valores.areaM2),
      aforoMinimo: Number(valores.aforoMinimo),
      aforoMaximo: Number(valores.aforoMaximo),
      eventosAnuales: Number(valores.eventosAnuales),
      requisitos: {
        camaras: Boolean(requisitos.camaras),
        analisisRed: Boolean(requisitos.analisisRed),
        seguridadPrivada: Boolean(requisitos.seguridadPrivada),
        ventilacionRemota: Boolean(requisitos.ventilacionRemota),
        ...(notas ? { notas } : {}),
      },
      aceptaDatos: true,
    };

    this.cotizacionService.enviar(payload).subscribe({
      next: (respuesta) => {
        this.resultado.set(respuesta.data);
        this.enviando.set(false);
        this.paso.set(5);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => {
        this.error.set('No se pudo enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.');
        this.enviando.set(false);
      },
    });
  }

  /** Descarga la copia de la solicitud como documento .json. */
  descargarCopia(): void {
    const resultado = this.resultado();
    if (!resultado) return;
    const valores = this.form.value;
    descargarJson(`solicitud-cotizacion-${resultado.idSolicitud.slice(0, 8)}`, {
      version: 1,
      idSolicitud: resultado.idSolicitud,
      recibida: new Date().toISOString(),
      solicitud: {
        tipoRecinto: valores.tipoRecinto,
        organizacion: valores.organizacion,
        nombreContacto: valores.nombreContacto,
        correoContacto: valores.correoContacto,
        telefonoContacto: valores.telefonoContacto || null,
        areaM2: Number(valores.areaM2),
        aforoMinimo: Number(valores.aforoMinimo),
        aforoMaximo: Number(valores.aforoMaximo),
        eventosAnuales: Number(valores.eventosAnuales),
        requisitos: valores.requisitos,
      },
      estimacion: resultado.estimacion,
    });
  }

  /** Empieza una solicitud nueva desde cero. */
  nuevaSolicitud(): void {
    this.form.reset({
      tipoRecinto: '',
      areaM2: '',
      aforoMinimo: '',
      aforoMaximo: '',
      eventosAnuales: '',
      requisitos: { camaras: false, analisisRed: false, seguridadPrivada: false, ventilacionRemota: false, notas: '' },
      organizacion: '',
      nombreContacto: '',
      correoContacto: '',
      telefonoContacto: '',
      aceptaDatos: false,
    });
    this.resultado.set(null);
    this.error.set('');
    this.paso.set(1);
  }

  /** Etiqueta legible del tipo de recinto elegido, para la confirmación. */
  nombreTipo(clave: TipoRecinto): string {
    return ETIQUETAS_TIPO_RECINTO[clave]?.nombre ?? clave;
  }
}
