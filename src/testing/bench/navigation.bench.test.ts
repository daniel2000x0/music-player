/**
 * Benchmarks del trabajo que se ejecuta al montar/cambiar de pestaña.
 *
 * No mide el render de React Native (eso requiere un dispositivo o
 * react-test-renderer); mide el cálculo de datos que cada pantalla deriva en
 * el hilo JS antes de renderizar: filtros, ordenamientos y agregados de
 * Inicio, Canciones y Álbumes.
 *
 * Ejecutar con:  npm run bench
 */
import { performance } from 'node:perf_hooks';

import { filterSongs } from '@/domain/library/filters';
import { resolveSongsByIds } from '@/domain/library/selection';
import { sortAlbums, sortArtists, sortSongs } from '@/domain/library/sorting';
import { makeSong } from '@/testing/fixtures';
import type { Album, Artist, Song } from '@/types/song';

const ITERATIONS = 20;

type BenchResult = {
  name: string;
  dataset: string;
  medianMs: number;
  p95Ms: number;
};

function bench(name: string, dataset: string, fn: () => void): BenchResult {
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
  return { name, dataset, medianMs, p95Ms };
}

/** Biblioteca con la misma forma que genera el escaneo real. */
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

/** Agregados de álbum/artista equivalentes a los que calcula SQLite. */
function buildAlbums(songs: Song[]): Album[] {
  const map = new Map<string, Album>();
  songs.forEach((song) => {
    const key = `${song.album}\u0000${song.artist}`;
    const current = map.get(key);
    if (current) {
      current.songCount += 1;
      current.totalDuration += song.duration;
    } else {
      map.set(key, {
        id: map.size + 1,
        title: song.album,
        artist: song.artist,
        artwork: song.artwork,
        songCount: 1,
        totalDuration: song.duration,
        createdAt: song.addedAt,
      });
    }
  });
  return [...map.values()];
}

function buildArtists(songs: Song[]): Artist[] {
  const map = new Map<string, Artist>();
  songs.forEach((song) => {
    const current = map.get(song.artist);
    if (current) {
      current.songCount += 1;
    } else {
      map.set(song.artist, {
        id: map.size + 1,
        name: song.artist,
        songCount: 1,
        albumCount: 1,
        lastPlayedAt: song.lastPlayedAt,
      });
    }
  });
  return [...map.values()];
}

describe('Benchmarks de montaje de pestañas', () => {
  const results: BenchResult[] = [];

  afterAll(() => {
    console.log('\n=== COSTE DE CAMBIO DE PESTAÑA (median de ' + ITERATIONS + ' iteraciones) ===');
    for (const result of results) {
      console.log(
        `${result.name.padEnd(42)} [${result.dataset.padEnd(5)}] ` +
          `mediana ${result.medianMs.toFixed(2).padStart(7)} ms  ` +
          `p95 ${result.p95Ms.toFixed(2).padStart(7)} ms`
      );
    }
  });

  const SIZES = [1_000, 5_000, 10_000];

  for (const size of SIZES) {
    it(`biblioteca de ${size} canciones`, () => {
      const songs = buildLibrary(size);
      const albums = buildAlbums(songs);
      const artists = buildArtists(songs);
      const dataset = `${size / 1000}k`;
      const favoriteIds = new Set<number>();
      for (let index = 0; index < songs.length; index += 10) {
        favoriteIds.add(songs[index].id);
      }
      const recentIds = songs.slice(-50).map((song) => song.id);
      const playlists = Array.from({ length: 20 }, (_, index) => ({
        id: index + 1,
        name: `Playlist ${index + 1}`,
        songIds: songs.slice(index * 40, index * 40 + 50).map((song) => song.id),
        createdAt: 1_000 + index,
        updatedAt: 1_000 + index,
      }));

      // Mismo cálculo que la pantalla Inicio al montar.
      results.push(
        bench('Inicio: derivar secciones', dataset, () => {
          const musicSongs = songs.filter((song) => !song.isAudiobook);
          const songIdSet = new Set(songs.map((song) => song.id));
          const recentSongs = resolveSongsByIds(songs, recentIds)
            .filter((song) => !song.isAudiobook)
            .slice(0, 5);
          const mostPlayed = [...musicSongs]
            .filter((song) => song.playCount > 0)
            .sort((a, b) => b.playCount - a.playCount)
            .slice(0, 5);
          const topAlbums = [...albums]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 4);
          const topPlaylists = playlists.slice(0, 3);
          topPlaylists.forEach((playlist) =>
            playlist.songIds.filter((id) => songIdSet.has(id))
          );
          void recentSongs;
          void mostPlayed;
          void topAlbums;
        })
      );

      // Canciones: filtro por defecto (sin texto) + orden por título.
      results.push(
        bench('Canciones: montar (filtro + orden)', dataset, () => {
          const filtered = filterSongs(songs, { view: 'all' }, favoriteIds);
          sortSongs(filtered, 'title-asc');
        })
      );

      // Canciones: el usuario cambia a la vista Favoritos.
      results.push(
        bench('Canciones: cambiar a Favoritos', dataset, () => {
          const filtered = filterSongs(songs, { view: 'favorites' }, favoriteIds);
          sortSongs(filtered, 'title-asc');
        })
      );

      // Canciones: búsqueda asentada (debounce de 120 ms).
      results.push(
        bench('Canciones: búsqueda "artista 3"', dataset, () => {
          const filtered = filterSongs(
            songs,
            { view: 'all', query: 'artista 3' },
            favoriteIds
          );
          sortSongs(filtered, 'title-asc');
        })
      );

      // Álbumes: filtro + orden de álbumes y artistas.
      results.push(
        bench('Álbumes: filtrar + ordenar', dataset, () => {
          const term = 'artista 3';
          const filteredAlbums = albums.filter(
            (album) =>
              album.title.toLowerCase().includes(term) ||
              album.artist.toLowerCase().includes(term)
          );
          sortAlbums(filteredAlbums, 'title-asc');
          const filteredArtists = artists.filter((artist) =>
            artist.name.toLowerCase().includes(term)
          );
          sortArtists(filteredArtists, 'name-asc');
        })
      );

      // Cambio de pestaña completo: Inicio → Canciones → Álbumes → Inicio.
      results.push(
        bench('Cambio Inicio→Canciones→Álbumes', dataset, () => {
          const musicSongs = songs.filter((song) => !song.isAudiobook);
          void [...musicSongs].filter((song) => song.playCount > 0).sort(
            (a, b) => b.playCount - a.playCount
          );
          const songsView = sortSongs(
            filterSongs(songs, { view: 'all' }, favoriteIds),
            'title-asc'
          );
          void songsView;
          sortAlbums(albums, 'title-asc');
        })
      );
    });
  }
});
