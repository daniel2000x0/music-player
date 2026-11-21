import { THEME_CATALOG, themeAppIcon } from '@/constants/theme-catalog';
import { HERO_THEME_IDS, type ThemeMode } from '@/types/settings';

/**
 * CATÁLOGO DEL SELECTOR: la UI y el icono nativo deben apuntar a la misma
 * identidad. Un nombre de icono mal escrito dejaría al héroe con el icono
 * por defecto sin que la app lo notifique.
 */
describe('theme catalog', () => {
  it('ofrece los dos temas base y las seis familias de héroe', () => {
    expect(THEME_CATALOG.map((item) => item.id)).toEqual([
      'light',
      'dark',
      ...HERO_THEME_IDS,
    ]);
  });

  it('reserva el icono por defecto para claro y oscuro', () => {
    expect(themeAppIcon('light')).toBeNull();
    expect(themeAppIcon('dark')).toBeNull();
  });

  it('asigna un nombre de icono nativo distinto a cada héroe', () => {
    const names = HERO_THEME_IDS.map((id) => themeAppIcon(id));
    expect(names).toEqual([
      'IronMan',
      'Avengers',
      'CapitanAmerica',
      'SpiderMan',
      'Superman',
      'GreenLantern',
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('devuelve null ante un identificador desconocido', () => {
    expect(themeAppIcon('desconocido' as ThemeMode)).toBeNull();
  });
});
