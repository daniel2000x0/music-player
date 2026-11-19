/**
 * Benchmarks del pipeline de escaneo puro (sin SQLite ni módulos nativos).
 *
 * Mide el trabajo que hace el hilo JS al comparar la mediateca con la copia
 * guardada, formatear el progreso de las fases y resolver los metadatos de las
 * pistas nuevas o modificadas, con bibliotecas de 1k/5k/12k canciones.
 *
 * Ejecutar con:  npm run bench
 */
import { performance } from 'node:perf_hooks';

import {
  diffScan,
  supportsIncrementalScan,
  type DeviceTrack,
  type StoredTrack,
} from '@/domain/library/scan-diff';
import {
  describeScanPercent,
  describeScanProgress,
  scanProgressPercent,
} from '@/domain/library/scan-progress';
import { describeScanReport, scanReportHasChanges } from '@/domain/library/scan-report';
import {
  decodeLatin1,
  decodeUtf16,
  decodeUtf8,
  parseFilename,
  resolveSongMetadata,
  type AudioTags,
  type MetadataInput,
} from '@/domain/metadata';
import { makeSong } from '@/testing/fixtures';
import type { ScannedSong } from '@/types/song';

const ITERATIONS = 20;

type BenchResult = {
  name: string;
  dataset: string;
  medianMs: number;
  p95Ms: number;
  opsPerSec: number;
};

/** Genera una mediateca con la forma que produce `readDeviceTrack`. */
function buildScanned(size: number): ScannedSong[] {
  const artists = Math.max(40, Math.round(size / 12));
  const albums = artists * 2;
  return Array.from({ length: size }, (_, index) => {
    const song = makeSong({
      id: index + 1,
      mediaId: `media-${index + 1}`,
      uri: `file:///music/${(index % albums) + 1}/song-${index + 1}.mp3`,
      title: `Canción número ${index + 1} del repertorio`,
      artist: `Artista ${(index % artists) + 1}`,
      album: `Álbum ${(index % albums) + 1}`,
      track: index % 12 === 0 ? (index % 12) + 1 : null,
      folder: index % 4 === 0 ? 'Música' : 'music',
      duration: 90 + (index % 300),
      artwork: index % 3 === 0 ? `file:///cache/art-${index}.jpg` : null,
      addedAt: 1_000 + index * 50,
      playCount: index % 7,
      lastPlayedAt: index % 3 === 0 ? 2_000 + index : null,
    });
    return {
      mediaId: song.mediaId,
      uri: song.uri,
      title: song.title,
      artist: song.artist,
      album: song.album,
      track: song.track,
      folder: song.folder,
      duration: song.duration,
      artwork: song.artwork,
      modificationTime: 1_000 + index,
    };
  });
}

/** Estado SQLite: algunas pistas cambiaron, otras desaparecieron o reaparecen. */
function buildTracks(scanned: ScannedSong[]): {
  device: DeviceTrack[];
  stored: StoredTrack[];
} {
  const device: DeviceTrack[] = scanned.map((track) => ({
    mediaId: track.mediaId,
    modificationTime: track.modificationTime,
  }));
  const stored: StoredTrack[] = scanned.map((track, index) => ({
    mediaId: track.mediaId,
    modificationTime: index % 8 === 0 ? (track.modificationTime ?? 0) - 1 : track.modificationTime,
    isAvailable: index % 40 !== 0,
  }));
  // Pistas guardadas que la mediateca ya no anuncia (salida `missing`).
  for (let index = 0; index < 20; index += 1) {
    stored.push({ mediaId: `ausente-${index}`, modificationTime: 500 + index, isAvailable: true });
  }
  return { device, stored };
}

/** Entradas de `resolveSongMetadata`: un tercio con tags, un tercio sin ellos. */
function buildMetadataInputs(scanned: ScannedSong[]): MetadataInput[] {
  return scanned.map((track, index) => {
    let tags: AudioTags | null = null;
    if (index % 3 === 0) {
      tags = {
        title: track.title,
        artist: track.artist,
        album: track.album,
        albumArtist: track.artist,
        track: track.track,
      };
    } else if (index % 3 === 1) {
      tags = { title: null, artist: null, album: null, albumArtist: null, track: null };
    }
    return {
      filename: `${String(index % 9)}-${track.title}.mp3`,
      folder: track.folder,
      tags,
    };
  });
}

/** Bytes de etiquetas para medir los decodificadores sin leer archivos. */
function buildTagBytes(scanned: ScannedSong[]): {
  utf8: Uint8Array[];
  utf16: Uint8Array[];
} {
  const utf8: Uint8Array[] = [];
  const utf16: Uint8Array[] = [];
  for (const track of scanned) {
    const text = `${track.title}\u0000${track.artist}`;
    utf8.push(new TextEncoder().encode(text));
    const bytes = new Uint8Array(text.length * 2);
    for (let index = 0; index < text.length; index += 1) {
      bytes[index * 2] = text.charCodeAt(index) & 0xff;
      bytes[index * 2 + 1] = (text.charCodeAt(index) >> 8) & 0xff;
    }
    utf16.push(bytes);
  }
  return { utf8, utf16 };
}

/** Ejecuta `fn` N veces y devuelve estadísticas de tiempo. */
function bench(name: string, dataset: string, fn: () => void): BenchResult {
  // Calentamiento: JIT + caches (p. ej. Intl.Collator).
  for (let i = 0; i < 3; i += 1) {
    fn();
  }
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const medianMs = samples[Math.floor(samples.length / 2)];
  const p95Ms = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)];
  return {
    name,
    dataset,
    medianMs,
    p95Ms,
    opsPerSec: 1000 / medianMs,
  };
}

describe('Benchmarks del pipeline de escaneo', () => {
  const results: BenchResult[] = [];

  afterAll(() => {
    console.log('\n=== COSTE DEL PIPELINE DE ESCANEO (median de ' + ITERATIONS + ' iteraciones) ===');
    for (const result of results) {
      console.log(
        `${result.name.padEnd(40)} [${result.dataset.padEnd(5)}] ` +
          `mediana ${result.medianMs.toFixed(2).padStart(7)} ms  ` +
          `p95 ${result.p95Ms.toFixed(2).padStart(7)} ms  ` +
          `${Math.round(result.opsPerSec).toLocaleString('es')} ops/s`
      );
    }
  });

  const SIZES = [1_000, 5_000, 12_000];

  for (const size of SIZES) {
    it(`biblioteca de ${size} pistas`, () => {
      const scanned = buildScanned(size);
      const { device, stored } = buildTracks(scanned);
      const metadataInputs = buildMetadataInputs(scanned);
      const tagBytes = buildTagBytes(scanned);
      const dataset = `${(size / 1000).toFixed(0)}k`;
      const diff = diffScan(device, stored);
      const report = {
        mode: diff.mode,
        deviceTotal: scanned.length,
        added: diff.added.length,
        updated: diff.updated.length,
        unchanged: diff.unchanged.length,
        missing: diff.missing.length,
        skipped: Math.round(size / 100),
        durationMs: 12_345,
        finishedAt: 1_700_000_000_000,
      };

      results.push(
        bench('supportsIncrementalScan', dataset, () => {
          void supportsIncrementalScan(device);
        })
      );

      results.push(
        bench('diffScan (incremental)', dataset, () => {
          void diffScan(device, stored);
        })
      );

      results.push(
        bench('scanProgressPercent + describeScanPercent (100 lotes)', dataset, () => {
          for (let step = 0; step <= 100; step += 1) {
            const progress = {
              phase: 'hydrate' as const,
              processed: Math.round((scanned.length * step) / 100),
              total: scanned.length,
              mode: diff.mode,
            };
            void scanProgressPercent(progress);
            void describeScanPercent(progress);
          }
        })
      );

      results.push(
        bench('describeScanProgress (fases del pipeline)', dataset, () => {
          const phases = ['enumerate', 'diff', 'hydrate', 'persist', 'prune', 'backfill', 'done'] as const;
          for (const phase of phases) {
            void describeScanProgress({
              phase,
              processed: Math.round(scanned.length / 2),
              total: scanned.length,
              mode: diff.mode,
            });
          }
        })
      );

      results.push(
        bench('describeScanReport + scanReportHasChanges', dataset, () => {
          for (let i = 0; i < 100; i += 1) {
            void describeScanReport(report);
            void scanReportHasChanges(report);
          }
        })
      );

      results.push(
        bench('resolveSongMetadata (con/sin tags)', dataset, () => {
          for (const input of metadataInputs) {
            void resolveSongMetadata(input);
          }
        })
      );

      results.push(
        bench('parseFilename', dataset, () => {
          for (const input of metadataInputs) {
            void parseFilename(input.filename);
          }
        })
      );

      results.push(
        bench('decodeUtf8 (etiquetas)', dataset, () => {
          for (const bytes of tagBytes.utf8) {
            void decodeUtf8(bytes);
          }
        })
      );

      results.push(
        bench('decodeLatin1 (etiquetas)', dataset, () => {
          for (const bytes of tagBytes.utf8) {
            void decodeLatin1(bytes);
          }
        })
      );

      results.push(
        bench('decodeUtf16 (etiquetas)', dataset, () => {
          for (const bytes of tagBytes.utf16) {
            void decodeUtf16(bytes);
          }
        })
      );
    });
  }
});
