import type { ScannedSong } from '@/types/song';

/**
 * Variante web de `media.service`.
 *
 * LÓGICA: `expo-media-library` no implementa la mediateca del dispositivo en
 * navegador. Importarlo en web rompe el bundle (la clase nativa que extiende
 * no existe), así que Metro resuelve este archivo `.web.ts` en su lugar y la
 * app web arranca con la biblioteca local vacía.
 */

export async function hasAudioPermission(): Promise<boolean> {
  return false;
}

export async function requestAudioAccess(): Promise<boolean> {
  return false;
}

export async function loadDeviceAudio(): Promise<ScannedSong[]> {
  return [];
}
