import { ascii, sniffArtwork, u32, type AsyncByteReader, type EmbeddedArtwork } from '@/domain/artwork/bytes';

/**
 * Parser de átomos MP4/M4A para extraer la portada (`moov/udta/meta/ilst/covr`).
 *
 * LÓGICA: en vez de cargar el archivo completo, se navega el árbol de
 * átomos pidiendo solo los headers (8 bytes) al reader — así el `mdat`
 * (el audio, la parte más grande) se salta sin leerlo. Solo se descarga
 * el payload final del átomo `covr/data` (la imagen).
 */

type AtomRange = {
  payloadStart: number;
  end: number;
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

/** Extrae la portada embebida de un contenedor MP4/M4A. */
export async function extractMp4Artwork(
  read: AsyncByteReader,
  fileSize: number
): Promise<EmbeddedArtwork | null> {
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
  const ilst = await findAtom(read, meta.payloadStart + 4, meta.end, 'ilst');
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
