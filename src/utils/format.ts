/**
 * Utilidades de formato de la app.
 */

/**
 * Formatea unos segundos como reloj: "m:ss" o "h:mm:ss" si supera 1 h.
 * A diferencia de `formatDuration`, siempre devuelve un reloj (0 -> "0:00"),
 * porque se usa para la posición, que sí se conoce desde el principio.
 */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  const seconds = Math.floor(safe % 60);
  const minutes = Math.floor((safe / 60) % 60);
  const hours = Math.floor(safe / 3600);

  const pad = (value: number) => value.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/** Formatea una duración en segundos como "m:ss" (o "h:mm:ss" si supera 1 h). */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '--:--';
  }
  return formatClock(totalSeconds);
}

/** Pluraliza de forma simple: "1 canción" / "3 canciones". */
export function formatSongCount(count: number): string {
  return count === 1 ? '1 canción' : `${count} canciones`;
}
