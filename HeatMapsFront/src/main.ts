import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app';

// Si la aplicación no llega a arrancar no hay otro sitio donde informar: la
// consola del navegador es el único canal disponible.
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err)); // skipcq: JS-0002
