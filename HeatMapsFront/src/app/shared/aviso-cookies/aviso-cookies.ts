/**
 * @file aviso-cookies.ts
 * @description Aviso de cookies y almacenamiento local al ingresar al sitio.
 *
 * La Política de Cookies declara que el sitio no usa cookies HTTP de
 * seguimiento, pero sí tecnologías equivalentes: guarda el token de sesión y
 * la preferencia de tema en `localStorage`. El aviso que aparece al pie en la
 * primera visita declara ese uso y enlaza a la política (`/legal/cookies`).
 *
 * ## Persistencia
 * La marca de «aceptado» vive en `localStorage` bajo la clave
 * `"aviso-cookies"` (descrita en la propia política): responde una vez y no
 * vuelve a aparecer hasta que el titular borre el almacenamiento.
 */

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Clave bajo la que el navegador recuerda la respuesta al aviso. */
const CLAVE_AVISO = 'aviso-cookies';

/** Aviso fijo al pie de la ventana, presente solo hasta responderse. */
@Component({
  selector: 'app-aviso-cookies',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './aviso-cookies.html',
  styleUrl: './aviso-cookies.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvisoCookiesComponent {
  /**
   * `true` mientras el aviso deba mostrarse. Nace de lo que el navegador
   * recuerda: si ya registró la marca del aviso, no vuelve a aparecer.
   */
  readonly visible = signal(!this.yaRespondido());

  /**
   * Registra la respuesta en el navegador y retira el aviso.
   * Al confirmar se escribe la clave `"aviso-cookies"`, que la
   * Política de Cookies documenta.
   */
  entender(): void {
    try {
      localStorage.setItem(CLAVE_AVISO, 'aceptado');
    } catch {
      /* Sin almacenamiento disponible (modo restringido), el aviso solo
         desaparece de esta visita: nada que reparar. */
    }
    this.visible.set(false);
  }

  /** `true` si el navegador ya recordó la respuesta al aviso. */
  private yaRespondido(): boolean {
    try {
      return localStorage.getItem(CLAVE_AVISO) === 'aceptado';
    } catch {
      return false;
    }
  }
}
