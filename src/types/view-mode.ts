/**
 * Estilos de visualización disponibles en las pestañas con contenido.
 *
 * LÓGICA:
 * - `list`       → una fila por elemento (la vista histórica de la app).
 * - `compact`    → cuadrícula de 4 columnas, celdas de icono.
 * - `smallIcons` → cuadrícula de 3 columnas, celdas de icono.
 *
 * Los valores antiguos se normalizan al leer para que cambiar de vista no
 * rompa preferencias guardadas.
 */
export const VIEW_MODES = ['list', 'compact', 'smallIcons'] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

/** Valores guardados por versiones anteriores, conservados solo para migrar. */
export const LEGACY_VIEW_MODES = ['icons', 'blocks', 'mediumIcons', 'largeIcons'] as const;
export type LegacyViewMode = (typeof LEGACY_VIEW_MODES)[number];

export function isViewMode(value: unknown): value is ViewMode {
  return VIEW_MODES.includes(value as ViewMode);
}

/**
 * Traduce un valor persistido a su equivalente actual.
 *
 * LÓGICA: `compact` vuelve a ser un modo soportado (4 columnas). Los modos
 * antiguos o eliminados que no tienen equivalente directo caen a `smallIcons`
 * para evitar estados inválidos al cambiar de vista.
 */
export function normalizeViewMode(value: unknown): ViewMode | undefined {
  if (isViewMode(value)) {
    return value;
  }
  if (value === 'icons') {
    return 'compact';
  }
  if (value === 'blocks' || value === 'mediumIcons' || value === 'largeIcons') {
    return 'smallIcons';
  }
  return undefined;
}

/** Columnas de cada estilo. La lista usa 1 porque es una fila completa. */
export const VIEW_MODE_COLUMNS: Record<ViewMode, number> = {
  list: 1,
  compact: 4,
  smallIcons: 3,
};

/** A partir de 3 columnas la celda es una miniatura; antes, una tarjeta. */
export function isIconGrid(mode: ViewMode): boolean {
  return VIEW_MODE_COLUMNS[mode] >= 3;
}

/** Pestañas que tienen una lista propia y, por tanto, selector de vista. */
export const VIEW_MODE_TABS = ['songs', 'albums', 'audiobooks', 'playlists'] as const;

export type ViewModeTab = (typeof VIEW_MODE_TABS)[number];

export function isViewModeTab(value: unknown): value is ViewModeTab {
  return VIEW_MODE_TABS.includes(value as ViewModeTab);
}

/**
 * Vista inicial de cada pestaña. Álbumes mantiene la rejilla por defecto; el
 * resto conserva su lista histórica. `mediumIcons` ya no existe, así que el
 * default de Álbumes pasa a `smallIcons`.
 */
export const DEFAULT_VIEW_MODES: Record<ViewModeTab, ViewMode> = {
  songs: 'list',
  albums: 'smallIcons',
  audiobooks: 'list',
  playlists: 'list',
};
