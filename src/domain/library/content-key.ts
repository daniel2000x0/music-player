/**
 * Huella de contenido de un archivo de audio.
 *
 * LÓGICA: el `mediaId` de la mediateca cambia cuando Android reindexa un
 * archivo que se movió o se renombró. Esta huella NO depende del nombre ni de
 * la carpeta, así que permite reconocer la misma pista en su nueva ubicación
 * y conservar su fila de SQLite (favoritos, historial y playlists incluidos).
 *
 * Se calcula con el tamaño, la duración y dos muestras (inicio y final) para no
 * leer el archivo completo: en una biblioteca grande releer cada pista entera
 * sería prohibitivo. Las dos muestras y el tamaño hacen improbable una colisión
 * incluso entre pistas del mismo álbum.
 */

/** Bytes leídos en cada extremo del archivo. */
export const CONTENT_SAMPLE_BYTES = 64 * 1024;

export type ContentFingerprint = {
  size: number;
  durationMs: number;
  head: Uint8Array;
  tail: Uint8Array;
};

/**
 * Nombre de archivo deducible de una URI de audio.
 *
 * `file://` y los documentos SAF (`content://…/document/primary%3A…`) llevan la
 * ruta; los URI de MediaStore (`content://media/…`) y `ph://` no la exponen.
 * Se normaliza a minúsculas porque en Android los nombres se comparan sin
 * distinguir mayúsculas en muchos proveedores.
 */
export function filenameFromUri(uri: string): string | null {
  try {
    const clean = uri.split('?')[0];
    if (!clean) {
      return null;
    }
    const documentMarker = '/document/';
    const documentIndex = clean.indexOf(documentMarker);
    let path: string;
    if (documentIndex >= 0) {
      path = decodeURIComponent(clean.slice(documentIndex + documentMarker.length));
    } else if (clean.startsWith('file://')) {
      path = decodeURIComponent(clean.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ''));
    } else {
      return null;
    }
    const segments = path.split('/').filter(Boolean);
    return segments.at(-1)?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** FNV-1a de 32 bits, suficiente para una muestra cuando se combinan dos. */
function fnv1a(bytes: Uint8Array, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function hex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/** Huella determinista: `tamaño-duración-inicio-fin`, toda en hexadecimal. */
export function buildContentKey(input: ContentFingerprint): string {
  const size = Math.max(0, Math.floor(input.size));
  const duration = Math.max(0, Math.round(input.durationMs));
  const headHash = fnv1a(input.head, (0x811c9dc5 ^ Math.imul(size, 0x9e3779b1)) >>> 0);
  const tailHash = fnv1a(input.tail, (0x811c9dc5 ^ Math.imul(duration, 0x85ebca6b)) >>> 0);
  return `${hex(size)}-${hex(duration)}-${hex(headHash)}${hex(tailHash)}`;
}
