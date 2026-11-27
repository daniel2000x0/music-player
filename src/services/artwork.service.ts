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
 * El arte embebido se guarda en `Paths.document/artwork/{clave}.(jpg|png|webp|gif)`,
 * donde `clave` es la huella de contenido de la pista (o su `mediaId` en filas
 * antiguas), y su URI se persiste en SQLite (`artwork_uri` de songs y albums).
 * `Paths.document` es el directorio persistente de la app: a diferencia de
 * `Paths.cache`, ni el sistema ni un limpiador de caché pueden borrarlo. El arte
 * de carpeta se referencia en su sitio (no se copia) para no duplicar la imagen.
 * Cuando la canción se mueve, `remapArtwork` traslada el archivo a la clave new
 * o vuelve a buscar el `cover.jpg` junto a la nueva ruta.
 *
 * Las versiones anteriores escribían en `Paths.cache/artwork`. Esos archivos se
 * promueven al directorio persistente al resolverlos (`storedArtworkFile`) y sus
 * URIs se reescriben en SQLite desde `artwork-backfill.service`.
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

/** Extensiones de los archivos gestionados por la app. */
const ARTWORK_EXTENSIONS = new Set(Object.values(EXTENSION_BY_MIME));

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

/** Directorio persistente (no borrado por limpiezas de caché). */
function artworkDirectory(): Directory {
  return new Directory(Paths.document, ARTWORK_DIRECTORY);
}

/** Directorio usado por versiones anteriores; solo se lee para migrar. */
function legacyArtworkDirectory(): Directory {
  return new Directory(Paths.cache, ARTWORK_DIRECTORY);
}

/** Prefijo URI con barra final, para comparar sin falsos positivos. */
function directoryPrefix(directory: Directory): string {
  return `${directory.uri.replace(/\/$/, '')}/`;
}

/**
 * Los prefijos se calculan bajo demanda, no al cargar el módulo: en el bundle
 * de servidor de Expo Router (`Paths.document` no es un `Directory`) hacerlo
 * arriba tumbaba el servidor con `this.validatePath is not a function`.
 */
function artworkUriPrefix(): string {
  return directoryPrefix(artworkDirectory());
}

function legacyArtworkUriPrefix(): string {
  return directoryPrefix(legacyArtworkDirectory());
}

/** Normaliza cualquier identificador (mediaId o huella) a nombre de archivo. */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Clave del archivo persistido: la huella de contenido cuando está disponible,
 * porque sobrevive a reindexados; el `mediaId` en filas anteriores a la V12.
 */
function artworkKeyFor(song: { mediaId: string; contentKey?: string | null }): string {
  return song.contentKey ?? song.mediaId;
}

function cacheFileFor(key: string, mime: ArtworkMime): File {
  return new File(artworkDirectory(), `${safeId(key)}.${EXTENSION_BY_MIME[mime]}`);
}

function legacyCacheFileFor(key: string, mime: ArtworkMime): File {
  return new File(legacyArtworkDirectory(), `${safeId(key)}.${EXTENSION_BY_MIME[mime]}`);
}

/** Extensión de una URI de portada, en minúsculas. */
function extensionOf(uri: string): string {
  const clean = uri.split('?')[0].toLowerCase();
  const dot = clean.lastIndexOf('.');
  return dot === -1 ? '' : clean.slice(dot + 1);
}

/** `true` si la URI apunta a un archivo gestionado por la app. */
export function isManagedArtworkUri(uri: string): boolean {
  return uri.startsWith(artworkUriPrefix()) || uri.startsWith(legacyArtworkUriPrefix());
}

/**
 * Portada ya almacenada de una pista. Si solo existe en el caché antiguo, se
 * copia al directorio persistente y se devuelve la URI nueva. Ante un error de
 * copia se sigue sirviendo la URI vieja: es mejor mostrarla desde el caché que
 * perder la portada hasta el próximo barrido.
 */
async function storedArtworkFile(key: string): Promise<File | null> {
  for (const mime of ARTWORK_MIMES) {
    const file = cacheFileFor(key, mime);
    // `exists` no basta: un archivo truncado o corrupto tiene bytes pero
    // `expo-image` lo pinta como un cuadro negro. Solo se sirve si su firma
    // es una imagen reconocible.
    if (file.exists && file.size > 0 && (await hasImageSignature(file))) {
      return file;
    }

    const legacy = legacyCacheFileFor(key, mime);
    if (!legacy.exists || legacy.size === 0 || !(await hasImageSignature(legacy))) {
      continue;
    }
    try {
      const directory = artworkDirectory();
      if (!directory.exists) {
        directory.create();
      }
      await legacy.copy(file, { overwrite: true });
      return file;
    } catch (error) {
      logError('artwork-service', 'promote-cache', error);
      return legacy;
    }
  }
  return null;
}

/**
 * `true` si la URI guardada en SQLite debe repararse: apunta al caché antiguo
 * (aunque el archivo siga ahí), a un archivo gestionado borrado o a una portada
 * de carpeta que ya no está junto a la canción (se movió el álbum).
 */
export function needsArtworkRepair(uri: string): boolean {
  if (uri.startsWith(legacyArtworkUriPrefix())) {
    return true;
  }
  if (uri.startsWith(artworkUriPrefix())) {
    return !new File(uri).exists;
  }
  // Las portadas de carpeta no se copian: si el archivo desapareció, hay que
  // volver a buscarlo en la nueva ubicación. Los URI content:// se dejan
  // intactos porque `File.exists` no los resuelve de forma fiable.
  return uri.startsWith('file://') && !new File(uri).exists;
}

/**
 * `true` si una URI guardada todavía puede pintarse. Además de comprobar que
 * el archivo exista, valida su firma: un archivo corrupto o a medias escribir
 * pasa `exists` pero se muestra negro en la lista. Los `content://` se dejan
 * intactos porque el proveedor ya valida el contenido al leerlo.
 */
export async function isUsableArtworkUri(uri: string): Promise<boolean> {
  if (uri.startsWith('content://')) {
    return true;
  }
  if (needsArtworkRepair(uri)) {
    return false;
  }
  try {
    return await hasImageSignature(new File(uri));
  } catch {
    return false;
  }
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

/** Escribe la portada embebida en el almacenamiento persistente y devuelve su URI. */
async function writeArtworkCache(
  key: string,
  artwork: EmbeddedArtwork
): Promise<string | null> {
  const target = cacheFileFor(key, artwork.mime);
  try {
    const directory = artworkDirectory();
    if (!directory.exists) {
      directory.create();
    }
    await target.write(artwork.data);
  } catch (error) {
    logError('artwork-service', 'write-cache', error);
    return null;
  }

  // La copia ya es persistente: retirar el duplicado del caché antiguo evita
  // que un limpiador vuelva a dejar la URI en un archivo inexistente.
  for (const mime of ARTWORK_MIMES) {
    const legacy = legacyCacheFileFor(key, mime);
    if (!legacy.exists) {
      continue;
    }
    try {
      legacy.delete();
    } catch {
      // Si no se puede borrar, la próxima resolución lo promoverá de nuevo.
    }
  }

  return target.uri;
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
 * Traslada la portada de una pista que cambió de ruta/`mediaId`.
 *
 * LÓGICA: los archivos gestionados por la app se renombran a la nueva huella de
 * contenido (o al nuevo `mediaId` si aún no hay huella), porque el contenido no
 * cambió al mover el archivo. Las portadas de carpeta no se copian: se buscan de
 * nuevo junto a la nueva ruta. Ante cualquier error se devuelve `null` para que
 * la BD libere la URI y el backfill pueda reintentarlo.
 */
export async function remapArtworkUri(params: {
  oldUri: string | null;
  nextMediaId: string;
  nextUri: string;
  nextContentKey?: string | null;
}): Promise<string | null> {
  const { oldUri, nextMediaId, nextUri, nextContentKey } = params;
  if (!oldUri) {
    return null;
  }

  if (!isManagedArtworkUri(oldUri)) {
    try {
      return await readFolderArtwork(nextUri);
    } catch (error) {
      logError('artwork-service', 'remap-folder', error);
      return null;
    }
  }

  const extension = extensionOf(oldUri);
  if (!ARTWORK_EXTENSIONS.has(extension)) {
    return null;
  }
  const key = nextContentKey ?? nextMediaId;
  const source = new File(oldUri);
  const target = new File(artworkDirectory(), `${safeId(key)}.${extension}`);
  if (!source.exists || source.size === 0) {
    return null;
  }
  if (source.uri === target.uri) {
    return source.uri;
  }

  try {
    if (!target.exists || target.size === 0) {
      const directory = artworkDirectory();
      if (!directory.exists) {
        directory.create();
      }
      await source.copy(target, { overwrite: true });
    }
    source.delete();
    return target.uri;
  } catch (error) {
    logError('artwork-service', 'remap-cache', error);
    return null;
  }
}

/**
 * URI de la portada de una canción: reutiliza el archivo persistente (o promueve
 * el del caché antiguo) si existe y, si no, prueba el arte embebido y luego el de
 * la carpeta.
 */
export async function resolveArtworkUri(song: {
  mediaId: string;
  uri: string;
  contentKey?: string | null;
}): Promise<string | null> {
  const key = artworkKeyFor(song);
  const stored = await storedArtworkFile(key);
  if (stored) {
    return stored.uri;
  }

  // Una biblioteca migrada puede conservar su portada bajo el `mediaId`
  // aunque la fila ya tenga huella de contenido (V12). Se reutiliza en vez
  // de descartarla y obligar a reextraerla del audio.
  if (song.contentKey && song.contentKey !== song.mediaId) {
    const byMediaId = await storedArtworkFile(song.mediaId);
    if (byMediaId) {
      return byMediaId.uri;
    }
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
      const uri = await writeArtworkCache(key, artwork);
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
  songs: readonly { mediaId: string; uri: string; contentKey?: string | null }[]
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
