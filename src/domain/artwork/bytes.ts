/**
 * Utilidades binarias compartidas por los parsers de arte embebido.
 *
 * LÓGICA: los parsers ID3v2 y MP4 leen estructuras big-endian; estos
 * helpers evitan duplicar la lógica de lectura y validación de firmas.
 */

/** Arte embebido en un archivo de audio (portada de álbum). */
export type EmbeddedArtwork = {
  data: Uint8Array;
  mime: 'image/jpeg' | 'image/png';
};

/** Lee `length` bytes desde `offset`; `null` si la lectura falla o queda corta. */
export type AsyncByteReader = (offset: number, length: number) => Promise<Uint8Array | null>;

/** Entero de 4 bytes big-endian en `offset`. */
export function u32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>>
    0
  );
}

/** Entero "syncsafe" de ID3v2 (4 bytes, 7 bits útiles por byte). */
export function syncsafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

/** Texto ASCII de `length` bytes desde `offset`. */
export function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

/**
 * Valida la firma real de la imagen (JPEG/PNG) y la envuelve como artwork.
 *
 * LÓGICA: el MIME declarado en los tags suele faltar o mentir; la firma
 * binaria es la fuente de verdad para decidir la extensión del cache.
 */
export function sniffArtwork(data: Uint8Array): EmbeddedArtwork | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { data, mime: 'image/jpeg' };
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return { data, mime: 'image/png' };
  }
  return null;
}
