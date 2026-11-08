/** Tiempo mínimo de escucha para considerar una reproducción válida. */
export const MIN_PLAY_SECONDS = 30;

/**
 * Umbral de escucha válida: 30 segundos o la mitad de la pista para
 * canciones cortas (mínimo 5 s).
 */
export function getPlayThreshold(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return MIN_PLAY_SECONDS;
  }
  return Math.min(MIN_PLAY_SECONDS, Math.max(5, duration * 0.5));
}

export function isValidPlay(listenedSeconds: number, duration: number): boolean {
  return listenedSeconds >= getPlayThreshold(duration);
}
