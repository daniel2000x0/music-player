import type { Song } from '@/types/song';

/**
 * Orden real de reproducción.
 *
 * LÓGICA: es lógica pura (sin expo-audio ni React) para poder probarla y para
 * que `services/audio/native-playlist` solo se ocupe del ciclo de vida nativo.
 */

/** Baraja una copia (Fisher-Yates) sin mutar la cola original. */
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/**
 * Orden de reproducción para una cola.
 *
 * Con aleatorio activo la pista actual se coloca primero para que
 * `previous`/`next` nativos sigan teniendo sentido y el resto se baraja.
 */
export function buildPlaybackOrder(
  songs: Song[],
  startSongId: number | null,
  shuffle: boolean
): Song[] {
  if (!shuffle) {
    return [...songs];
  }
  const current = songs.find((song) => song.id === startSongId);
  if (!current) {
    return shuffled(songs);
  }
  return [current, ...shuffled(songs.filter((song) => song.id !== current.id))];
}

/**
 * ¿La cola pedida tiene exactamente el mismo orden que la nativa?
 *
 * Se compara la secuencia, no el conjunto: dos colas con las mismas canciones
 * en distinto orden deben reconstruir la playlist para que `skipTo` y los
 * botones del sistema apunten a la pista correcta.
 */
export function hasSamePlaybackOrder(songs: Song[], order: Song[]): boolean {
  if (songs.length !== order.length) {
    return false;
  }
  return songs.every((song, index) => song.id === order[index]?.id);
}
