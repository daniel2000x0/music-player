/**
 * Apareamiento de pistas reubicadas.
 *
 * LÓGICA: el escaneo incremental compara por `mediaId`. Cuando el usuario mueve
 * o renombra un archivo, Android puede asignar un id nuevo; sin este módulo la
 * canción antigua se marca ausente y se inserta una fila nueva, perdiendo
 * favoritos, historial y playlists.
 *
 * La decisión es pura (sin I/O) para poder probar bibliotecas grandes. Se
 * empareja en orden de fiabilidad:
 * 1. huella de contenido (independiente de ruta y nombre);
 * 2. nombre + carpeta + duración (para BD anteriores a la huella);
 * 3. nombre + duración, solo si la coincidencia es única a ambos lados.
 *
 * Cada fila guardada se usa como máximo una vez, para que una canción no pueda
 * "absorber" dos pistas nuevas.
 */

export type RelocationDevice = {
  mediaId: string;
  filename: string | null;
  /** Duración en milisegundos; se compara redondeada a segundos. */
  durationMs: number;
  folder: string | null;
  contentKey: string | null;
};

export type RelocationStored = {
  mediaId: string;
  filename: string | null;
  durationMs: number;
  folder: string | null;
  contentKey: string | null;
  isAvailable: boolean;
};

/** Devuelve `oldMediaId → newMediaId` para las pistas reubicadas. */
export function matchRelocations(
  device: readonly RelocationDevice[],
  stored: readonly RelocationStored[]
): Map<string, string> {
  const available = stored.filter((item) => item.isAvailable);
  const usedStored = new Set<string>();
  const matches = new Map<string, string>();

  const byContent = new Map<string, RelocationStored[]>();
  const byFolder = new Map<string, RelocationStored[]>();
  const byName = new Map<string, RelocationStored[]>();
  const index = (map: Map<string, RelocationStored[]>, key: string, item: RelocationStored) => {
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  };

  for (const item of available) {
    if (item.contentKey) {
      index(byContent, item.contentKey, item);
    }
    if (item.filename) {
      index(byFolder, nameFolderKey(item.filename, item.folder, item.durationMs), item);
      index(byName, nameDurationKey(item.filename, item.durationMs), item);
    }
  }

  const deviceNameKeys = new Map<string, number>();
  for (const item of device) {
    if (item.filename) {
      const key = nameDurationKey(item.filename, item.durationMs);
      deviceNameKeys.set(key, (deviceNameKeys.get(key) ?? 0) + 1);
    }
  }

  const take = (map: Map<string, RelocationStored[]>, key: string): RelocationStored | null => {
    const candidates = map.get(key);
    if (!candidates) {
      return null;
    }
    const found = candidates.find((item) => !usedStored.has(item.mediaId));
    if (!found) {
      return null;
    }
    usedStored.add(found.mediaId);
    return found;
  };

  for (const item of device) {
    let found: RelocationStored | null = null;
    if (item.contentKey) {
      found = take(byContent, item.contentKey);
    }
    if (!found && item.filename) {
      found = take(byFolder, nameFolderKey(item.filename, item.folder, item.durationMs));
      if (!found) {
        const key = nameDurationKey(item.filename, item.durationMs);
        // Sin carpeta solo es seguro si no hay otra pista igual en la
        // mediateca ni otra fila guardada con el mismo nombre y duración.
        const unique = (byName.get(key)?.length ?? 0) === 1 && deviceNameKeys.get(key) === 1;
        if (unique) {
          found = take(byName, key);
        }
      }
    }
    if (found) {
      matches.set(found.mediaId, item.mediaId);
    }
  }

  return matches;
}

function durationBucket(durationMs: number): number {
  return Math.round(durationMs / 1000);
}

function nameDurationKey(filename: string, durationMs: number): string {
  return `${filename}\u0000${durationBucket(durationMs)}`;
}

function nameFolderKey(
  filename: string,
  folder: string | null,
  durationMs: number
): string {
  return `${filename}\u0000${folder ?? ''}\u0000${durationBucket(durationMs)}`;
}
