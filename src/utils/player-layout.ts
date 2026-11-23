import { Spacing } from '@/constants/theme';

/** Tope superior de la portada en pantallas grandes/anchas. */
export const MAX_ARTWORK_SIZE = 420;

/**
 * Tamaño de la portada del reproductor.
 *
 * LÓGICA: la carátula sigue siendo protagonista, pero la pantalla debe caber
 * sin scroll en tamaños compatibles. Reservamos espacio para header, aviso
 * compacto, meta, barra, controles y volumen, y reducimos la portada cuando
 * la altura disponible es limitada.
 */
export function playerArtworkSize(width: number, height: number): number {
  const horizontalLimit = width - Spacing.xl * 2;
  const reserved =
    height < 680 ? 330 : height < 740 ? 360 : height < 820 ? 390 : 420;
  const verticalLimit = height - reserved;
  const ratioLimit = height * (height < 700 ? 0.28 : height < 820 ? 0.34 : 0.38);
  return Math.max(140, Math.min(horizontalLimit, verticalLimit, ratioLimit, MAX_ARTWORK_SIZE));
}

/**
 * Separación entre bloques del reproductor. En pantallas cortas se compacta
 * agresivamente para evitar scroll.
 */
export function playerContentGap(height: number): number {
  if (height < 680) return Spacing.xs;
  if (height < 740) return Spacing.sm;
  return Spacing.md;
}
