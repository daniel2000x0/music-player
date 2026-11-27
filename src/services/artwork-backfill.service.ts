import { songRepository, type ArtworkCandidate } from '@/data/repositories/song.repository';
import type { ScanProgress } from '@/domain/library/scan-progress';
import {
  EXTRACTION_CONCURRENCY,
  isUsableArtworkUri,
  resolveAlbumArtwork,
  resolveArtworkUri,
} from '@/services/artwork.service';
import { logError } from '@/services/error-log.service';
import { mapLimit } from '@/utils/async';

/**
 * Barrido de carátulas ausentes (`FASE 5.1`).
 *
 * LÓGICA: las pistas guardadas antes de leer FLAC o arte de carpeta quedaron
 * con `artwork_uri = null` y el escaneo incremental no las vuelve a tocar (su
 * `modification_time` no cambió). Este servicio relee solo esas pistas y les
 * asigna la portada que ahora sí sabemos extraer.
 *
 * - Automático (dentro del escaneo): solo pistas nunca verificadas
 *   (`artwork_checked_at IS NULL`), así corre una vez por pista.
 * - Manual (Ajustes): `force` revisa todas las que siguen sin portada, útil
 *   tras añadir un `cover.jpg` a una carpeta.
 *
 * La extracción se agrupa por álbum (una por disco) y se sella por grupo, de
 * modo que un barrido interrumpido se reanuda donde quedó.
 */

export type ArtworkBackfillReport = {
  /** Pistas candidatas revisadas en esta pasada. */
  candidates: number;
  /** Pistas a las que se les asignó una portada. */
  resolved: number;
  /** Álbumes que recibieron portada nueva. */
  albums: number;
  /** URIs reparadas tras perder el archivo por una limpieza de caché. */
  repaired: number;
  durationMs: number;
};

export type ArtworkBackfillOptions = {
  /** `true` revisa todas las pistas sin portada, no solo las nunca verificadas. */
  force?: boolean;
  onProgress?: (progress: ScanProgress) => void;
};

export type ArtworkRepairReport = {
  /** URIs huérfanas detectadas (caché borrada o archivo persistent perdido). */
  checked: number;
  /** URIs que volvieron a apuntar a un archivo persistente. */
  resolved: number;
};

/**
 * Repara las URIs de portada que siguen en SQLite pero cuyo archivo ya no
 * existe, y las que aún apuntan al caché antiguo. `resolveArtworkUri` promueve
 * el archivo del caché al directorio persistente o vuelve a extraerlo del audio.
 * Si no hay forma de recuperarlo, se libera la URI para que un barrido posterior
 * lo intente de nuevo.
 */
export async function repairMissingArtwork(): Promise<ArtworkRepairReport> {
  const stored = await songRepository.getStoredArtworkUris();
  const broken = new Map<string, (typeof stored)[number]>();

  for (const row of stored) {
    if (broken.has(row.artworkUri)) {
      continue;
    }
    // Un archivo corrupto también sale negro: se trata como roto para que
    // `resolveArtworkUri` vuelva a extraerlo del audio en esta misma pasada.
    if (!(await isUsableArtworkUri(row.artworkUri))) {
      broken.set(row.artworkUri, row);
    }
  }

  let resolved = 0;
  for (const [oldUri, row] of broken) {
    try {
      const uri = await resolveArtworkUri({
        mediaId: row.mediaId,
        uri: row.uri,
        contentKey: row.contentKey,
      });
      if (!uri || uri === oldUri) {
        await songRepository.clearArtworkUri(oldUri);
        continue;
      }
      await songRepository.replaceArtworkUri(oldUri, uri);
      resolved += 1;
    } catch (error) {
      logError('artwork-backfill', 'repair', error);
    }
  }

  return { checked: broken.size, resolved };
}

export async function runArtworkBackfill(
  options: ArtworkBackfillOptions = {}
): Promise<ArtworkBackfillReport> {
  const startedAt = Date.now();
  const { force = false, onProgress } = options;

  // Primero se reparan las URIs rotas: si no, el backfill no las ve porque no
  // están vacías. Un fallo aquí no impide revisar el resto de la biblioteca.
  let repaired = 0;
  try {
    repaired = (await repairMissingArtwork()).resolved;
  } catch (error) {
    logError('artwork-backfill', 'repair-pass', error);
  }

  const candidates = await songRepository.getArtworkCandidates(force);
  if (candidates.length === 0) {
    return {
      candidates: 0,
      resolved: 0,
      albums: 0,
      repaired,
      durationMs: Date.now() - startedAt,
    };
  }

  // Agrupa por álbum: una extracción por disco cubre a todas sus pistas.
  const groups = new Map<number, ArtworkCandidate[]>();
  for (const candidate of candidates) {
    const bucket = groups.get(candidate.albumId);
    if (bucket) {
      bucket.push(candidate);
    } else {
      groups.set(candidate.albumId, [candidate]);
    }
  }
  const entries = [...groups.values()];

  let processed = 0;
  const emit = (): void => {
    onProgress?.({ phase: 'backfill', processed, total: entries.length });
  };
  emit();

  const uris = await mapLimit(entries, EXTRACTION_CONCURRENCY, async (group) => {
    const uri = await resolveAlbumArtwork(group);
    processed += 1;
    emit();
    return uri;
  });

  const checkedAt = Date.now();
  let resolved = 0;
  let albums = 0;
  for (let index = 0; index < entries.length; index++) {
    const group = entries[index];
    const artwork = uris[index];
    try {
      await songRepository.applyArtworkBackfill({
        songIds: group.map((candidate) => candidate.id),
        albumId: group[0].albumId,
        artwork,
        checkedAt,
      });
    } catch (error) {
      // Un fallo al persistir un grupo no debe abortar el resto del barrido.
      logError('artwork-backfill', 'persist', error);
      continue;
    }
    if (artwork) {
      resolved += group.length;
      albums += 1;
    }
  }

  return {
    candidates: candidates.length,
    resolved,
    albums,
    repaired,
    durationMs: Date.now() - startedAt,
  };
}
