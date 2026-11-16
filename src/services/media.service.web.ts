import type { DeviceTrack } from '@/domain/library/scan-diff';
import type { ScannedSong } from '@/types/song';

/**
 * Variante web de `media.service`.
 *
 * LÓGICA: `expo-media-library` no implementa la mediateca del dispositivo en
 * navegador. Importarlo en web rompe el bundle (la clase nativa que extiende
 * no existe), así que Metro resuelve este archivo `.web.ts` en su lugar y la
 * app web arranca con la biblioteca local vacía.
 *
 * La API debe coincidir con la variante nativa para que el pipeline de
 * escaneo compile igual en ambas plataformas.
 */

/** Archivos leídos en paralelo durante la hidratación (mismo valor que nativo). */
export const TAG_CONCURRENCY = 4;

export async function hasAudioPermission(): Promise<boolean> {
  return false;
}

export async function requestAudioAccess(): Promise<boolean> {
  return false;
}

/** En web no hay mediateca: se devuelve una lista vacía, no un fallo. */
export async function enumerateDeviceAudio(): Promise<DeviceTrack[] | null> {
  return [];
}

/** En web no hay assets que leer (nunca se llama con una lista no vacía). */
export async function readDeviceTrack(_track: DeviceTrack): Promise<ScannedSong | null> {
  return null;
}

/** En web no hay mediateca del dispositivo. */
export async function listDeviceAudioIds(): Promise<Set<string> | null> {
  return null;
}
