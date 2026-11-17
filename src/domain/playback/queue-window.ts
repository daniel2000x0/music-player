/**
 * Ventana de cola que se entrega al motor nativo.
 *
 * RESPONSABILIDAD ÚNICA: decidir qué tramo del orden de reproducción recibe la
 * playlist nativa. Con colas grandes (miles de pistas) entregar el orden
 * completo hace que `MediaSession` publique toda la cola en una única
 * transacción binder del hilo principal y la app deja de responder (ANR). La
 * cola completa sigue viviendo en el store; el motor solo carga una ventana.
 *
 * LÓGICA: es lógica pura — sin expo-audio, sin SQLite y sin React — para poder
 * probarla. Los índices que devuelve son índices del orden de reproducción
 * COMPLETO, no de la playlist nativa.
 */

/** Pistas que la playlist nativa carga por delante de la actual. */
export const QUEUE_WINDOW_BACK = 100;

/** Pistas que la playlist nativa carga por detrás de la actual. */
export const QUEUE_WINDOW_FORWARD = 100;

/** Margen, en pistas, a partir del cual la ventana se queda corta y se recentra. */
export const QUEUE_WINDOW_EDGE = 20;

/**
 * Índices del orden completo que debe contener la playlist nativa, en orden.
 *
 * - Si la cola entera cabe en la ventana se devuelve el orden completo (las
 *   colas pequeñas se comportan exactamente como antes).
 * - Con `cyclic` (repetición total) la ventana da la vuelta: el tramo que
 *   sobresale por un extremo se toma del otro, de forma que la reproducción
 *   continua no se corta en los bordes de la cola.
 */
export function computeQueueWindow(
  length: number,
  currentIndex: number,
  cyclic: boolean
): number[] {
  if (length <= 0) {
    return [];
  }
  const current = Math.max(0, Math.min(currentIndex, length - 1));
  if (length <= QUEUE_WINDOW_BACK + QUEUE_WINDOW_FORWARD + 1) {
    return range(0, length);
  }
  if (!cyclic) {
    return range(
      Math.max(0, current - QUEUE_WINDOW_BACK),
      Math.min(length, current + QUEUE_WINDOW_FORWARD + 1)
    );
  }
  const indices: number[] = [];
  for (let offset = -QUEUE_WINDOW_BACK; offset <= QUEUE_WINDOW_FORWARD; offset += 1) {
    indices.push(mod(current + offset, length));
  }
  return indices;
}

/**
 * ¿Hay que recentrar la ventana?
 *
 * Se recentra cuando quedan menos de `QUEUE_WINDOW_EDGE` pistas por delante (o
 * por detrás) dentro de la ventana y el orden completo todavía guarda pistas
 * fuera de ella en esa dirección. Así la playlist nativa nunca llega al borde:
 * siempre tiene margen para `next`/`previous` y para el avance automático.
 */
export function needsWindowRecenter(params: {
  nativeIndex: number;
  windowLength: number;
  fullIndex: number;
  orderLength: number;
  cyclic: boolean;
}): boolean {
  const { nativeIndex, windowLength, fullIndex, orderLength, cyclic } = params;
  if (windowLength <= 0 || nativeIndex < 0 || nativeIndex >= windowLength) {
    return false;
  }
  // Si la ventana ya cubre el orden completo no hay nada que recentrar.
  if (windowLength >= orderLength) {
    return false;
  }

  const afterInWindow = windowLength - 1 - nativeIndex;
  const afterInOrder = cyclic ? Number.POSITIVE_INFINITY : orderLength - 1 - fullIndex;
  if (afterInWindow < QUEUE_WINDOW_EDGE && afterInOrder > afterInWindow) {
    return true;
  }

  const beforeInWindow = nativeIndex;
  const beforeInOrder = cyclic ? Number.POSITIVE_INFINITY : fullIndex;
  if (beforeInWindow < QUEUE_WINDOW_EDGE && beforeInOrder > beforeInWindow) {
    return true;
  }

  return false;
}

function mod(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function range(start: number, end: number): number[] {
  const indices: number[] = [];
  for (let index = start; index < end; index += 1) {
    indices.push(index);
  }
  return indices;
}
