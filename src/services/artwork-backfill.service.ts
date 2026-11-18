import { songRepository, type ArtworkCandidate } from '@/data/repositories/song.repository';
import type { ScanProgress } from '@/domain/library/scan-progress';
import { EXTRACTION_CONCURRENCY, resolveAlbumArtwork } from '@/services/artwork.service';
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
  durationMs: number;
};

export type ArtworkBackfillOptions = {
  /** `true` revisa todas las pistas sin portada, no solo las nunca verificadas. */
  force?: boolean;
  onProgress?: (progress: ScanProgress) => void;
};

export async function runArtworkBackfill(
  options: ArtworkBackfillOptions = {}
): Promise<ArtworkBackfillReport> {
  const startedAt = Date.now();
  const { force = false, onProgress } = options;

  const candidates = await songRepository.getArtworkCandidates(force);
  if (candidates.length === 0) {
    return { candidates: 0, resolved: 0, albums: 0, durationMs: Date.now() - startedAt };
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
    durationMs: Date.now() - startedAt,
  };
}
