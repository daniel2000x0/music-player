import { Spacing } from '@/constants/theme';

/** Tope superior de la portada en pantallas grandes/anchas. */
export const MAX_ARTWORK_SIZE = 420;

/**
 * Alto fijo del bloque de letra incrustada bajo la carátula.
 *
 * LÓGICA: es una vista previa, no un lector completo (ese sigue siendo el
 * modal). Al ser fijo, la distribución del reproductor no baila entre canciones
 * con y sin letra.
 */
export function inlineLyricsBoxHeight(height: number): number {
  if (height < 680) return 26;
  if (height < 740) return 38;
  return 46;
}

/** Alto que hay que descontar de la carátula: bloque + hueco entre bloques. */
export function inlineLyricsReservedHeight(height: number): number {
  return inlineLyricsBoxHeight(height) + playerContentGap(height);
}

/**
 * Tamaño de la portada del reproductor.
 *
 * LÓGICA: la carátula sigue siendo protagonista, pero la pantalla debe caber
 * sin scroll en tamaños compatibles. Reservamos espacio para header, aviso
 * compacto, meta, barra, controles y volumen, y reducimos la portada cuando
 * la altura disponible es limitada. Con letra incrustada se descuenta además
 * el bloque visible bajo la carátula para no desplazar el resto de la UI.
 */
export function playerArtworkSize(
  width: number,
  height: number,
  hasInlineLyrics = false
): number {
  const horizontalLimit = width - Spacing.xl * 2;
  const reserved =
    height < 680 ? 330 : height < 740 ? 360 : height < 820 ? 390 : 420;
  const verticalLimit = height - reserved;
  const ratioLimit = height * (height < 700 ? 0.28 : height < 820 ? 0.34 : 0.38);
  const base = Math.max(140, Math.min(horizontalLimit, verticalLimit, ratioLimit, MAX_ARTWORK_SIZE));
  if (!hasInlineLyrics) {
    return base;
  }
  return Math.max(140, base - inlineLyricsReservedHeight(height));
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
