import {
  AUDIOBOOK_AVG_DURATION,
  AUDIOBOOK_SINGLE_DURATION,
  collectAudiobooks,
  detectAudiobookSongIds,
} from '@/domain/library/audiobooks';

import { makeSong } from '@/testing/fixtures';

describe('detectAudiobookSongIds (heurística de escaneo)', () => {
  it('marca una serie de capítulos largos por duración media', () => {
    const songs = [
      makeSong({ id: 1, album: 'El Hobbit', artist: 'Tolkien', duration: AUDIOBOOK_AVG_DURATION }),
      makeSong({ id: 2, album: 'El Hobbit', artist: 'Tolkien', duration: AUDIOBOOK_AVG_DURATION }),
      makeSong({ id: 3, album: 'Éxitos', artist: 'Banda', duration: 200 }),
    ];
    expect(detectAudiobookSongIds(songs)).toEqual(new Set([1, 2]));
  });

  it('marca una pista única larga', () => {
    const songs = [
      makeSong({ id: 9, album: 'Charla', artist: 'Ponente', duration: AUDIOBOOK_SINGLE_DURATION }),
    ];
    expect(detectAudiobookSongIds(songs)).toEqual(new Set([9]));
  });

  it('marca por palabra clave aunque la duración sea corta', () => {
    const songs = [
      makeSong({ id: 1, album: 'Mi Audiolibro', artist: 'Autor', duration: 300 }),
      makeSong({ id: 2, album: 'Mi Audiolibro', artist: 'Autor', duration: 300 }),
    ];
    expect(detectAudiobookSongIds(songs)).toEqual(new Set([1, 2]));
  });

  it('excluye álbumes de música normal', () => {
    const songs = [
      makeSong({ id: 1, album: 'Éxitos', artist: 'Banda', duration: 200 }),
      makeSong({ id: 2, album: 'Éxitos', artist: 'Banda', duration: 210 }),
      makeSong({ id: 3, album: 'Éxitos', artist: 'Banda', duration: 180 }),
    ];
    expect(detectAudiobookSongIds(songs)).toEqual(new Set());
  });

  it('agrupa por álbum y autor a la vez', () => {
    const songs = [
      makeSong({ id: 1, album: 'Historias', artist: 'Autor A', duration: AUDIOBOOK_AVG_DURATION }),
      makeSong({ id: 2, album: 'Historias', artist: 'Autor B', duration: AUDIOBOOK_AVG_DURATION }),
    ];
    // Cada autor tiene una sola pista larga de 10 min: no alcanza el umbral
    // de pista suelta (20 min), así que ninguna califica.
    expect(detectAudiobookSongIds(songs)).toEqual(new Set());
  });
});

describe('collectAudiobooks (agrupación por marca)', () => {
  const albums = [
    {
      id: 7,
      title: 'El Hobbit',
      artist: 'Tolkien',
      songCount: 2,
      totalDuration: 1200,
      artwork: null,
      createdAt: 1,
    },
  ];

  it('agrupa solo las canciones marcadas como audiolibro', () => {
    const songs = [
      makeSong({ id: 1, album: 'El Hobbit', artist: 'Tolkien', isAudiobook: true, title: 'Capítulo 1' }),
      makeSong({ id: 2, album: 'El Hobbit', artist: 'Tolkien', isAudiobook: true, title: 'Capítulo 2' }),
      makeSong({ id: 3, album: 'El Hobbit', artist: 'Tolkien', isAudiobook: false, title: 'Capítulo 3' }),
      makeSong({ id: 4, album: 'Éxitos', artist: 'Banda', isAudiobook: false }),
    ];
    const books = collectAudiobooks(songs, albums);
    expect(books).toHaveLength(1);
    expect(books[0].albumId).toBe(7);
    expect(books[0].chapters.map((song) => song.id)).toEqual([1, 2]);
  });

  it('excluye canciones marcadas pero no disponibles', () => {
    const songs = [
      makeSong({ id: 1, album: 'Serie', artist: 'Autor', isAudiobook: true, isAvailable: false }),
      makeSong({ id: 2, album: 'Serie', artist: 'Autor', isAudiobook: true }),
    ];
    const books = collectAudiobooks(songs, []);
    expect(books).toHaveLength(1);
    expect(books[0].chapters.map((song) => song.id)).toEqual([2]);
  });

  it('ordena los capítulos numéricamente por título', () => {
    const songs = [
      makeSong({ id: 2, album: 'Serie', artist: 'Autor', isAudiobook: true, title: 'Capítulo 10' }),
      makeSong({ id: 1, album: 'Serie', artist: 'Autor', isAudiobook: true, title: 'Capítulo 2' }),
    ];
    const books = collectAudiobooks(songs, []);
    expect(books[0].chapters.map((song) => song.title)).toEqual([
      'Capítulo 2',
      'Capítulo 10',
    ]);
  });

  it('calcula la duración total del grupo', () => {
    const songs = [
      makeSong({ id: 1, album: 'Serie', artist: 'Autor', isAudiobook: true, duration: 600 }),
      makeSong({ id: 2, album: 'Serie', artist: 'Autor', isAudiobook: true, duration: 900 }),
    ];
    expect(collectAudiobooks(songs, [])[0].totalDuration).toBe(1500);
  });

  it('devuelve albumId null si el álbum no está en la lista', () => {
    const songs = [makeSong({ id: 1, album: 'Desconocido', artist: 'Autor', isAudiobook: true })];
    expect(collectAudiobooks(songs, [])[0].albumId).toBeNull();
  });
});
