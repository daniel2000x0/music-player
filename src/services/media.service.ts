import {
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';

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
 * - La deduplicación y la fecha de incorporación se resuelven en SQLite.
 */

/** Máximo de canciones a cargar por escaneo (configurable). */
const MAX_SONGS = 5000;

export async function hasAudioPermission(): Promise<boolean> {
  try {
    const { granted } = await getPermissionsAsync(false, ['audio']);
    return granted;
  } catch {
    return false;
  }
}

export async function requestAudioAccess(): Promise<boolean> {
  try {
    const { granted } = await requestPermissionsAsync(false, ['audio']);
    return granted;
  } catch {
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
  } catch {
    return null;
  }
}

/** Carga las canciones de audio del dispositivo (requiere permiso). */
export async function loadDeviceAudio(): Promise<ScannedSong[]> {
  const assets = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
    .orderBy(AssetField.CREATION_TIME)
    .limit(MAX_SONGS)
    .exe();

  const resolved = await Promise.all(assets.map((asset) => toSong(asset)));
  return resolved.filter((song): song is ScannedSong => song !== null);
}
