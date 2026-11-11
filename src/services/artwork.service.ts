import { Directory, File, FileMode, Paths, type FileHandle } from 'expo-file-system';

import { ascii, type EmbeddedArtwork } from '@/domain/artwork/bytes';
import { extractId3Artwork, parseId3TagSize } from '@/domain/artwork/id3';
import { extractMp4Artwork } from '@/domain/artwork/mp4';
import { logError } from '@/services/error-log.service';
import type { ScannedSong } from '@/types/song';
import { mapLimit } from '@/utils/async';

/**
 * Extracción y caché de portadas de álbum desde los tags embebidos.
 *
 * LÓGICA: la mediateca de Android no expone el arte embebido, así que se
 * lee directamente del archivo de audio:
 * - MP3: tag ID3v2 (frame APIC) al inicio del archivo.
 * - M4A/MP4: átomo `moov/udta/meta/ilst/covr`, navegando sin cargar el audio.
 * La imagen se extrae una sola vez por álbum (con un reintento de respaldo),
 * se guarda en `Paths.cache/artwork/{mediaId}.(jpg|png)` y su URI se
 * persiste en SQLite (`artwork_uri` de songs y albums).
 */

const ARTWORK_DIRECTORY = 'artwork';
/** Techo de seguridad para tags ID3 gigantes. */
const ID3_TAG_MAX_BYTES = 2 * 1024 * 1024;
/** Techo de seguridad para imágenes embebidas absurdamente grandes. */
const EMBEDDED_ART_MAX_BYTES = 10 * 1024 * 1024;
/** Canciones que se prueban por álbum antes de rendirse. */
const MAX_ATTEMPTS_PER_ALBUM = 2;
/** Archivos analizados en paralelo durante la extracción. */
const EXTRACTION_CONCURRENCY = 3;

/** Extensiones de audio cuyo contenedor sabemos inspeccionar. */
const EMBEDDED_ART_EXTENSIONS = new Set(['mp3', 'm4a', 'mp4', 'm4b', 'aac']);

function fileExtension(uri: string): string {
  const clean = uri.split('?')[0].toLowerCase();
  const dot = clean.lastIndexOf('.');
  return dot === -1 ? '' : clean.slice(dot + 1);
}

function shouldAttempt(uri: string): boolean {
  if (EMBEDDED_ART_EXTENSIONS.has(fileExtension(uri))) {
    return true;
  }
  // Sin extensión conocida (content://) aún puede detectarse por magic bytes.
  return uri.startsWith('content://');
}

function cacheFileFor(mediaId: string, mime: EmbeddedArtwork['mime']): File {
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const safeId = mediaId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return new File(Paths.cache, ARTWORK_DIRECTORY, `${safeId}.${ext}`);
}

function cachedArtworkUri(mediaId: string): string | null {
  for (const mime of ['image/jpeg', 'image/png'] as const) {
    const file = cacheFileFor(mediaId, mime);
    if (file.exists && file.size > 0) {
      return file.uri;
    }
  }
  return null;
}

async function readEmbeddedArtwork(uri: string): Promise<EmbeddedArtwork | null> {
  const file = new File(uri);
  if (!file.exists || file.size === 0) {
    return null;
  }

  let handle: FileHandle | null = null;
  try {
    handle = file.open(FileMode.ReadOnly);
    const size = handle.size ?? file.size;
    if (size <= 0) {
      return null;
    }

    const header = await handle.readBytes(12);
    if (!header || header.length < 8) {
      return null;
    }

    // "ID3" → MP3 con tag ID3v2.
    if (ascii(header, 0, 3) === 'ID3') {
      const tagSize = parseId3TagSize(header);
      if (tagSize === null) {
        return null;
      }
      const total = Math.min(10 + tagSize, ID3_TAG_MAX_BYTES);
      handle.offset = 0;
      const tag = await handle.readBytes(total);
      if (!tag) {
        return null;
      }
      const artwork = extractId3Artwork(tag);
      return artwork && artwork.data.length <= EMBEDDED_ART_MAX_BYTES ? artwork : null;
    }

    // Átomo "ftyp" en [4..8] → contenedor MP4/M4A.
    if (ascii(header, 4, 4) === 'ftyp') {
      const instance = handle;
      const reader = async (offset: number, length: number) => {
        instance.offset = offset;
        return await instance.readBytes(length);
      };
      const artwork = await extractMp4Artwork(reader, size);
      return artwork && artwork.data.length <= EMBEDDED_ART_MAX_BYTES ? artwork : null;
    }

    return null;
  } finally {
    handle?.close();
  }
}

/**
 * URI cacheada de la portada de una canción: reutiliza el cache si existe
 * y en caso contrario extrae el arte embebido y lo escribe a disco.
 */
export async function resolveArtworkUri(song: {
  mediaId: string;
  uri: string;
}): Promise<string | null> {
  const cached = cachedArtworkUri(song.mediaId);
  if (cached) {
    return cached;
  }
  if (!shouldAttempt(song.uri)) {
    return null;
  }

  let artwork: EmbeddedArtwork | null;
  try {
    artwork = await readEmbeddedArtwork(song.uri);
  } catch (error) {
    logError('artwork-service', 'readEmbeddedArtwork', error);
    return null;
  }
  if (!artwork) {
    return null;
  }

  try {
    const directory = new Directory(Paths.cache, ARTWORK_DIRECTORY);
    if (!directory.exists) {
      directory.create();
    }
    const target = cacheFileFor(song.mediaId, artwork.mime);
    await target.write(artwork.data);
    return target.uri;
  } catch (error) {
    logError('artwork-service', 'write-cache', error);
    return null;
  }
}

/**
 * Asigna `artwork` a las canciones escaneadas: una extracción por álbum
 * (con respaldo) propagada a todo el grupo. Muta los `ScannedSong` para
 * que el upsert persista la misma URI en songs y albums.
 */
export async function assignAlbumArtwork(songs: ScannedSong[]): Promise<void> {
  if (songs.length === 0) {
    return;
  }

  const groups = new Map<string, ScannedSong[]>();
  for (const song of songs) {
    const key = `${song.album}\u0000${song.artist}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(song);
    } else {
      groups.set(key, [song]);
    }
  }

  const entries = [...groups.values()];
  const uris = await mapLimit(entries, EXTRACTION_CONCURRENCY, async (group) => {
    for (const song of group.slice(0, MAX_ATTEMPTS_PER_ALBUM)) {
      try {
        const uri = await resolveArtworkUri(song);
        if (uri) {
          return uri;
        }
      } catch (error) {
        logError('artwork-service', 'resolveArtworkUri', error);
      }
    }
    return null;
  });

  entries.forEach((group, index) => {
    const uri = uris[index];
    if (!uri) {
      return;
    }
    for (const song of group) {
      song.artwork = uri;
    }
  });
}
