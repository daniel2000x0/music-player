import { ascii, sniffArtwork, u32, type AsyncByteReader, type EmbeddedArtwork } from '@/domain/artwork/bytes';
import { cleanText, decodeUtf8, type AudioTags } from '@/domain/metadata';

/**
 * Parser de átomos MP4/M4A/M4B.
 *
 * LÓGICA: en vez de cargar el archivo completo, se navega el árbol de
 * átomos pidiendo solo los headers (8 bytes) al reader — así el `mdat`
 * (el audio, la parte más grande) se salta sin leerlo. Se reutiliza el
 * mismo recorrido para:
 * - la portada (`moov/udta/meta/ilst/covr`),
 * - las etiquetas de texto (`©nam`, `©ART`, `©alb`, `aART`, `trkn`).
 */

type AtomRange = {
  payloadStart: number;
  end: number;
};

type Atom = AtomRange & {
  type: string;
};

/** Átomos de texto dentro de `ilst` que se mapean a `AudioTags`. */
const TEXT_ATOMS: Record<string, Exclude<keyof AudioTags, 'track'>> = {
  '\u00a9nam': 'title',
  '\u00a9ART': 'artist',
  '\u00a9alb': 'album',
  aART: 'albumArtist',
};

async function findAtom(
  read: AsyncByteReader,
  start: number,
  end: number,
  type: string
): Promise<AtomRange | null> {
  let offset = start;
  while (offset + 8 <= end) {
    const header = await read(offset, 8);
    if (!header || header.length < 8) {
      return null;
    }
    let size = u32(header, 0);
    const atomType = ascii(header, 4, 4);
    let headerSize = 8;

    if (size === 1) {
      // Tamaño extendido de 64 bits.
      const extended = await read(offset + 8, 8);
      if (!extended || extended.length < 8) {
        return null;
      }
      size = u32(extended, 0) * 4294967296 + u32(extended, 4);
      headerSize = 16;
    } else if (size === 0) {
      // Átomo hasta el final del rango.
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) {
      return null;
    }
    if (atomType === type) {
      return { payloadStart: offset + headerSize, end: offset + size };
    }
    offset += size;
  }
  return null;
}

/** Recorre los átomos hijos de un rango y entrega tipo y payload a `visitor`. */
async function forEachAtom(
  read: AsyncByteReader,
  start: number,
  end: number,
  visitor: (atom: Atom) => Promise<void> | void
): Promise<void> {
  let offset = start;
  while (offset + 8 <= end) {
    const header = await read(offset, 8);
    if (!header || header.length < 8) {
      return;
    }
    let size = u32(header, 0);
    const type = ascii(header, 4, 4);
    let headerSize = 8;

    if (size === 1) {
      const extended = await read(offset + 8, 8);
      if (!extended || extended.length < 8) {
        return;
      }
      size = u32(extended, 0) * 4294967296 + u32(extended, 4);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) {
      return;
    }
    await visitor({ type, payloadStart: offset + headerSize, end: offset + size });
    offset += size;
  }
}

/** Localiza `moov/udta/meta/ilst` (el contenedor de portada y etiquetas). */
async function findIlst(read: AsyncByteReader, fileSize: number): Promise<AtomRange | null> {
  const moov = await findAtom(read, 0, fileSize, 'moov');
  if (!moov) {
    return null;
  }
  const udta = await findAtom(read, moov.payloadStart, moov.end, 'udta');
  if (!udta) {
    return null;
  }
  const meta = await findAtom(read, udta.payloadStart, udta.end, 'meta');
  if (!meta) {
    return null;
  }
  // 'meta' reserva 4 bytes de versión/flags antes de sus átomos hijos.
  return findAtom(read, meta.payloadStart + 4, meta.end, 'ilst');
}

/** Extrae la portada embebida de un contenedor MP4/M4A. */
export async function extractMp4Artwork(
  read: AsyncByteReader,
  fileSize: number
): Promise<EmbeddedArtwork | null> {
  const ilst = await findIlst(read, fileSize);
  if (!ilst) {
    return null;
  }
  const covr = await findAtom(read, ilst.payloadStart, ilst.end, 'covr');
  if (!covr) {
    return null;
  }
  const dataAtom = await findAtom(read, covr.payloadStart, covr.end, 'data');
  if (!dataAtom) {
    return null;
  }
  // 'data': 8 bytes de type flags + locale antes del payload de la imagen.
  const payloadStart = dataAtom.payloadStart + 8;
  if (payloadStart >= dataAtom.end) {
    return null;
  }
  const payload = await read(payloadStart, dataAtom.end - payloadStart);
  if (!payload) {
    return null;
  }
  return sniffArtwork(payload);
}

/**
 * Lee las etiquetas de texto de un contenedor MP4/M4A/M4B.
 * Devuelve `null` si no hay `ilst` o no trae ningún campo útil.
 */
export async function extractMp4Tags(
  read: AsyncByteReader,
  fileSize: number
): Promise<AudioTags | null> {
  const ilst = await findIlst(read, fileSize);
  if (!ilst) {
    return null;
  }

  const tags: AudioTags = {
    title: null,
    artist: null,
    album: null,
    albumArtist: null,
    track: null,
  };
  let found = false;

  await forEachAtom(read, ilst.payloadStart, ilst.end, async (atom) => {
    if (atom.type === 'trkn') {
      const dataAtom = await findAtom(read, atom.payloadStart, atom.end, 'data');
      if (!dataAtom) {
        return;
      }
      // 'data': 8 bytes (type/locale) + 2 reservados + 2 de pista + 2 total.
      const payload = await read(dataAtom.payloadStart + 8, dataAtom.end - dataAtom.payloadStart - 8);
      if (payload && payload.length >= 4) {
        const track = (payload[2] << 8) | payload[3];
        if (track > 0) {
          tags.track = track;
          found = true;
        }
      }
      return;
    }

    const key = TEXT_ATOMS[atom.type];
    if (!key) {
      return;
    }
    const dataAtom = await findAtom(read, atom.payloadStart, atom.end, 'data');
    if (!dataAtom) {
      return;
    }
    const payloadStart = dataAtom.payloadStart + 8;
    if (payloadStart >= dataAtom.end) {
      return;
    }
    const payload = await read(payloadStart, dataAtom.end - payloadStart);
    if (!payload) {
      return;
    }
    const text = cleanText(decodeUtf8(payload, 0, payload.length));
    if (text) {
      tags[key] = text;
      found = true;
    }
  });

  return found ? tags : null;
}
