/**
 * Utilidades binarias compartidas por los parsers de arte embebido.
 *
 * LÓGICA: los parsers ID3v2 y MP4 leen estructuras big-endian; estos
 * helpers evitan duplicar la lógica de lectura y validación de firmas.
 */

/** Formatos de imagen que la app reconoce como portada. */
export type ArtworkMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** Extensión de archivo para cada formato de portada (usada en la caché). */
export const EXTENSION_BY_MIME: Record<ArtworkMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Arte embebido en un archivo de audio (portada de álbum). */
export type EmbeddedArtwork = {
  data: Uint8Array;
  mime: ArtworkMime;
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

/** Entero de 3 bytes big-endian en `offset` (tamaño de bloque FLAC). */
export function u24(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

/** Entero de 4 bytes little-endian en `offset` (comentarios Vorbis). */
export function u32le(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
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
 * Valida la firma real de la imagen (JPEG/PNG/WebP/GIF) y devuelve su MIME.
 *
 * LÓGICA: el MIME declarado en los tags suele faltar o mentir; la firma
 * binaria es la fuente de verdad para decidir la extensión del cache.
 */
export function sniffArtworkMime(data: Uint8Array): ArtworkMime | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  ) {
    return 'image/png';
  }
  // WebP: contenedor RIFF con la firma "WEBP" en [8..12).
  if (data.length >= 12 && ascii(data, 0, 4) === 'RIFF' && ascii(data, 8, 4) === 'WEBP') {
    return 'image/webp';
  }
  // GIF: "GIF87a" o "GIF89a".
  if (data.length >= 6 && ascii(data, 0, 3) === 'GIF') {
    const version = ascii(data, 3, 3);
    if (version === '87a' || version === '89a') {
      return 'image/gif';
    }
  }
  return null;
}

/**
 * Valida la firma de la imagen y la envuelve como artwork; `null` si no es un
 * formato reconocido.
 */
export function sniffArtwork(data: Uint8Array): EmbeddedArtwork | null {
  const mime = sniffArtworkMime(data);
  return mime ? { data, mime } : null;
}
