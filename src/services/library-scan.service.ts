import { songRepository } from '@/data/repositories/song.repository';
import { filenameFromUri } from '@/domain/library/content-key';
import { matchRelocations, type RelocationStored } from '@/domain/library/relocation';
import { diffScan, type DeviceTrack, type StoredTrack } from '@/domain/library/scan-diff';
import type { ScanProgress } from '@/domain/library/scan-progress';
import type { ScanReport } from '@/domain/library/scan-report';
import { runArtworkBackfill } from '@/services/artwork-backfill.service';
import { assignAlbumArtwork, remapArtworkUri } from '@/services/artwork.service';
import { computeContentKey } from '@/services/content-key.service';
import { logError } from '@/services/error-log.service';
import { TAG_CONCURRENCY, enumerateDeviceAudio, readDeviceTrack } from '@/services/media.service';
import type { ScannedSong } from '@/types/song';
import { mapLimit } from '@/utils/async';
import { normalizeAudioFormat } from '@/utils/format';

/**
 * Pipeline de escaneo de la biblioteca.
 *
 * RESPONSABILIDAD ÚNICA: llevar la mediateca a SQLite en fases observables y
 * sin releer lo que no cambió. Los permisos, la enumeración y la lectura de
 * un asset viven en `media.service`; aquí solo se decide el orden y se
 * publica el progreso.
 *
 * FASES: `enumerate → diff → hydrate → reconcile → persist → prune → done`.
 * - `hydrate` lee etiquetas y portadas solo de nuevas/modificadas.
 * - `reconcile` reconoce canciones movidas/renombradas por huella de contenido
 *   y reubica su fila existente en vez de crear una nueva (conserva favoritos,
 *   historial, playlists y correcciones manuales).
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

/**
 * Calcula la huella de las filas anteriores a la V12 una sola vez.
 *
 * Se ejecuta ANTES de leer `getScanState()` para que el apareamiento ya tenga
 * las huellas disponibles. Un fallo aquí no aborta el escaneo: sin huella se
 * usa el respaldo nombre + carpeta + duración.
 */
async function backfillStoredContentKeys(): Promise<void> {
  try {
    const rows = await songRepository.getContentKeyBackfillRows();
    if (rows.length === 0) {
      return;
    }
    const keys = await mapLimit(rows, TAG_CONCURRENCY, (row) =>
      computeContentKey(row.uri, row.duration)
    );
    await songRepository.setContentKeyChecks(
      rows.map((row, index) => ({ id: row.id, contentKey: keys[index] ?? null })),
      Date.now()
    );
  } catch (error) {
    logError('library-scan', 'backfillContentKeys', error);
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

  await backfillStoredContentKeys();

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

  const addedIds = new Set(diff.added);
  // Solo pueden aparearse filas con algún dato de identidad (huella o nombre):
  // las migradas sin nombre ni huella nunca igualarían y retrasarían su upsert.
  const relocate =
    diff.missing.length > 0
      ? new Map<string, StoredTrack>(
          stored
            .filter(
              (track) =>
                diff.missing.includes(track.mediaId) && (track.contentKey || track.filename)
            )
            .map((track) => [track.mediaId, track])
        )
      : new Map<string, StoredTrack>();
  /** Pistas nuevas que pueden ser una canción reubicada; se deciden después. */
  const relocationCandidates: ScannedSong[] = [];

  for (let start = 0; start < pending.length; start += HYDRATE_BATCH) {
    const batch = pending.slice(start, start + HYDRATE_BATCH);
    const scanned = await mapLimit(batch, TAG_CONCURRENCY, (track) => readDeviceTrack(track));
    const readable = scanned.filter((song): song is ScannedSong => song !== null);
    skipped += batch.length - readable.length;

    if (readable.length > 0) {
      await assignAlbumArtwork(readable);
      const toUpsert: ScannedSong[] = [];
      for (const song of readable) {
        if (addedIds.has(song.mediaId) && relocate.size > 0) {
          relocationCandidates.push(song);
        } else {
          toUpsert.push(song);
        }
      }
      for (let offset = 0; offset < toUpsert.length; offset += PERSIST_BATCH) {
        await songRepository.upsertBatch(toUpsert.slice(offset, offset + PERSIST_BATCH));
      }
    }

    const processed = start + batch.length;
    emitProgress(onProgress, { phase: 'hydrate', processed, total, mode });
    emitProgress(onProgress, { phase: 'persist', processed, total, mode });
  }

  /**
   * Igualdad por huella primero, nombre+carpeta+duración después. Solo se
   * reconsideran las filas que el diff dio por ausentes, para no absorber una
   * canción nueva con una borrada distinta.
   */
  const relocatedOld = new Set<string>();
  const relocatedNew = new Set<string>();
  if (relocationCandidates.length > 0 && relocate.size > 0) {
    const deviceMatches = relocationCandidates.map((song) => ({
      mediaId: song.mediaId,
      filename: filenameFromUri(song.uri),
      durationMs: Math.round(song.duration * 1000),
      folder: song.folder,
      contentKey: song.contentKey ?? null,
    }));
    const byNewId = new Map(relocationCandidates.map((song) => [song.mediaId, song]));
    const storedMatches: RelocationStored[] = [...relocate.values()].map((track) => ({
      mediaId: track.mediaId,
      filename: track.filename ?? null,
      durationMs: track.durationMs ?? 0,
      folder: track.folder ?? null,
      contentKey: track.contentKey ?? null,
      isAvailable: track.isAvailable,
    }));
    const matches = matchRelocations(deviceMatches, storedMatches);

    for (const [oldMediaId, nextMediaId] of matches) {
      const previous = relocate.get(oldMediaId);
      const next = byNewId.get(nextMediaId);
      if (!previous || !next) {
        continue;
      }
      const oldArtworkUri = previous.artworkUri ?? null;
      let artworkUri: string | null;
      try {
        artworkUri =
          (await remapArtworkUri({
            oldUri: oldArtworkUri,
            nextMediaId: next.mediaId,
            nextUri: next.uri,
            nextContentKey: next.contentKey,
          })) ?? next.artwork ?? null;
      } catch (error) {
        logError('library-scan', 'remapArtwork', error);
        artworkUri = next.artwork ?? null;
      }

      const moved = await songRepository.relocateSong({
        oldMediaId,
        next,
        contentKey: next.contentKey ?? null,
        artworkUri,
      });
      if (!moved) {
        continue;
      }
      relocatedOld.add(oldMediaId);
      relocatedNew.add(nextMediaId);

      if (oldArtworkUri && oldArtworkUri !== artworkUri) {
        try {
          if (artworkUri) {
            await songRepository.replaceArtworkUri(oldArtworkUri, artworkUri);
          } else {
            await songRepository.clearArtworkUri(oldArtworkUri);
          }
        } catch (error) {
          logError('library-scan', 'relocateArtworkUri', error);
        }
      }
    }

    const stillNew = relocationCandidates.filter((song) => !relocatedNew.has(song.mediaId));
    for (let offset = 0; offset < stillNew.length; offset += PERSIST_BATCH) {
      await songRepository.upsertBatch(stillNew.slice(offset, offset + PERSIST_BATCH));
    }

    // Lo que se reubicó no es ni nuevo ni ausente: el resumen debe reflejarlo
    // y la poda no debe marcar la fila que acaba de reactivarse.
    diff.added = diff.added.filter((id) => !relocatedNew.has(id));
    diff.missing = diff.missing.filter((id) => !relocatedOld.has(id));
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

  // Backfill de formato para filas anteriores a la migración v9. Es barato y
  // evita que canciones ya conocidas queden sin etiqueta hasta ser reescaneadas.
  try {
    await songRepository.backfillFileFormats((uri) => normalizeAudioFormat(uri));
  } catch (error) {
    logError('library-scan', 'backfillFileFormats', error);
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
