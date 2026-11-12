/**
 * Metadatos de audio: tipos, decodificación de texto y reglas de respaldo.
 *
 * LÓGICA: la mediateca del dispositivo no expone las etiquetas ID3/MP4, así
 * que se leen del archivo con los parsers de `domain/artwork`. Este módulo
 * concentra la parte independiente del contenedor:
 * - decodificar texto (latin-1, UTF-8, UTF-16),
 * - interpretar el nombre de archivo y la carpeta,
 * - decidir qué valor gana cuando hay tag, nombre de archivo o carpeta.
 */

/** Etiquetas de texto leídas de un archivo de audio. */
export type AudioTags = {
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  track: number | null;
};

/** Autor/artista que se muestra cuando el archivo no trae etiqueta. */
export const UNKNOWN_ARTIST = 'Artista desconocido';

/** Autor que se muestra en la pestaña Audiolibros sin etiqueta de autor. */
export const UNKNOWN_AUTHOR = 'Autor desconocido';

/** Álbum que se muestra cuando no hay etiqueta ni carpeta útil. */
export const UNKNOWN_ALBUM = 'Sin álbum';

/**
 * Carpetas genéricas: no describen un álbum ni un libro. Se ignoran como
 * álbum para no llenar la pestaña Álbumes de "Download"/"Music".
 */
const GENERIC_FOLDERS = new Set([
  '0',
  'alarms',
  'android',
  'audio',
  'dcim',
  'download',
  'downloads',
  'documentos',
  'documents',
  'emulated',
  'files',
  'media',
  'music',
  'música',
  'notifications',
  'podcasts',
  'ringtones',
  'sdcard',
  'storage',
]);

const CHAPTER_WORDS =
  /\b(cap[ií]tulo|chapter|parte|part|episodio|episode|pr[oó]logo|prologue|introducci[oó]n|introduction|track|pista|disco|cd)\b/i;

/** Palabras que delatan un audiolibro en el nombre, álbum o carpeta. */
const AUDIOBOOK_WORDS = /\b(audiolibro|audiobook|audible|m4b)\b/i;

export function isGenericFolder(folder: string | null | undefined): boolean {
  if (!folder) {
    return true;
  }
  return GENERIC_FOLDERS.has(folder.trim().toLowerCase());
}

/** Texto limpio: sin nulos, espacios repetidos ni extremos. */
export function cleanText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const cleaned = value.replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Decodifica un buffer latin-1 (ISO-8859-1). */
export function decodeLatin1(bytes: Uint8Array, start = 0, end = bytes.length): string {
  let out = '';
  for (let i = start; i < end; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

/** Decodifica UTF-8 sin depender de `TextDecoder` (no siempre disponible en Hermes). */
export function decodeUtf8(bytes: Uint8Array, start = 0, end = bytes.length): string {
  let out = '';
  let i = start;
  while (i < end) {
    const b0 = bytes[i];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      i += 1;
    } else if (b0 >= 0xc2 && b0 < 0xe0 && i + 1 < end) {
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (b0 >= 0xe0 && b0 < 0xf0 && i + 2 < end) {
      out += String.fromCharCode(
        ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      );
      i += 3;
    } else if (b0 >= 0xf0 && b0 < 0xf5 && i + 3 < end) {
      const codePoint =
        ((b0 & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(codePoint);
      i += 4;
    } else {
      out += '\ufffd';
      i += 1;
    }
  }
  return out;
}

/**
 * Decodifica UTF-16. Si hay BOM (`FF FE` o `FE FF`) decide el orden de bytes;
 * en su defecto usa `defaultBigEndian` (ID3 encoding 1 suele traer BOM y
 * encoding 2 es big-endian por especificación).
 */
export function decodeUtf16(
  bytes: Uint8Array,
  start = 0,
  end = bytes.length,
  defaultBigEndian = false
): string {
  let bigEndian = defaultBigEndian;
  if (end - start >= 2) {
    if (bytes[start] === 0xff && bytes[start + 1] === 0xfe) {
      bigEndian = false;
      start += 2;
    } else if (bytes[start] === 0xfe && bytes[start + 1] === 0xff) {
      bigEndian = true;
      start += 2;
    }
  }

  let out = '';
  for (let i = start; i + 1 < end; i += 2) {
    const code = bigEndian
      ? (bytes[i] << 8) | bytes[i + 1]
      : (bytes[i + 1] << 8) | bytes[i];
    out += String.fromCharCode(code);
  }
  return out;
}

/** Separa valores de un frame de texto (ID3v2.4 permite varios con NUL). */
export function textValues(raw: string): string[] {
  return raw
    .split('\u0000')
    .map((value) => cleanText(value))
    .filter((value): value is string => value !== null);
}

/** Primer número de un tag de pista (`"3/12"` → 3). */
export function parseTrackNumber(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = value.match(/\d{1,4}/);
  if (!match) {
    return null;
  }
  const track = Number(match[0]);
  return track > 0 ? track : null;
}

/** `true` si el título parece un capítulo de un libro o un track numerado. */
export function looksLikeChapter(title: string): boolean {
  const clean = title.trim();
  return CHAPTER_WORDS.test(clean) || /^0*\d{1,3}$/.test(clean);
}

/** `true` si el nombre/álbum/carpeta delata un audiolibro. */
export function hasAudiobookKeyword(...values: (string | null | undefined)[]): boolean {
  return values.some((value) => Boolean(value && AUDIOBOOK_WORDS.test(value)));
}

export type ParsedFilename = {
  title: string;
  artist: string | null;
  track: number | null;
};

/**
 * Interpreta el nombre de archivo:
 * - `"01 - Título"`, `"01. Título"`, `"01_Título"` → track 1 + título.
 * - `"Artista - Título"` → artista + título.
 * - `"El Hobbit - Capítulo 3"` → artista "El Hobbit" (se reinterpreta como
 *   libro en `resolveSongMetadata`).
 */
export function parseFilename(filename: string): ParsedFilename {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const base =
    withoutExtension.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || 'Pista sin título';

  let track: number | null = null;
  let rest = base;
  const prefix = rest.match(/^[[(]?0*(\d{1,3})[\])]?\s*[-.)]\s+(.+)$/);
  if (prefix) {
    track = Number(prefix[1]) || null;
    rest = prefix[2].trim();
  }

  const parts = rest.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const artist = cleanText(parts[0]);
    const title = cleanText(parts.slice(1).join(' - '));
    if (artist && title) {
      return { title, artist, track };
    }
  }
  return { title: rest, artist: null, track };
}

export type ResolvedMetadata = {
  title: string;
  artist: string;
  album: string;
  track: number | null;
};

export type MetadataInput = {
  filename: string;
  /** Carpeta contenedora del archivo (null si el URI no la expone). */
  folder: string | null;
  tags: AudioTags | null;
};

/**
 * Decide los metadatos finales de una canción.
 *
 * PRIORIDAD: etiqueta del archivo → nombre de archivo → carpeta.
 * Si el nombre es `"Libro - Capítulo N"` y no hay tags, el prefijo se toma
 * como álbum/libro (no como autor), que es el patrón habitual de audiolibros.
 */
export function resolveSongMetadata({ filename, folder, tags }: MetadataInput): ResolvedMetadata {
  const parsed = parseFilename(filename);
  const tagTitle = cleanText(tags?.title);
  const tagArtist = cleanText(tags?.artist);
  const tagAlbum = cleanText(tags?.album);
  const tagAlbumArtist = cleanText(tags?.albumArtist);

  const title = tagTitle ?? parsed.title;
  let artist = tagArtist ?? tagAlbumArtist ?? parsed.artist;
  let album = tagAlbum;

  if (!tagArtist && !tagAlbumArtist && !tagAlbum && parsed.artist && looksLikeChapter(parsed.title)) {
    album = parsed.artist;
    artist = null;
  }

  if (!album) {
    album = folder && !isGenericFolder(folder) ? folder : UNKNOWN_ALBUM;
  }

  return {
    title: title || 'Pista sin título',
    artist: artist || UNKNOWN_ARTIST,
    album,
    track: tags?.track ?? parsed.track ?? null,
  };
}
