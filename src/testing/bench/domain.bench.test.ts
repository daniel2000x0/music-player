/**
 * Benchmarks de rendimiento del dominio puro (sin React Native).
 *
 * Mide las operaciones que corrern en el hilo JS durante el uso real de la
 * app (buscar, ordenar, abrir playlists automáticas, reordenar la cola)
 * con tamaños de biblioteca realistas.
 *
 * Ejecutar con:  npm run bench
 */
import { performance } from 'node:perf_hooks';

import { getAutoPlaylistSongs } from '@/domain/library/auto-playlists';
import { filterSongs } from '@/domain/library/filters';
import { sortSongs } from '@/domain/library/sorting';
import { moveItem } from '@/domain/playlists/reorder';
import { makeSong } from '@/testing/fixtures';
import type { Song } from '@/types/song';

const ITERATIONS = 20;

type BenchResult = {
  name: string;
  dataset: string;
  medianMs: number;
  p95Ms: number;
  opsPerSec: number;
};

/** Genera una biblioteca con distribución realista de artistas/álbumes. */
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

describe('Benchmarks del dominio', () => {
  const results: BenchResult[] = [];

  afterAll(() => {
    console.log('\n=== RESULTADOS DE BENCHMARKS (median de ' + ITERATIONS + ' iteraciones) ===');
    for (const result of results) {
      console.log(
        `${result.name.padEnd(34)} [${result.dataset.padEnd(9)}] ` +
          `mediana ${result.medianMs.toFixed(2).padStart(7)} ms  ` +
          `p95 ${result.p95Ms.toFixed(2).padStart(7)} ms  ` +
          `${Math.round(result.opsPerSec).toLocaleString('es')} ops/s`
      );
    }
  });

  const SIZES = [1_000, 5_000, 10_000];

  for (const size of SIZES) {
    it(`biblioteca de ${size} canciones`, () => {
      const songs = buildLibrary(size);
      const dataset = `${(size / 1000).toFixed(0)}k`;

      const favoriteIds = new Set<number>();
      for (let index = 0; index < songs.length; index += 10) {
        favoriteIds.add(songs[index].id);
      }
      const recentIds = songs.slice(-50).map((song) => song.id);

      results.push(
        bench('filterSongs (sin criterios)', dataset, () => {
          filterSongs(songs, {}, favoriteIds);
        })
      );

      results.push(
        bench('filterSongs (búsqueda "artista 3")', dataset, () => {
          filterSongs(songs, { query: 'artista 3' }, favoriteIds);
        })
      );

      results.push(
        bench('filterSongs (vista favoritos)', dataset, () => {
          filterSongs(songs, { view: 'favorites' }, favoriteIds);
        })
      );

      results.push(
        bench('sortSongs (title-asc, Collator)', dataset, () => {
          sortSongs(songs, 'title-asc');
        })
      );

      results.push(
        bench('sortSongs (artist-asc, 2 claves)', dataset, () => {
          sortSongs(songs, 'artist-asc');
        })
      );

      results.push(
        bench('sortSongs (added-desc, numérico)', dataset, () => {
          sortSongs(songs, 'added-desc');
        })
      );

      results.push(
        bench('autoPlaylist (mostPlayed)', dataset, () => {
          getAutoPlaylistSongs('mostPlayed', songs, favoriteIds, recentIds);
        })
      );

      results.push(
        bench('autoPlaylist (recent)', dataset, () => {
          getAutoPlaylistSongs('recent', songs, favoriteIds, recentIds);
        })
      );

      results.push(
        bench('autoPlaylist (random)', dataset, () => {
          getAutoPlaylistSongs('random', songs, favoriteIds, recentIds);
        })
      );

      results.push(
        bench('getSongsByIds (map + join)', dataset, () => {
          const map = new Map(songs.map((song) => [song.id, song]));
          recentIds.map((id) => map.get(id));
        })
      );

      results.push(
        bench('recordPlayLocal (map array)', dataset, () => {
          const target = songs[Math.floor(songs.length / 2)].id;
          songs.map((song) =>
            song.id === target
              ? { ...song, playCount: song.playCount + 1, lastPlayedAt: Date.now() }
              : song
          );
        })
      );

      results.push(
        bench('moveItem (cola de 500)', dataset, () => {
          const queue = songs.slice(0, 500);
          moveItem(queue, 10, 480);
        })
      );

      results.push(
        bench('JSON.stringify (persistencia)', dataset, () => {
          JSON.stringify(songs);
        })
      );
    });
  }
});
