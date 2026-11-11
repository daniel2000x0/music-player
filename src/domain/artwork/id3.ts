import { ascii, sniffArtwork, syncsafe, u32, type EmbeddedArtwork } from '@/domain/artwork/bytes';

/**
 * Parser del tag ID3v2 (v2.2/2.3/2.4) para extraer el frame APIC/PIC.
 *
 * LÓGICA: el arte embebido de un MP3 vive al inicio del archivo, dentro
 * del tag ID3v2. Se prefieren las portadas frontales (picture type 3) y
 * el MIME final se valida con la firma binaria de la imagen.
 */

const PICTURE_TYPE_FRONT_COVER = 3;

type PictureFrame = {
  pictureType: number;
  data: Uint8Array;
};

/** Tamaño del body del tag ID3v2 (sin el header de 10 bytes); `null` si no es ID3. */
export function parseId3TagSize(header: Uint8Array): number | null {
  if (header.length < 10 || ascii(header, 0, 3) !== 'ID3') {
    return null;
  }
  const size = syncsafe(header, 6);
  return size > 0 ? size : null;
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

/**
 * Extrae la mejor portada de un tag ID3v2 completo (header + body).
 *
 * El buffer puede venir truncado (tag gigante recortado): los frames que
 * no caben se ignoran. `null` si no hay arte con firma válida.
 */
export function extractId3Artwork(tag: Uint8Array): EmbeddedArtwork | null {
  if (tag.length < 10 || ascii(tag, 0, 3) !== 'ID3') {
    return null;
  }
  const major = tag[3];
  if (major < 2 || major > 4) {
    return null;
  }
  const flags = tag[5];
  const bodyEnd = Math.min(tag.length, 10 + syncsafe(tag, 6));
  let offset = 10;

  // Extended header (v2.3/v2.4): saltarlo antes de los frames.
  if (major >= 3 && (flags & 0x40) !== 0) {
    if (offset + 4 > bodyEnd) {
      return null;
    }
    // v2.3: el tamaño no incluye sus 4 bytes; v2.4: sí se incluyen.
    offset += major === 4 ? syncsafe(tag, offset) : 4 + u32(tag, offset);
  }

  let frontCover: EmbeddedArtwork | null = null;
  let anyArtwork: EmbeddedArtwork | null = null;

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
    if (frameId === 'APIC' || frameId === 'PIC') {
      const artwork = parsePictureFrame(tag, frameStart, frameStart + frameSize, major);
      if (artwork) {
        anyArtwork = anyArtwork ?? sniffArtwork(artwork.data);
        if (artwork.pictureType === PICTURE_TYPE_FRONT_COVER) {
          frontCover = frontCover ?? sniffArtwork(artwork.data);
        }
      }
    }
    offset = frameStart + frameSize;
  }

  return frontCover ?? anyArtwork;
}
