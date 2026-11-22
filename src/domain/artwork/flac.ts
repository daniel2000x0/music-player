import {
  ascii,
  sniffArtwork,
  u24,
  u32,
  u32le,
  type AsyncByteReader,
  type EmbeddedArtwork,
} from '@/domain/artwork/bytes';
import { cleanText, decodeUtf8, parseTrackNumber, type AudioTags } from '@/domain/metadata';

/**
 * Parser del contenedor FLAC (Free Lossless Audio Codec).
 *
 * LÓGICA: el archivo empieza con la firma `fLaC` seguida de una cadena de
 * bloques de metadatos. Cada bloque tiene un header de 4 bytes (1 de
 * flag+tipo, 3 de longitud big-endian) y su contenido. Se recorre la cadena
 * pidiendo al reader solo lo necesario:
 * - `VORBIS_COMMENT` (tipo 4) → etiquetas de texto (`TITLE`, `ARTIST`, ...),
 *   codificadas en little-endian.
 * - `PICTURE` (tipo 6) → portada embebida (prefiriendo la frontal).
 * Los bloques que no interesan (STREAMINFO, PADDING, SEEKTABLE…) se saltan
 * sin leer su contenido: solo se piden sus 4 bytes de header.
 *
 * Los FLAC etiquetados por algunas herramientas guardan la portada como
 * comentario `METADATA_BLOCK_PICTURE` (base64 del bloque PICTURE) en lugar de
 * un bloque PICTURE; también se cubre ese caso.
 */

const BLOCK_STREAMINFO = 0;
const BLOCK_VORBIS_COMMENT = 4;
const BLOCK_PICTURE = 6;
const PICTURE_TYPE_FRONT_COVER = 3;

/** Techo de seguridad para un bloque de comentarios corrupto o gigante. */
const VORBIS_COMMENT_MAX_BYTES = 1024 * 1024;
/** Techo de seguridad para una portada embebida absurda. */
const PICTURE_MAX_BYTES = 10 * 1024 * 1024;

type FlacBlock = {
  type: number;
  start: number;
  end: number;
};

type FlacPicture = {
  pictureType: number;
  data: Uint8Array;
};

/**
 * Lista los bloques de metadatos leyendo solo sus headers.
 * Devuelve `null` si el archivo no empieza por `fLaC`; corta ante un bloque
 * truncado o corrupto en lugar de fallar.
 */
async function listBlocks(read: AsyncByteReader, fileSize: number): Promise<FlacBlock[] | null> {
  const signature = await read(0, 4);
  if (!signature || signature.length < 4 || ascii(signature, 0, 4) !== 'fLaC') {
    return null;
  }

  const blocks: FlacBlock[] = [];
  let offset = 4;
  while (offset + 4 <= fileSize) {
    const header = await read(offset, 4);
    if (!header || header.length < 4) {
      break;
    }
    const last = (header[0] & 0x80) !== 0;
    const type = header[0] & 0x7f;
    const start = offset + 4;
    const end = start + u24(header, 1);
    if (end > fileSize) {
      break;
    }
    blocks.push({ type, start, end });
    if (last) {
      break;
    }
    offset = end;
  }
  return blocks;
}

/** Entero little-endian de 4 bytes; `null` si no cabe en el buffer. */
function le32(data: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > data.length) {
    return null;
  }
  return u32le(data, offset);
}

/**
 * Extrae las entradas `CLAVE=valor` de un bloque VORBIS_COMMENT.
 * Formato: longitud de vendor (LE) + vendor + nº de comentarios (LE) + cada
 * comentario como longitud (LE) + texto UTF-8.
 */
function commentEntries(data: Uint8Array): string[] {
  const entries: string[] = [];
  const vendorLength = le32(data, 0);
  if (vendorLength === null) {
    return entries;
  }
  let offset = 4 + vendorLength;
  const count = le32(data, offset);
  if (count === null) {
    return entries;
  }
  offset += 4;

  for (let index = 0; index < count; index++) {
    const length = le32(data, offset);
    if (length === null || length < 0) {
      break;
    }
    offset += 4;
    if (offset + length > data.length) {
      break;
    }
    entries.push(decodeUtf8(data, offset, offset + length));
    offset += length;
  }
  return entries;
}

/** Separa una entrada `CLAVE=valor`; la clave se normaliza a mayúsculas. */
function keyValue(entry: string): [string, string] | null {
  const separator = entry.indexOf('=');
  if (separator <= 0) {
    return null;
  }
  return [entry.slice(0, separator).toUpperCase(), entry.slice(separator + 1)];
}

/** Alfabeto base64 estándar (RFC 4648). */
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodifica base64 ignorando espacios y el relleno; `null` si no hay datos. */
function decodeBase64(input: string): Uint8Array | null {
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, '');
  if (clean.length === 0) {
    return null;
  }
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let index = 0; index < clean.length; index++) {
    const char = clean[index];
    if (char === '=') {
      break;
    }
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return out.length > 0 ? Uint8Array.from(out) : null;
}

/**
 * Parsea el contenido de un bloque PICTURE (o de un METADATA_BLOCK_PICTURE ya
 * decodificado): tipo (4) + MIME + descripción + dimensiones + datos.
 */
function parseFlacPicture(data: Uint8Array): FlacPicture | null {
  if (data.length < 8) {
    return null;
  }
  const pictureType = u32(data, 0);
  let offset = 4;

  const mimeLength = u32(data, offset);
  offset += 4;
  if (offset + mimeLength + 4 > data.length) {
    return null;
  }
  offset += mimeLength; // El MIME declarado no es fiable: decide la firma.

  const descriptionLength = u32(data, offset);
  offset += 4;
  // Tras la descripción vienen width/height/depth/colors (16 bytes) + longitud.
  if (offset + descriptionLength + 20 > data.length) {
    return null;
  }
  offset += descriptionLength + 16;

  const dataLength = u32(data, offset);
  offset += 4;
  if (offset + dataLength > data.length) {
    return null;
  }
  return { pictureType, data: data.subarray(offset, offset + dataLength) };
}

/** Lee un bloque PICTURE completo; `null` si está vacío o es demasiado grande. */
async function readPictureBlock(
  read: AsyncByteReader,
  block: FlacBlock
): Promise<FlacPicture | null> {
  const length = block.end - block.start;
  if (length <= 0 || length > PICTURE_MAX_BYTES) {
    return null;
  }
  const data = await read(block.start, length);
  return data ? parseFlacPicture(data) : null;
}

/** Busca la portada `METADATA_BLOCK_PICTURE` dentro de un bloque de comentarios. */
async function readCommentPicture(
  read: AsyncByteReader,
  block: FlacBlock
): Promise<FlacPicture | null> {
  const length = Math.min(block.end - block.start, VORBIS_COMMENT_MAX_BYTES);
  if (length <= 0) {
    return null;
  }
  const data = await read(block.start, length);
  if (!data) {
    return null;
  }
  for (const entry of commentEntries(data)) {
    const pair = keyValue(entry);
    if (pair && pair[0] === 'METADATA_BLOCK_PICTURE') {
      const decoded = decodeBase64(pair[1].trim());
      if (decoded) {
        return parseFlacPicture(decoded);
      }
    }
  }
  return null;
}

/**
 * Extrae la mejor portada de un FLAC.
 * Devuelve la frontal si existe; si no, la primera imagen válida. `null` si el
 * archivo no es FLAC o no trae ninguna portada reconocible.
 */
export async function extractFlacArtwork(
  read: AsyncByteReader,
  fileSize: number
): Promise<EmbeddedArtwork | null> {
  const blocks = await listBlocks(read, fileSize);
  if (!blocks) {
    return null;
  }

  let anyArtwork: EmbeddedArtwork | null = null;
  for (const block of blocks) {
    let picture: FlacPicture | null = null;
    if (block.type === BLOCK_PICTURE) {
      picture = await readPictureBlock(read, block);
    } else if (block.type === BLOCK_VORBIS_COMMENT) {
      picture = await readCommentPicture(read, block);
    }
    if (!picture) {
      continue;
    }
    const artwork = sniffArtwork(picture.data);
    if (!artwork) {
      continue;
    }
    if (picture.pictureType === PICTURE_TYPE_FRONT_COVER) {
      return artwork;
    }
    anyArtwork = anyArtwork ?? artwork;
  }
  return anyArtwork;
}

type FlacStreamInfo = {
  bitDepth: number | null;
  sampleRate: number | null;
};

/**
 * Lee el bloque STREAMINFO (tipo 0) para obtener bit depth y sample rate.
 * Formato: 10 bytes min/max block/frame + 8 bytes con sampleRate(20) +
 * channels(3) + bitsPerSample(5) + totalSamples(36).
 */
async function readStreamInfo(
  read: AsyncByteReader,
  blocks: FlacBlock[]
): Promise<FlacStreamInfo> {
  const block = blocks.find((item) => item.type === BLOCK_STREAMINFO);
  if (!block || block.end - block.start < 18) {
    return { bitDepth: null, sampleRate: null };
  }
  const data = await read(block.start, 18);
  if (!data || data.length < 18) {
    return { bitDepth: null, sampleRate: null };
  }
  // Bytes 10..13: sampleRate(20 bits) | channels-1(3) | bitsPerSample-1(5) | totalSamples_hi(4)
  const sampleRate = ((data[10] << 12) | (data[11] << 4) | (data[12] >> 4)) >>> 0;
  const bitDepth = (((data[12] & 0x01) << 4) | (data[13] >> 4)) + 1;
  // Valida rangos reales: evita basura de fixtures/placeholders con ceros.
  const validSampleRate = sampleRate > 0 ? sampleRate : null;
  const validBitDepth = bitDepth >= 4 && bitDepth <= 32 ? bitDepth : null;
  return { sampleRate: validSampleRate, bitDepth: validBitDepth };
}

/**
 * Lee las etiquetas de texto y datos técnicos de un FLAC.
 * Devuelve `null` si el archivo no es FLAC o no trae ningún dato útil.
 */
export async function extractFlacTags(
  read: AsyncByteReader,
  fileSize: number
): Promise<AudioTags | null> {
  const blocks = await listBlocks(read, fileSize);
  if (!blocks) {
    return null;
  }
  const streamInfo = await readStreamInfo(read, blocks);
  const comment = blocks.find((block) => block.type === BLOCK_VORBIS_COMMENT);
  const tags: AudioTags = {
    title: null,
    artist: null,
    album: null,
    albumArtist: null,
    track: null,
    bitDepth: streamInfo.bitDepth,
    sampleRate: streamInfo.sampleRate,
    bitrate: null,
  };
  let found = streamInfo.bitDepth !== null || streamInfo.sampleRate !== null;

  if (!comment) {
    return found ? tags : null;
  }
  const length = Math.min(comment.end - comment.start, VORBIS_COMMENT_MAX_BYTES);
  if (length <= 0) {
    return found ? tags : null;
  }
  const data = await read(comment.start, length);
  if (!data) {
    return found ? tags : null;
  }

  for (const entry of commentEntries(data)) {
    const pair = keyValue(entry);
    if (!pair) {
      continue;
    }
    const [key, rawValue] = pair;
    const value = cleanText(rawValue);
    if (!value) {
      continue;
    }
    if (key === 'TITLE' && !tags.title) {
      tags.title = value;
      found = true;
    } else if (key === 'ARTIST') {
      tags.artist = tags.artist ? `${tags.artist}, ${value}` : value;
      found = true;
    } else if (key === 'ALBUM' && !tags.album) {
      tags.album = value;
      found = true;
    } else if ((key === 'ALBUMARTIST' || key === 'ALBUM ARTIST') && !tags.albumArtist) {
      tags.albumArtist = value;
      found = true;
    } else if (key === 'TRACKNUMBER' && tags.track === null) {
      tags.track = parseTrackNumber(value);
      found = found || tags.track !== null;
    }
  }

  return found ? tags : null;
}
