import {
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';

import { resolveSongMetadata } from '@/domain/metadata';
import { logError, logWarning } from '@/services/error-log.service';
import { assignAlbumArtwork } from '@/services/artwork.service';
import { readAudioTags } from '@/services/tag.service';
import type { ScannedSong } from '@/types/song';
import { mapLimit } from '@/utils/async';

/**
 * Servicio de acceso al almacenamiento de audio del dispositivo.
 *
 * LÓGICA: pide permisos y consulta la mediateca del sistema para construir
 * la biblioteca de canciones. En el SDK 58 `expo-media-library` expone la
 * API nueva basada en `Query`/`Asset`.
 *
 * CÓDIGO:
 * - `loadDeviceAudio()` filtra por `MediaType.AUDIO`.
 * - La mediateca NO expone etiquetas ID3/MP4 (título/artista/álbum/pista),
 *   así que `readAudioTags` las lee del archivo y `resolveSongMetadata`
 *   aplica la cadena tag → nombre de archivo → carpeta.
 * - El arte embebido se lee aparte (ID3v2/MP4) vía `assignAlbumArtwork`.
 * - La deduplicación y la fecha de incorporación se resuelven en SQLite.
 */

/**
 * Tamaño de página al recorrer la mediateca.
 *
 * LÓGICA: la API nueva de `expo-media-library` pagina con `limit`/`offset`
 * (no expone cursor). Antes había un `.limit(5000)` fijo que truncaba la
 * biblioteca en silencio (`C-02`); ahora se recorre hasta la última página.
 * El coste es tiempo de escaneo, no pérdida de canciones.
 */
export const AUDIO_PAGE_SIZE = 1000;

/** Tope defensivo: 1 000 000 de pistas, evita un bucle si se ignora `offset`. */
const MAX_PAGES = 1000;

/** Archivos leídos en paralelo durante el escaneo. */
const TAG_CONCURRENCY = 4;

function audioQuery(offset: number): Query {
  return new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
    .orderBy(AssetField.CREATION_TIME)
    .limit(AUDIO_PAGE_SIZE)
    .offset(offset);
}

/**
 * Recorre todas las páginas de la mediateca y deduplica por id.
 *
 * Si una página viene completa pero no aporta ids nuevos, el proveedor está
 * ignorando `offset`: se detiene y se registra, en lugar de iterar sin fin.
 */
async function collectPages<T extends { id: string }>(
  fetchPage: (offset: number) => Promise<T[]>
): Promise<T[]> {
  const collected: T[] = [];
  const seen = new Set<string>();

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const page = await fetchPage(pageIndex * AUDIO_PAGE_SIZE);
    let added = 0;
    for (const item of page) {
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      collected.push(item);
      added += 1;
    }
    if (page.length < AUDIO_PAGE_SIZE) {
      return collected;
    }
    if (added === 0) {
      logWarning(
        'media-service',
        'collectPages',
        'La página no aportó ids nuevos; se detiene el recorrido para evitar un bucle.'
      );
      return collected;
    }
  }

  logWarning(
    'media-service',
    'collectPages',
    `Se alcanzó el tope defensivo de ${MAX_PAGES} páginas (${MAX_PAGES * AUDIO_PAGE_SIZE} pistas).`
  );
  return collected;
}

export async function hasAudioPermission(): Promise<boolean> {
  try {
    const { granted } = await getPermissionsAsync(false, ['audio']);
    return granted;
  } catch (error) {
    logError('media-service', 'getPermissionsAsync', error);
    return false;
  }
}

export async function requestAudioAccess(): Promise<boolean> {
  try {
    const { granted } = await requestPermissionsAsync(false, ['audio']);
    return granted;
  } catch (error) {
    logError('media-service', 'requestPermissionsAsync', error);
    return false;
  }
}

/**
 * Ids de los audios presentes en la mediateca, sin resolver rutas ni leer
 * etiquetas (`exeForMetadata` es una sola consulta liviana al MediaStore).
 *
 * LÓGICA: el arranque compara estos ids con los guardados en SQLite; si son
 * iguales no hace falta releer etiquetas de todos los archivos. Devuelve
 * `null` si la consulta falla, para que el llamador haga un escaneo completo
 * en lugar de asumir que la biblioteca está vacía.
 */
export async function listDeviceAudioIds(): Promise<Set<string> | null> {
  try {
    const metadata = await collectPages((offset) => audioQuery(offset).exeForMetadata());
    return new Set(metadata.map((item) => item.id));
  } catch (error) {
    logError('media-service', 'query.exeForMetadata', error);
    return null;
  }
}

/**
 * Carpeta contenedora según el URI.
 *
 * Solo `file://` expone la ruta real; `content://`/`ph://` no permiten
 * deducirla. La decisión de usar la carpeta como álbum (o ignorarla si es
 * genérica) vive en `resolveSongMetadata`.
 */
function folderFromUri(uri: string): string | null {
  try {
    const clean = decodeURIComponent(uri.split('?')[0]);
    if (!clean.startsWith('file://')) {
      return null;
    }
    const parts = clean.split('/').filter(Boolean);
    return parts[parts.length - 2] ?? null;
  } catch {
    return null;
  }
}

async function toSong(asset: {
  getInfo: () => Promise<{
    id: string;
    filename: string;
    uri: string;
    duration: number | null;
  }>;
}): Promise<ScannedSong | null> {
  try {
    const info = await asset.getInfo();
    const filename = info.filename ?? '';
    const folder = folderFromUri(info.uri);
    const tags = await readAudioTags(info.uri);
    const metadata = resolveSongMetadata({ filename, folder, tags });

    return {
      mediaId: info.id,
      uri: info.uri,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      track: metadata.track,
      folder,
      duration: info.duration ? info.duration / 1000 : 0,
      artwork: null,
    };
  } catch (error) {
    logError('media-service', 'asset.getInfo', error);
    return null;
  }
}

/**
 * Carga las canciones de audio del dispositivo (requiere permiso).
 *
 * Devuelve `null` si la consulta a la mediateca falla, para que el llamador
 * NO interprete el fallo como "el dispositivo no tiene canciones" y marque
 * toda la biblioteca como no disponible.
 */
export async function loadDeviceAudio(): Promise<ScannedSong[] | null> {
  let assets;
  try {
    assets = await collectPages((offset) => audioQuery(offset).exe());
  } catch (error) {
    logError('media-service', 'query.exec', error);
    return null;
  }

  const resolved = await mapLimit(assets, TAG_CONCURRENCY, (asset) => toSong(asset));
  const songs = resolved.filter((song): song is ScannedSong => song !== null);

  // Extrae el arte embebido (una pasada por álbum) antes de persistir.
  try {
    await assignAlbumArtwork(songs);
  } catch (error) {
    logError('media-service', 'assignAlbumArtwork', error);
  }

  return songs;
}
