import { HERO_THEME_IDS, isHeroTheme, isThemeMode } from '@/types/settings';

describe('identificadores de tema', () => {
  it('acepta los dos temas base y las familias de héroe', () => {
    expect(isThemeMode('light')).toBe(true);
    expect(isThemeMode('dark')).toBe(true);

    for (const id of HERO_THEME_IDS) {
      expect(isThemeMode(id)).toBe(true);
      expect(isHeroTheme(id)).toBe(true);
    }
  });

  it('rechaza valores desconocidos, nulos y no string', () => {
    expect(isThemeMode('otro')).toBe(false);
    expect(isThemeMode('')).toBe(false);
    expect(isThemeMode(null)).toBe(false);
    expect(isThemeMode(42)).toBe(false);
  });

  it('solo trata como héroe a los identificadores de héroe', () => {
    expect(isHeroTheme('light')).toBe(false);
    expect(isHeroTheme('dark')).toBe(false);
  });
});
