import {
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';

import { logError } from '@/services/error-log.service';
import { assignAlbumArtwork } from '@/services/artwork.service';
import type { ScannedSong } from '@/types/song';

/**
 * Servicio de acceso al almacenamiento de audio del dispositivo.
 *
 * LÓGICA: pide permisos y consulta la mediateca del sistema para construir
 * la biblioteca de canciones. En el SDK 57 `expo-media-library` expone la
 * API nueva basada en `Query`/`Asset`.
 *
 * CÓDIGO:
 * - `loadDeviceAudio()` filtra por `MediaType.AUDIO`.
 * - La mediateca NO expone etiquetas ID3 (título/artista/álbum), por lo que
 *   los derivamos del nombre de archivo y de la carpeta contenedora:
 *   "Artista - Título.mp3" → artist/title; la carpeta → álbum.
 * - El arte embebido sí se lee del archivo (ID3v2/MP4) vía
 *   `assignAlbumArtwork` antes de persistir el escaneo.
 * - La deduplicación y la fecha de incorporación se resuelven en SQLite.
 */

/** Máximo de canciones a cargar por escaneo (configurable). */
const MAX_SONGS = 5000;

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

function albumFromUri(uri: string): string | null {
  try {
    const clean = decodeURIComponent(uri.split('?')[0]);
    const parts = clean.split('/').filter(Boolean);
    const folder = parts[parts.length - 2];
    if (!folder || folder === 'media' || folder === 'audio') {
      return null;
    }
    return folder;
  } catch {
    return null;
  }
}

function parseFilename(filename: string): { title: string; artist: string } {
  const base = filename.replace(/\.[^.]+$/, '') || 'Pista sin título';
  const dash = base.split(' - ');
  if (dash.length >= 2) {
    return {
      artist: dash[0].trim() || 'Artista desconocido',
      title: dash.slice(1).join(' - ').trim() || base,
    };
  }
  return { title: base, artist: 'Artista desconocido' };
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
    const { title, artist } = parseFilename(info.filename ?? '');
    return {
      mediaId: info.id,
      uri: info.uri,
      title,
      artist,
      album: albumFromUri(info.uri) ?? 'Sin álbum',
      duration: info.duration ? info.duration / 1000 : 0,
      artwork: null,
    };
  } catch (error) {
    logError('media-service', 'asset.getInfo', error);
    return null;
  }
}

/** Carga las canciones de audio del dispositivo (requiere permiso). */
export async function loadDeviceAudio(): Promise<ScannedSong[]> {
  let assets;
  try {
    assets = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
      .orderBy(AssetField.CREATION_TIME)
      .limit(MAX_SONGS)
      .exe();
  } catch (error) {
    logError('media-service', 'query.exec', error);
    return [];
  }

  const resolved = await Promise.all(assets.map((asset) => toSong(asset)));
  const songs = resolved.filter((song): song is ScannedSong => song !== null);

  // Extrae el arte embebido (una pasada por álbum) antes de persistir.
  try {
    await assignAlbumArtwork(songs);
  } catch (error) {
    logError('media-service', 'assignAlbumArtwork', error);
  }

  return songs;
}
