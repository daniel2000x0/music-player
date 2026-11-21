/**
 * Identificadores de tema persistidos en SQLite.
 *
 * LÓGICA: `light` y `dark` son los temas base (usan el icono por defecto).
 * El resto son "familias" de superhéroe: cada una define una paleta clara y
 * otra oscura, y cambia el icono del launcher al seleccionarla.
 */
export const HERO_THEME_IDS = [
  'ironman',
  'avengers',
  'capitanAmerica',
  'spiderman',
  'superman',
  'greenLantern',
] as const;

export type HeroThemeId = (typeof HERO_THEME_IDS)[number];

export type ThemeMode = 'light' | 'dark' | HeroThemeId;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || HERO_THEME_IDS.includes(value as HeroThemeId);
}

export function isHeroTheme(value: ThemeMode): value is HeroThemeId {
  return value !== 'light' && value !== 'dark';
}

export type AppSettings = {
  theme: ThemeMode;
  /** Volumen del reproductor (0–1). `M-02`. */
  volume: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  volume: 1,
};
