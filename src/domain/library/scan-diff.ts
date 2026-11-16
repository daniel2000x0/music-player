/**
 * Diferencia entre la mediateca del dispositivo y la copia en SQLite.
 *
 * LÓGICA: el escaneo incremental (`M-04`) evita releer etiquetas y portadas
 * de todas las pistas cuando solo cambió una parte de la biblioteca. La
 * decisión es pura (sin I/O) para poder probarla con bibliotecas grandes:
 *
 * - `added`: pistas nuevas o guardadas como no disponibles que reaparecen.
 *   Se releen y se reactivan conservando favoritos, historial y playlists.
 * - `updated`: pistas cuyo `modificationTime` cambió (o cuya fecha aún no se
 *   había guardado tras la migración).
 * - `unchanged`: pistas con la misma fecha; no se vuelven a leer.
 * - `missing`: pistas guardadas que la mediateca ya no anuncia. No se borran:
 *   se marcan como no disponibles para conservar los datos del usuario.
 *
 * `mode` cae a `full` cuando el proveedor no expone `modificationTime`
 * (`null` o `0`). En ese caso no hay forma de comparar y se relee todo.
 */

/** Pista tal como la anuncia la consulta liviana de la mediateca. */
export type DeviceTrack = {
  mediaId: string;
  /** Última modificación en milisegundos; `null` si el proveedor no la da. */
  modificationTime: number | null;
};

/** Pista tal como está guardada en SQLite. */
export type StoredTrack = {
  mediaId: string;
  modificationTime: number | null;
  isAvailable: boolean;
};

export type ScanMode = 'incremental' | 'full';

export type ScanDiff = {
  mode: ScanMode;
  added: string[];
  updated: string[];
  unchanged: string[];
  missing: string[];
};

/** `true` si todas las pistas traen una fecha de modificación utilizable. */
export function supportsIncrementalScan(tracks: Iterable<DeviceTrack>): boolean {
  for (const track of tracks) {
    if (typeof track.modificationTime !== 'number' || track.modificationTime <= 0) {
      return false;
    }
  }
  return true;
}

/** Deduplica por `mediaId` conservando el orden de la mediateca. */
function uniqueTracks(device: readonly DeviceTrack[]): DeviceTrack[] {
  const byId = new Map<string, DeviceTrack>();
  for (const track of device) {
    if (!byId.has(track.mediaId)) {
      byId.set(track.mediaId, track);
    }
  }
  return [...byId.values()];
}

export function diffScan(
  device: readonly DeviceTrack[],
  stored: readonly StoredTrack[]
): ScanDiff {
  const tracks = uniqueTracks(device);
  const mode: ScanMode = supportsIncrementalScan(tracks) ? 'incremental' : 'full';
  const storedById = new Map(stored.map((track) => [track.mediaId, track]));

  const added: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];

  for (const track of tracks) {
    const previous = storedById.get(track.mediaId);
    if (!previous || !previous.isAvailable) {
      // Nueva o reaparecida: hay que releerla para refrescar metadatos.
      added.push(track.mediaId);
      continue;
    }
    if (mode === 'full') {
      updated.push(track.mediaId);
      continue;
    }
    // Sin fecha guardada (BD migrada) o con otra fecha: se relee una vez.
    if (
      typeof previous.modificationTime !== 'number' ||
      previous.modificationTime !== track.modificationTime
    ) {
      updated.push(track.mediaId);
      continue;
    }
    unchanged.push(track.mediaId);
  }

  const deviceIds = new Set(tracks.map((track) => track.mediaId));
  const missing = stored
    .filter((track) => track.isAvailable && !deviceIds.has(track.mediaId))
    .map((track) => track.mediaId);

  return { mode, added, updated, unchanged, missing };
}
