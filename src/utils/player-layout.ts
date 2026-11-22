import { Spacing } from '@/constants/theme';

/** Tope superior de la portada en pantallas grandes/anchas. */
export const MAX_ARTWORK_SIZE = 420;

/**
 * Tamaño de la portada del reproductor.
 *
 * LÓGICA: la carátula es el elemento hero. Se prioriza su tamaño dentro de
 * límites seguros para no empujar controles fuera de pantalla. En pantallas
 * cortas se reduce la fracción vertical.
 */
export function playerArtworkSize(width: number, height: number): number {
  const horizontalLimit = width - Spacing.xl * 2;
  const verticalRatio = height < 740 ? 0.34 : 0.4;
  const verticalLimit = height * verticalRatio;
  return Math.max(0, Math.min(horizontalLimit, verticalLimit, MAX_ARTWORK_SIZE));
}

/**
 * Separación entre bloques del reproductor. En pantallas cortas se reduce para
 * preservar la carátula grande sin sacrificar controles.
 */
export function playerContentGap(height: number): number {
  return height < 740 ? Spacing.md : Spacing.lg;
}
