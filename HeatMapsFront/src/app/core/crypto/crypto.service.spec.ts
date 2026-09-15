import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let servicio: CryptoService;

  beforeEach(() => {
    servicio = TestBed.inject(CryptoService);
  });

  it('cifra y descifra el mismo objeto', async () => {
    const datos = { zona: 'Plazoleta', nivel: 'alta', acentos: 'ñáé', lista: [1, 2] };
    const cifrado = await servicio.encrypt(datos);
    expect(await servicio.decrypt(cifrado)).toEqual(datos);
  });

  it('empaqueta iv (12) + etiqueta (16) + texto cifrado en Base64', async () => {
    const cifrado = await servicio.encrypt('abc');
    const bytes = Uint8Array.from(atob(cifrado), (caracter) => caracter.charCodeAt(0));
    expect(bytes.length).toBe(12 + 16 + JSON.stringify('abc').length);
  });

  it('usa un IV aleatorio: el mismo dato da cifrados distintos', async () => {
    expect(await servicio.encrypt({ a: 1 })).not.toBe(await servicio.encrypt({ a: 1 }));
  });

  it('rechaza un cifrado alterado', async () => {
    const bytes = Uint8Array.from(atob(await servicio.encrypt({ a: 1 })), (caracter) => caracter.charCodeAt(0));
    bytes[bytes.length - 1] ^= 0xff;
    await expect(servicio.decrypt(btoa(String.fromCharCode(...bytes)))).rejects.toBeDefined();
  });
});
