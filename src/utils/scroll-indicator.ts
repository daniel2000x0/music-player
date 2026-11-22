/** Altura mínima del pulgar para que siga siendo visible y utilizable. */
export const MinScrollThumbHeight = 28;

export type ScrollThumbMetrics = {
  /** Alto del pulgar, proporcional a la parte visible del contenido. */
  height: number;
  /** Distancia máxima que puede bajar el pulgar dentro de la pista. */
  travel: number;
};

/**
 * Geometría del indicador propio de scroll.
 *
 * Devuelve `null` cuando no hay desplazamiento posible (contenido más corto
 * que la ventana), así la lista no dibuja un pulgar inútil.
 */
export function scrollThumbMetrics(
  contentHeight: number,
  viewportHeight: number
): ScrollThumbMetrics | null {
  if (!Number.isFinite(contentHeight) || !Number.isFinite(viewportHeight)) {
    return null;
  }
  if (viewportHeight <= 0 || contentHeight <= viewportHeight) {
    return null;
  }

  const height = Math.max(
    MinScrollThumbHeight,
    (viewportHeight * viewportHeight) / contentHeight
  );
  return { height, travel: Math.max(0, viewportHeight - height) };
}
