/**
 * Utilidades de formato de la app.
 */

/** Formatea una duración en segundos como "m:ss" (o "h:mm:ss" si supera 1 h). */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '--:--';
  }
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (value: number) => value.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/** Pluraliza de forma simple: "1 canción" / "3 canciones". */
export function formatSongCount(count: number): string {
  return count === 1 ? '1 canción' : `${count} canciones`;
}
