import { DEFAULT_LANGUAGE, type AppLanguage } from '@/i18n';
import type { AlbumSortKey, PlaylistSortKey, SongSortKey, SongView } from '@/types/filters';
import { DEFAULT_VIEW_MODES, type ViewMode, type ViewModeTab } from '@/types/view-mode';

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
  'hungergames',
] as const;

export type HeroThemeId = (typeof HERO_THEME_IDS)[number];

export type ThemeMode = 'light' | 'dark' | HeroThemeId;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || HERO_THEME_IDS.includes(value as HeroThemeId);
}

export function isHeroTheme(value: ThemeMode): value is HeroThemeId {
  return value !== 'light' && value !== 'dark';
}

/** Orden persistido por pestaña. Se guarda en `app_settings` para reabrir la app igual. */
export type SortModes = {
  songs: SongSortKey;
  albums: AlbumSortKey;
  playlists: PlaylistSortKey;
};

export const DEFAULT_SORT_MODES: SortModes = {
  songs: 'title-asc',
  albums: 'title-asc',
  playlists: 'created-desc',
};

export type AppSettings = {
  theme: ThemeMode;
  /** Volumen del reproductor (0–1). `M-02`. */
  volume: number;
  /** Idioma de toda la interfaz (ES/EN). Persistido en el mismo JSON. */
  language: AppLanguage;
  /** Estilo de lista elegido por pestaña. Solo claves de `VIEW_MODE_TABS`. */
  viewModes: Partial<Record<ViewModeTab, ViewMode>>;
  /** Vista/filtro activo de Canciones (Todas/Favoritos/Escuchadas/Sin reproducir). */
  songView: SongView;
  /** Orden seleccionado por pestaña; persiste entre cierres de app. */
  sortModes: SortModes;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  volume: 1,
  language: DEFAULT_LANGUAGE,
  viewModes: DEFAULT_VIEW_MODES,
  songView: 'all',
  sortModes: DEFAULT_SORT_MODES,
};
