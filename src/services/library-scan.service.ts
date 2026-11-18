import { songRepository } from '@/data/repositories/song.repository';
import { diffScan, type DeviceTrack } from '@/domain/library/scan-diff';
import type { ScanProgress } from '@/domain/library/scan-progress';
import type { ScanReport } from '@/domain/library/scan-report';
import { runArtworkBackfill } from '@/services/artwork-backfill.service';
import { assignAlbumArtwork } from '@/services/artwork.service';
import { logError } from '@/services/error-log.service';
import { TAG_CONCURRENCY, enumerateDeviceAudio, readDeviceTrack } from '@/services/media.service';
import type { ScannedSong } from '@/types/song';
import { mapLimit } from '@/utils/async';

/**
 * Pipeline de escaneo de la biblioteca.
 *
 * RESPONSABILIDAD ÚNICA: llevar la mediateca a SQLite en fases observables y
 * sin releer lo que no cambió. Los permisos, la enumeración y la lectura de
 * un asset viven en `media.service`; aquí solo se decide el orden y se
 * publica el progreso.
 *
 * FASES: `enumerate → diff → hydrate → persist → prune → done`.
 * - `hydrate` lee etiquetas y portadas solo de nuevas/modificadas.
 * - `persist` escribe por lotes transaccionales.
 * - `prune` marca ausentes sin borrar filas (favoritos, historial y
 *   playlists sobreviven a archivos que desaparecen).
 *
 * Un fallo de enumeración devuelve `null` y NO toca SQLite: un MediaStore
 * transitoriamente vacío no puede vaciar la biblioteca del usuario.
 */

export type { ScanReport } from '@/domain/library/scan-report';

export type ScanProgressListener = (progress: ScanProgress) => void;

/** Pistas leídas antes de persistir, para acotar la memoria usada. */
const HYDRATE_BATCH = 100;

/** Filas por transacción de escritura (ver `songRepository.upsertBatch`). */
export const PERSIST_BATCH = 200;

function emitProgress(listener: ScanProgressListener | undefined, progress: ScanProgress): void {
  if (!listener) {
    return;
  }
  try {
    listener(progress);
  } catch (error) {
    // La UI nunca debe romper el escaneo por un fallo al pintar progreso.
    logError('library-scan', 'onProgress', error);
  }
}

export async function runLibraryScan(
  onProgress?: ScanProgressListener
): Promise<ScanReport | null> {
  const startedAt = Date.now();

  emitProgress(onProgress, { phase: 'enumerate', processed: 0, total: 0 });
  const allDevice = await enumerateDeviceAudio();
  if (!allDevice) {
    return null;
  }
  /**
   * Las pistas que el usuario quitó de la biblioteca (`FASE 5.2`) se filtran
   * antes del diff: su archivo sigue en el dispositivo, así que sin este filtro
   * el escaneo las trataría como "reaparecidas" y las volvería a añadir.
   */
  const ignored = await songRepository.getIgnoredMediaIds();
  const device =
    ignored.size === 0
      ? allDevice
      : allDevice.filter((track) => !ignored.has(track.mediaId));
  emitProgress(onProgress, {
    phase: 'enumerate',
    processed: device.length,
    total: device.length,
  });

  emitProgress(onProgress, { phase: 'diff', processed: 0, total: 0 });
  const stored = await songRepository.getScanState();
  const diff = diffScan(device, stored);
  const deviceById = new Map(device.map((track) => [track.mediaId, track]));
  // `added` y `updated` ya vienen sin duplicados y en orden de la mediateca.
  const pending = [...diff.added, ...diff.updated]
    .map((mediaId) => deviceById.get(mediaId))
    .filter((track): track is DeviceTrack => track !== undefined);

  const total = pending.length;
  const mode = diff.mode;
  let skipped = 0;
  emitProgress(onProgress, { phase: 'hydrate', processed: 0, total, mode });

  for (let start = 0; start < pending.length; start += HYDRATE_BATCH) {
    const batch = pending.slice(start, start + HYDRATE_BATCH);
    const scanned = await mapLimit(batch, TAG_CONCURRENCY, (track) => readDeviceTrack(track));
    const readable = scanned.filter((song): song is ScannedSong => song !== null);
    skipped += batch.length - readable.length;

    if (readable.length > 0) {
      await assignAlbumArtwork(readable);
      for (let offset = 0; offset < readable.length; offset += PERSIST_BATCH) {
        await songRepository.upsertBatch(readable.slice(offset, offset + PERSIST_BATCH));
      }
    }

    const processed = start + batch.length;
    emitProgress(onProgress, { phase: 'hydrate', processed, total, mode });
    emitProgress(onProgress, { phase: 'persist', processed, total, mode });
  }

  if (diff.missing.length > 0) {
    emitProgress(onProgress, {
      phase: 'prune',
      processed: 0,
      total: diff.missing.length,
      mode,
    });
    for (let start = 0; start < diff.missing.length; start += PERSIST_BATCH) {
      const chunk = diff.missing.slice(start, start + PERSIST_BATCH);
      await songRepository.markMissing(chunk);
      emitProgress(onProgress, {
        phase: 'prune',
        processed: start + chunk.length,
        total: diff.missing.length,
        mode,
      });
    }
  }

  // La heurística de audiolibros cambia si apareció, desapareció o cambió una
  // pista; con la biblioteca intacta no hace falta recorrerla otra vez.
  if (diff.added.length + diff.updated.length + diff.missing.length > 0) {
    await songRepository.reclassifyAudiobooks();
  }

  /**
   * Completa las portadas de pistas guardadas antes de leer FLAC o arte de
   * carpeta (`FASE 5.1`). Corre dentro del escaneo para reparar la biblioteca
   * sola en el primer arranque tras la actualización; el sello
   * `artwork_checked_at` lo limita a una vez por pista. Un fallo aquí no puede
   * tumbar el escaneo: la biblioteca ya quedó persistida.
   */
  try {
    await runArtworkBackfill({
      onProgress: (progress) => emitProgress(onProgress, progress),
    });
  } catch (error) {
    logError('library-scan', 'artwork-backfill', error);
  }

  const finishedAt = Date.now();
  emitProgress(onProgress, { phase: 'done', processed: total, total, mode });

  return {
    mode,
    deviceTotal: device.length,
    added: diff.added.length,
    updated: diff.updated.length,
    unchanged: diff.unchanged.length,
    missing: diff.missing.length,
    skipped,
    durationMs: finishedAt - startedAt,
    finishedAt,
  };
}
