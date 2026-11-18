import { Directory, File, FileMode, Paths, type FileHandle } from 'expo-file-system';

import {
  EXTENSION_BY_MIME,
  ascii,
  sniffArtworkMime,
  type ArtworkMime,
  type EmbeddedArtwork,
} from '@/domain/artwork/bytes';
import { extractFlacArtwork } from '@/domain/artwork/flac';
import { extractId3Artwork, parseId3TagSize } from '@/domain/artwork/id3';
import { extractMp4Artwork } from '@/domain/artwork/mp4';
import { logError } from '@/services/error-log.service';
import type { ScannedSong } from '@/types/song';
import { mapLimit } from '@/utils/async';

/**
 * Extracción y caché de portadas de álbum.
 *
 * LÓGICA: la mediateca de Android no expone el arte embebido, así que se
 * resuelve en dos pasos:
 * 1. Arte embebido, leído directamente del archivo de audio:
 *    - MP3: tag ID3v2 (frame APIC) al inicio del archivo.
 *    - M4A/MP4: átomo `moov/udta/meta/ilst/covr`, navegando sin cargar el audio.
 *    - FLAC: bloque `PICTURE` (o `METADATA_BLOCK_PICTURE`), saltando el audio.
 * 2. Respaldo de carpeta: una imagen suelta (`cover.jpg`, `folder.png`…) junto
 *    al archivo, como hacen los reproductores que sí muestran la portada.
 * El arte embebido se guarda en `Paths.cache/artwork/{mediaId}.(jpg|png|webp|gif)`
 * y su URI se persiste en SQLite (`artwork_uri` de songs y albums). El arte de
 * carpeta se referencia en su sitio (no se copia) para no duplicar la imagen.
 */

const ARTWORK_DIRECTORY = 'artwork';
/** Techo de seguridad para tags ID3 gigantes. */
const ID3_TAG_MAX_BYTES = 2 * 1024 * 1024;
/** Techo de seguridad para imágenes embebidas absurdamente grandes. */
const EMBEDDED_ART_MAX_BYTES = 10 * 1024 * 1024;
/** Canciones que se prueban por álbum antes de rendirse. */
export const MAX_ATTEMPTS_PER_ALBUM = 5;
/** Archivos analizados en paralelo durante la extracción. */
export const EXTRACTION_CONCURRENCY = 3;

/** Extensiones de audio cuyo contenedor sabemos inspeccionar. */
const EMBEDDED_ART_EXTENSIONS = new Set(['mp3', 'm4a', 'mp4', 'm4b', 'aac', 'flac']);

/**
 * Nombres base habituales de la portada de carpeta (sin extensión).
 * Se comparan en minúsculas contra el nombre del archivo.
 */
const FOLDER_ART_NAMES = new Set([
  'album',
  'albumart',
  'albumartsmall',
  'artwork',
  'cover',
  'folder',
  'front',
  'thumb',
]);

/** Extensiones de imagen aceptadas para el arte de carpeta. */
const FOLDER_ART_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

/** Órdenes de formato soportados, derivados del mapa de extensiones. */
const ARTWORK_MIMES = Object.keys(EXTENSION_BY_MIME) as ArtworkMime[];

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

function cacheFileFor(mediaId: string, mime: ArtworkMime): File {
  const safeId = mediaId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return new File(Paths.cache, ARTWORK_DIRECTORY, `${safeId}.${EXTENSION_BY_MIME[mime]}`);
}

function cachedArtworkUri(mediaId: string): string | null {
  for (const mime of ARTWORK_MIMES) {
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

    // Firma "fLaC" → contenedor FLAC.
    if (ascii(header, 0, 4) === 'fLaC') {
      const instance = handle;
      const reader = async (offset: number, length: number) => {
        instance.offset = offset;
        return await instance.readBytes(length);
      };
      const artwork = await extractFlacArtwork(reader, size);
      return artwork && artwork.data.length <= EMBEDDED_ART_MAX_BYTES ? artwork : null;
    }

    return null;
  } finally {
    handle?.close();
  }
}

/** Escribe la portada embebida en la caché y devuelve su URI. */
async function writeArtworkCache(
  mediaId: string,
  artwork: EmbeddedArtwork
): Promise<string | null> {
  try {
    const directory = new Directory(Paths.cache, ARTWORK_DIRECTORY);
    if (!directory.exists) {
      directory.create();
    }
    const target = cacheFileFor(mediaId, artwork.mime);
    await target.write(artwork.data);
    return target.uri;
  } catch (error) {
    logError('artwork-service', 'write-cache', error);
    return null;
  }
}

/** Carpeta contenedora de una URI `file://`; `null` si no la expone. */
function folderFromFileUri(uri: string): string | null {
  const clean = uri.split('?')[0];
  if (!clean.startsWith('file://')) {
    return null;
  }
  const slash = clean.lastIndexOf('/');
  if (slash <= 'file://'.length) {
    return null;
  }
  return clean.slice(0, slash);
}

/** Comprueba la firma binaria de una imagen leyendo solo sus primeros bytes. */
async function hasImageSignature(file: File): Promise<boolean> {
  let handle: FileHandle | null = null;
  try {
    handle = file.open(FileMode.ReadOnly);
    const header = await handle.readBytes(16);
    return header ? sniffArtworkMime(header) !== null : false;
  } catch {
    return false;
  } finally {
    handle?.close();
  }
}

/**
 * Busca una imagen de portada junto al archivo de audio (`cover.jpg`,
 * `folder.png`, `albumart.webp`…).
 *
 * LÓGICA: muchos discos no llevan la portada embebida sino un archivo suelto
 * en la carpeta del álbum; es el respaldo que usan los reproductores que sí la
 * muestran. Se enumera la carpeta (solo con URIs `file://`) y se acepta la
 * primera imagen cuyo nombre base esté en la lista y cuya firma sea válida.
 * Se devuelve la URI original (no se copia) para no duplicar la imagen.
 */
async function readFolderArtwork(uri: string): Promise<string | null> {
  const folder = folderFromFileUri(uri);
  if (!folder) {
    return null;
  }

  let entries: (File | Directory)[];
  try {
    entries = new Directory(folder).list();
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!(entry instanceof File)) {
      continue;
    }
    const name = entry.name.toLowerCase();
    const dot = name.lastIndexOf('.');
    if (dot <= 0) {
      continue;
    }
    const base = name.slice(0, dot);
    const extension = name.slice(dot + 1);
    if (!FOLDER_ART_NAMES.has(base) || !FOLDER_ART_EXTENSIONS.has(extension)) {
      continue;
    }
    if (!entry.exists || entry.size === 0) {
      continue;
    }
    if (!(await hasImageSignature(entry))) {
      continue;
    }
    return entry.uri;
  }
  return null;
}

/**
 * URI de la portada de una canción: reutiliza la caché si existe y, si no,
 * prueba el arte embebido y luego el de la carpeta.
 */
export async function resolveArtworkUri(song: {
  mediaId: string;
  uri: string;
}): Promise<string | null> {
  const cached = cachedArtworkUri(song.mediaId);
  if (cached) {
    return cached;
  }

  if (shouldAttempt(song.uri)) {
    let artwork: EmbeddedArtwork | null;
    try {
      artwork = await readEmbeddedArtwork(song.uri);
    } catch (error) {
      logError('artwork-service', 'readEmbeddedArtwork', error);
      artwork = null;
    }
    if (artwork) {
      const uri = await writeArtworkCache(song.mediaId, artwork);
      if (uri) {
        return uri;
      }
    }
  }

  try {
    return await readFolderArtwork(song.uri);
  } catch (error) {
    logError('artwork-service', 'readFolderArtwork', error);
    return null;
  }
}

/**
 * Resuelve la portada de un álbum probando hasta `MAX_ATTEMPTS_PER_ALBUM` de
 * sus pistas (caché → arte embebido → arte de carpeta).
 *
 * LÓGICA: una extracción por álbum basta porque el arte embebido y el de
 * carpeta son iguales para todas las pistas del disco; probar varias pistas
 * cubre el caso de un archivo concreto ilegible o sin portada. Se comparte
 * entre el escaneo y el barrido de carátulas ausentes (`FASE 5.1`).
 */
export async function resolveAlbumArtwork(
  songs: readonly { mediaId: string; uri: string }[]
): Promise<string | null> {
  for (const song of songs.slice(0, MAX_ATTEMPTS_PER_ALBUM)) {
    try {
      const uri = await resolveArtworkUri(song);
      if (uri) {
        return uri;
      }
    } catch (error) {
      logError('artwork-service', 'resolveAlbumArtwork', error);
    }
  }
  return null;
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
  const uris = await mapLimit(entries, EXTRACTION_CONCURRENCY, (group) =>
    resolveAlbumArtwork(group)
  );

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
