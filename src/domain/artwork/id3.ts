import { ascii, sniffArtwork, syncsafe, u32, type EmbeddedArtwork } from '@/domain/artwork/bytes';
import {
  decodeLatin1,
  decodeUtf16,
  decodeUtf8,
  parseTrackNumber,
  textValues,
  type AudioTags,
} from '@/domain/metadata';

/**
 * Parser del tag ID3v2 (v2.2/2.3/2.4).
 *
 * LÓGICA: el tag vive al inicio del MP3. Se recorre una sola vez para:
 * - extraer la portada (`APIC`/`PIC`), prefiriendo la frontal;
 * - leer los frames de texto (`TIT2`, `TPE1`, `TALB`, `TPE2`, `TRCK`).
 * El texto se decodifica según el byte de encoding de cada frame.
 */

const PICTURE_TYPE_FRONT_COVER = 3;

const TITLE_FRAMES = new Set(['TIT2', 'TT2']);
const ARTIST_FRAMES = new Set(['TPE1', 'TP1']);
const ALBUM_FRAMES = new Set(['TALB', 'TAL']);
const ALBUM_ARTIST_FRAMES = new Set(['TPE2', 'TP2']);
const TRACK_FRAMES = new Set(['TRCK', 'TRK']);

type PictureFrame = {
  pictureType: number;
  data: Uint8Array;
};

type Id3Frame = {
  id: string;
  /** Primer byte del payload (incluye el byte de encoding). */
  start: number;
  /** Byte siguiente al payload. */
  end: number;
};

/** Tamaño del body del tag ID3v2 (sin el header de 10 bytes); `null` si no es ID3. */
export function parseId3TagSize(header: Uint8Array): number | null {
  if (header.length < 10 || ascii(header, 0, 3) !== 'ID3') {
    return null;
  }
  const size = syncsafe(header, 6);
  return size > 0 ? size : null;
}

/**
 * Recorre los frames del tag y llama a `visitor` con cada uno.
 * Devuelve `false` si el buffer no es un tag ID3v2 válido.
 */
function forEachFrame(tag: Uint8Array, visitor: (frame: Id3Frame) => void): boolean {
  if (tag.length < 10 || ascii(tag, 0, 3) !== 'ID3') {
    return false;
  }
  const major = tag[3];
  if (major < 2 || major > 4) {
    return false;
  }
  const flags = tag[5];
  const bodyEnd = Math.min(tag.length, 10 + syncsafe(tag, 6));
  let offset = 10;

  // Extended header (v2.3/v2.4): saltarlo antes de los frames.
  if (major >= 3 && (flags & 0x40) !== 0) {
    if (offset + 4 > bodyEnd) {
      return true;
    }
    // v2.3: el tamaño no incluye sus 4 bytes; v2.4: sí se incluyen.
    offset += major === 4 ? syncsafe(tag, offset) : 4 + u32(tag, offset);
  }

  while (offset < bodyEnd) {
    let frameId: string;
    let frameStart: number;
    let frameSize: number;
    if (major === 2) {
      if (offset + 6 > bodyEnd) {
        break;
      }
      frameId = ascii(tag, offset, 3);
      frameSize = (tag[offset + 3] << 16) | (tag[offset + 4] << 8) | tag[offset + 5];
      frameStart = offset + 6;
    } else {
      if (offset + 10 > bodyEnd) {
        break;
      }
      frameId = ascii(tag, offset, 4);
      frameSize = major === 4 ? syncsafe(tag, offset + 4) : u32(tag, offset + 4);
      frameStart = offset + 10;
    }
    if (frameSize <= 0 || frameStart + frameSize > bodyEnd) {
      break;
    }
    visitor({ id: frameId, start: frameStart, end: frameStart + frameSize });
    offset = frameStart + frameSize;
  }
  return true;
}

function parsePictureFrame(
  tag: Uint8Array,
  start: number,
  end: number,
  major: number
): PictureFrame | null {
  if (end - start < 4) {
    return null;
  }
  const encoding = tag[start];
  let cursor = start + 1;

  if (major === 2) {
    // PIC (v2.2): formato de imagen de 3 bytes ("JPG"/"PNG") en lugar de MIME.
    cursor += 3;
  } else {
    // APIC: MIME null-terminated (latin-1).
    while (cursor < end && tag[cursor] !== 0) {
      cursor += 1;
    }
    cursor += 1;
  }
  if (cursor >= end) {
    return null;
  }
  const pictureType = tag[cursor];
  cursor += 1;

  // Descripción: terminador según el encoding del texto (UTF-16 usa 0x00 0x00).
  if (encoding === 1 || encoding === 2) {
    while (cursor + 1 < end && !(tag[cursor] === 0 && tag[cursor + 1] === 0)) {
      cursor += 2;
    }
    cursor += 2;
  } else {
    while (cursor < end && tag[cursor] !== 0) {
      cursor += 1;
    }
    cursor += 1;
  }
  if (cursor >= end) {
    return null;
  }
  return { pictureType, data: tag.subarray(cursor, end) };
}

function decodeTextFrame(tag: Uint8Array, frame: Id3Frame): string[] {
  const encoding = tag[frame.start];
  const start = frame.start + 1;
  const end = frame.end;

  switch (encoding) {
    case 1:
      return textValues(decodeUtf16(tag, start, end, false));
    case 2:
      return textValues(decodeUtf16(tag, start, end, true));
    case 3:
      return textValues(decodeUtf8(tag, start, end));
    default:
      return textValues(decodeLatin1(tag, start, end));
  }
}

/**
 * Extrae la mejor portada de un tag ID3v2 completo (header + body).
 *
 * El buffer puede venir truncado (tag gigante recortado): los frames que
 * no caben se ignoran. `null` si no hay arte con firma válida.
 */
export function extractId3Artwork(tag: Uint8Array): EmbeddedArtwork | null {
  let frontCover: EmbeddedArtwork | null = null;
  let anyArtwork: EmbeddedArtwork | null = null;

  const valid = forEachFrame(tag, (frame) => {
    if (frame.id !== 'APIC' && frame.id !== 'PIC') {
      return;
    }
    const artwork = parsePictureFrame(tag, frame.start, frame.end, tag[3]);
    if (!artwork) {
      return;
    }
    anyArtwork = anyArtwork ?? sniffArtwork(artwork.data);
    if (artwork.pictureType === PICTURE_TYPE_FRONT_COVER) {
      frontCover = frontCover ?? sniffArtwork(artwork.data);
    }
  });

  return valid ? frontCover ?? anyArtwork : null;
}

/**
 * Lee las etiquetas de texto de un tag ID3v2.
 * Devuelve `null` si el tag no es válido o no trae ningún campo útil.
 */
export function extractId3Tags(tag: Uint8Array): AudioTags | null {
  const tags: AudioTags = {
    title: null,
    artist: null,
    album: null,
    albumArtist: null,
    track: null,
  };
  let found = false;

  const valid = forEachFrame(tag, (frame) => {
    if (
      !TITLE_FRAMES.has(frame.id) &&
      !ARTIST_FRAMES.has(frame.id) &&
      !ALBUM_FRAMES.has(frame.id) &&
      !ALBUM_ARTIST_FRAMES.has(frame.id) &&
      !TRACK_FRAMES.has(frame.id)
    ) {
      return;
    }
    const values = decodeTextFrame(tag, frame);
    const first = values[0] ?? null;
    if (!first) {
      return;
    }
    found = true;

    if (TITLE_FRAMES.has(frame.id) && !tags.title) {
      tags.title = first;
    } else if (ARTIST_FRAMES.has(frame.id) && !tags.artist) {
      tags.artist = values.join(', ');
    } else if (ALBUM_FRAMES.has(frame.id) && !tags.album) {
      tags.album = first;
    } else if (ALBUM_ARTIST_FRAMES.has(frame.id) && !tags.albumArtist) {
      tags.albumArtist = values.join(', ');
    } else if (TRACK_FRAMES.has(frame.id) && tags.track === null) {
      tags.track = parseTrackNumber(first);
    }
  });

  return valid && found ? tags : null;
}
