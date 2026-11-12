import {
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';

import { resolveSongMetadata } from '@/domain/metadata';
import { logError } from '@/services/error-log.service';
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

/** Máximo de canciones a cargar por escaneo (configurable). */
const MAX_SONGS = 5000;

/** Archivos leídos en paralelo durante el escaneo. */
const TAG_CONCURRENCY = 4;

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
    const metadata = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
      .orderBy(AssetField.CREATION_TIME)
      .limit(MAX_SONGS)
      .exeForMetadata();
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
    assets = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
      .orderBy(AssetField.CREATION_TIME)
      .limit(MAX_SONGS)
      .exe();
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
