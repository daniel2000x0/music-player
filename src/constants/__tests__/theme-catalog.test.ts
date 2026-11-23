import {
  DARK_THEME_LOGO,
  DEFAULT_THEME_LOGO,
  HUNGER_GAMES_THEME_LOGO,
  LIGHT_THEME_LOGO,
  THEME_CATALOG,
  getThemeLogo,
  themeAppIcon,
} from '@/constants/theme-catalog';
import { HERO_THEME_IDS, type ThemeMode } from '@/types/settings';

/**
 * CATÁLOGO DEL SELECTOR: la UI y el icono nativo deben apuntar a la misma
 * identidad. Un nombre de icono mal escrito dejaría al héroe con el icono
 * por defecto sin que la app lo notifique.
 */
describe('theme catalog', () => {
  it('ofrece los dos temas base y las familias de héroe', () => {
    expect(THEME_CATALOG.map((item) => item.id)).toEqual([
      'light',
      'dark',
      ...HERO_THEME_IDS,
    ]);
  });

  it('reserva el icono nativo por defecto para claro y oscuro', () => {
    expect(themeAppIcon('light')).toBeNull();
    expect(themeAppIcon('dark')).toBeNull();
  });

  it('asigna imágenes específicas para claro y oscuro', () => {
    const light = THEME_CATALOG.find((item) => item.id === 'light');
    const dark = THEME_CATALOG.find((item) => item.id === 'dark');

    expect(light?.icon).toBe(LIGHT_THEME_LOGO);
    expect(dark?.icon).toBe(DARK_THEME_LOGO);
    expect(light?.icon).not.toBe(DEFAULT_THEME_LOGO);
    expect(dark?.icon).not.toBe(DEFAULT_THEME_LOGO);
    expect(getThemeLogo('light')).toBe(LIGHT_THEME_LOGO);
    expect(getThemeLogo('dark')).toBe(DARK_THEME_LOGO);
    expect(getThemeLogo('hungergames')).toBe(HUNGER_GAMES_THEME_LOGO);
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
      'HungerGames',
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('devuelve null ante un identificador desconocido', () => {
    expect(themeAppIcon('desconocido' as ThemeMode)).toBeNull();
  });
});
