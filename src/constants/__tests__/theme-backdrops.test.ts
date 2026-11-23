import { hasThemeBackdrop, themeBackdrop } from '@/constants/theme-backdrops';
import { HERO_THEME_IDS } from '@/types/settings';

describe('fondos de tema', () => {
  it('todos los temas con fondo de héroe tienen fondo de pantalla propio', () => {
    expect(HERO_THEME_IDS).toHaveLength(7);
    for (const id of HERO_THEME_IDS) {
      expect(themeBackdrop(id)).not.toBeNull();
      expect(hasThemeBackdrop(id)).toBe(true);
    }
  });

  it('Claro y Oscuro siguen sin cargar imagen', () => {
    expect(themeBackdrop('light')).toBeNull();
    expect(themeBackdrop('dark')).toBeNull();
    expect(hasThemeBackdrop('light')).toBe(false);
    expect(hasThemeBackdrop('dark')).toBe(false);
  });

  it('ya no existe el tema Green Lantern Corps', () => {
    expect(HERO_THEME_IDS).not.toContain('greenLanternGreen');
    expect(themeBackdrop('greenLanternGreen' as never)).toBeNull();
  });
});
