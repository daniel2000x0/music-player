/**
 * Benchmarks del trabajo JS previo al render de listas grandes.
 *
 * No se monta React (el proyecto no incluye Testing Library): se mide solo el
 * cómputo que la pantalla hace antes de entregar las props a `FlatList` /
 * `SectionList` —preparar filas, filtrar, ordenar, agrupar por inicial y
 * resolver la selección—. Es lo que puede bloquear el hilo JS al abrir
 * Canciones con miles de pistas; el coste del render nativo se mide en un
 * dispositivo, no en este entorno.
 *
 * Ejecutar con:  npm run bench
 */
import { performance } from 'node:perf_hooks';

import { filterSongs } from '@/domain/library/filters';
import { resolveSongsByIds } from '@/domain/library/selection';
import { sortSongs } from '@/domain/library/sorting';
import { makeSong } from '@/testing/fixtures';
import type { Song } from '@/types/song';
import { collectInitials, initialKey } from '@/utils/alphabet';
import { formatDuration } from '@/utils/format';

const ITERATIONS = 20;

type BenchResult = {
  name: string;
  dataset: string;
  medianMs: number;
  p95Ms: number;
  opsPerSec: number;
};

/** Props ya calculadas que recibe cada fila; no se crea ningún elemento React. */
type SongRow = {
  key: number;
  title: string;
  subtitle: string;
  duration: string;
  artwork: string | null;
  initial: string;
  isFavorite: boolean;
};

type Section = { title: string; data: SongRow[] };

/** Biblioteca con la distribución realista que usa el resto de benchmarks. */
function buildLibrary(size: number): Song[] {
  const artists = Math.max(40, Math.round(size / 12));
  const albums = artists * 2;
  return Array.from({ length: size }, (_, index) =>
    makeSong({
      id: index + 1,
      mediaId: `media-${index + 1}`,
      uri: `file:///music/song-${index + 1}.mp3`,
      title: `Canción número ${index + 1} del repertorio`,
      artist: `Artista ${(index % artists) + 1}`,
      album: `Álbum ${(index % albums) + 1}`,
      duration: 90 + (index % 300),
      artwork: index % 3 === 0 ? `file:///cache/art-${index}.jpg` : null,
      addedAt: 1_000 + index * 50,
      playCount: index % 7,
      lastPlayedAt: index % 3 === 0 ? 2_000 + index : null,
    })
  );
}

/** Mapping de `Song` a props de fila: lo que hace el `renderItem` de la lista. */
function toRow(song: Song, favoriteIds: ReadonlySet<number>): SongRow {
  return {
    key: song.id,
    title: song.title,
    subtitle: song.artist,
    duration: formatDuration(song.duration),
    artwork: song.artwork,
    initial: initialKey(song.title),
    isFavorite: favoriteIds.has(song.id),
  };
}

/** Agrupa filas por inicial usando el alfabeto canónico de `utils/alphabet`. */
function buildSections(rows: SongRow[]): Section[] {
  const byLetter = new Map<string, SongRow[]>();
  for (const row of rows) {
    const group = byLetter.get(row.initial);
    if (group) {
      group.push(row);
    } else {
      byLetter.set(row.initial, [row]);
    }
  }
  return collectInitials(rows.map((row) => row.title))
    .filter((letter) => byLetter.has(letter))
    .map((letter) => ({ title: letter, data: byLetter.get(letter) ?? [] }));
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

describe('Benchmarks de preparación de listas', () => {
  const results: BenchResult[] = [];

  afterAll(() => {
    console.log('\n=== COSTE PREVIO AL RENDER DE LISTAS (median de ' + ITERATIONS + ' iteraciones) ===');
    for (const result of results) {
      console.log(
        `${result.name.padEnd(42)} [${result.dataset.padEnd(5)}] ` +
          `mediana ${result.medianMs.toFixed(2).padStart(7)} ms  ` +
          `p95 ${result.p95Ms.toFixed(2).padStart(7)} ms  ` +
          `${Math.round(result.opsPerSec).toLocaleString('es')} ops/s`
      );
    }
  });

  const SIZES = [1_000, 5_000, 10_000];

  for (const size of SIZES) {
    it(`lista de ${size} filas`, () => {
      const songs = buildLibrary(size);
      const dataset = `${size / 1000}k`;
      const favoriteIds = new Set<number>();
      for (let index = 0; index < songs.length; index += 10) {
        favoriteIds.add(songs[index].id);
      }
      const selectedIds = songs.slice(-50).map((song) => song.id);
      const sorted = sortSongs(songs, 'title-asc');
      const rows = sorted.map((song) => toRow(song, favoriteIds));

      results.push(
        bench('preparar filas (Song → props)', dataset, () => {
          void sorted.map((song) => toRow(song, favoriteIds));
        })
      );

      results.push(
        bench('filterSongs (vista todas)', dataset, () => {
          void filterSongs(songs, { view: 'all' }, favoriteIds);
        })
      );

      results.push(
        bench('sortSongs (title-asc, Collator)', dataset, () => {
          void sortSongs(songs, 'title-asc');
        })
      );

      results.push(
        bench('filtrar + ordenar + preparar filas', dataset, () => {
          const filtered = filterSongs(songs, { view: 'all' }, favoriteIds);
          const ordered = sortSongs(filtered, 'title-asc');
          void ordered.map((song) => toRow(song, favoriteIds));
        })
      );

      results.push(
        bench('búsqueda "artista 3" + preparar filas', dataset, () => {
          const filtered = filterSongs(songs, { view: 'all', query: 'artista 3' }, favoriteIds);
          const ordered = sortSongs(filtered, 'title-asc');
          void ordered.map((song) => toRow(song, favoriteIds));
        })
      );

      results.push(
        bench('sectionList agrupado por letra', dataset, () => {
          void buildSections(rows);
        })
      );

      results.push(
        bench('flujo completo (filtro + orden + filas + secciones)', dataset, () => {
          const filtered = filterSongs(songs, { view: 'all' }, favoriteIds);
          const ordered = sortSongs(filtered, 'title-asc');
          void buildSections(ordered.map((song) => toRow(song, favoriteIds)));
        })
      );

      results.push(
        bench('resolveSongsByIds (selección de 50)', dataset, () => {
          void resolveSongsByIds(songs, selectedIds);
        })
      );
    });
  }
});
