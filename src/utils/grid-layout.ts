/**
 * Geometría única de las rejillas de la app.
 *
 * Antes cada pestaña calculaba el ancho de celda por su cuenta y el resultado
 * no estaba centrado: unas restaban el margen dos veces, otras solo una, y el
 * `contentContainerStyle` dejaba 24 px a la izquierda pero 12 a la derecha.
 * Aquí se calcula todo una sola vez y se reparte el píxel suelto de forma
 * simétrica, de modo que la rejilla quede visualmente centrada.
 */

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { VIEW_MODE_COLUMNS, isIconGrid, type ViewMode } from '@/types/view-mode';

export type GridMetrics = {
  /** Número de columnas que se pasará a `FlatList`. */
  columns: number;
  /** Ancho exacto de cada celda. */
  tileWidth: number;
  /** Separación horizontal entre celdas. */
  gap: number;
  /** Padding izquierdo del contentContainer. */
  paddingLeft: number;
  /** Padding derecho del contentContainer. */
  paddingRight: number;
  /** `false` solo para la vista de lista. */
  isGrid: boolean;
  /** Tipo de celda: miniatura a partir de 3 columnas. */
  variant: 'icon' | 'block';
};

const MIN_ICON_TILE = 48;
const MIN_BLOCK_TILE = 120;

/**
 * Calcula columnas, ancho de celda y paddings simétricos.
 *
 * LÓGICA: el marco útil es `min(windowWidth, MaxContentWidth)` menos el
 * margen de área segura a cada lado. El ancho de celda se redondea hacia abajo
 * para no desbordar; lo que sobra (`resto`) se parte entre ambos lados con
 * `floor`/`ceil`, así la diferencia nunca supera 1 px y la suma es exacta.
 */
export function getGridMetrics(mode: ViewMode, windowWidth: number): GridMetrics {
  const columns = VIEW_MODE_COLUMNS[mode];
  const isGrid = mode !== 'list';
  const variant: GridMetrics['variant'] = isIconGrid(mode) ? 'icon' : 'block';

  const frame = Math.min(Math.max(windowWidth, 0), MaxContentWidth);
  const inset = Spacing.xl;
  const usable = Math.max(0, frame - inset * 2);

  // En pantallas estrechas se reduce el hueco para que la rejilla de 3
  // columnas siga respirando sin bajar de un tamaño táctil razonable.
  const gap = columns >= 3 && windowWidth < 360 ? Spacing.sm : Spacing.lg;
  const minTile = variant === 'icon' ? MIN_ICON_TILE : MIN_BLOCK_TILE;

  const raw = columns > 0 ? (usable - gap * (columns - 1)) / columns : usable;
  const floored = Math.max(1, Math.floor(raw));
  const ideal = Math.max(minTile, floored);
  const fits = columns * ideal + gap * (columns - 1) <= usable;
  const tileWidth = fits ? ideal : floored;

  const used = columns * tileWidth + gap * (columns - 1);
  const resto = Math.max(0, usable - used);

  return {
    columns,
    tileWidth,
    gap,
    paddingLeft: inset + Math.floor(resto / 2),
    paddingRight: inset + Math.ceil(resto / 2),
    isGrid,
    variant,
  };
}
