import { songRepository } from '@/data/repositories/song.repository';
import type { ScannedSong } from '@/types/song';

/**
 * Pruebas de la persistencia por lotes con un SQLite falso.
 *
 * LÓGICA: se registra cada sentencia para verificar los contratos que importan
 * en bibliotecas grandes: una transacción por lote, sentencias de ≤45 filas,
 * chunks de ≤500 ids y ausencia del reset global de disponibilidad.
 */
type Row = Record<string, unknown>;

const mockRunLog: { sql: string; params: unknown[] }[] = [];
const mockArtistRows = new Map<string, { id: number }>();
const mockAlbumRows = new Map<string, { id: number; artwork_uri: string | null }>();
let mockNextId = 1;
let mockAllHandler: (sql: string, params: unknown[]) => Row[] = () => [];
/** Responde consultas puntuales no cubiertas por los mapas por defecto. */
let mockFirstHandler: ((sql: string, params: unknown[]) => Row | null) | null = null;

const mockDb = {
  withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
    await fn();
  }),
  runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    mockRunLog.push({ sql, params });
    return { lastInsertRowId: mockNextId++, changes: 1 };
  }),
  getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    if (mockFirstHandler) {
      return mockFirstHandler(sql, params);
    }
    if (sql.includes('FROM artists')) {
      return mockArtistRows.get(String(params[0])) ?? null;
    }
    if (sql.includes('FROM albums')) {
      return mockAlbumRows.get(`${params[1]}\u0000${params[0]}`) ?? null;
    }
    return null;
  }),
  getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) =>
    mockAllHandler(sql, params)
  ),
};

jest.mock('@/data/db/database', () => ({
  getDatabase: jest.fn(async () => mockDb),
}));

function scanned(mediaId: string, modificationTime: number | null = 10): ScannedSong {
  return {
    mediaId,
    uri: `file:///music/${mediaId}.mp3`,
    title: mediaId,
    artist: 'Artista',
    album: 'Álbum',
    track: 1,
    folder: 'Music',
    duration: 180,
    fileFormat: 'mp3',
    bitDepth: null,
    sampleRate: null,
    bitrate: null,
hasLyrics: false,
lyrics: null,
    artwork: null,
    modificationTime,
  };
}

function songRow(id: number): Row {
  return {
    id,
    media_id: `m-${id}`,
    uri: `file:///music/m-${id}.mp3`,
    title: `Título ${id}`,
    artist: 'Artista',
    album: 'Álbum',
    track_number: null,
    folder_name: null,
    duration: 100,
    file_format: 'mp3',
    bit_depth: 16,
    sample_rate: 44100,
    bitrate: 1411,
    has_lyrics: 1,
    lyrics: 'Línea una\nLínea dos',
    artwork_uri: null,
    added_at: 1,
    is_available: 1,
    is_audiobook: 0,
    play_count: 0,
    last_played_at: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRunLog.length = 0;
  mockArtistRows.clear();
  mockAlbumRows.clear();
  mockNextId = 1;
  mockAllHandler = () => [];
  mockFirstHandler = null;
});

describe('songRepository.upsertBatch', () => {
  it('no abre transacción para un lote vacío', async () => {
    await songRepository.upsertBatch([]);

    expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('escribe en una transacción con sentencias de 45 filas', async () => {
    const songs = Array.from({ length: 120 }, (_, index) =>
      scanned(`m-${index}`, index + 1)
    );

    await songRepository.upsertBatch(songs);

    expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
    const inserts = mockRunLog.filter((entry) => entry.sql.includes('INSERT INTO songs'));
    expect(inserts).toHaveLength(3);
    expect(inserts.map((entry) => entry.params.length)).toEqual([900, 900, 600]);
    expect(inserts[0].sql).toContain('file_format');
    expect(inserts[0].sql).toContain('bit_depth');
    expect(inserts[0].sql).toContain('sample_rate');
    expect(inserts[0].sql).toContain('bitrate');
    expect(inserts[0].sql).toContain('has_lyrics');
    expect(inserts[0].sql).toContain('lyrics');
    expect(inserts[0].sql).toContain('modification_time');
    expect(inserts[0].sql).toContain('artwork_checked_at');
    // El valor guardado es el de la mediateca, no un contador del bucle.
    expect(inserts[0].params[17]).toBe(1);
    // La letra viaja en el mismo lote (índice 13 tras añadir la columna).
    expect(inserts[0].params[13]).toBeNull();
  });

  it('persiste el texto de la letra sin borrar la de escaneos anteriores', async () => {
    await songRepository.upsertBatch([
      { ...scanned('m-letras'), hasLyrics: true, lyrics: 'Primera\nSegunda' },
    ]);

    const insert = mockRunLog.find((entry) => entry.sql.includes('INSERT INTO songs'));
    expect(insert?.sql).toContain('lyrics = COALESCE(excluded.lyrics, lyrics)');
    expect(insert?.params[12]).toBe(1);
    expect(insert?.params[13]).toBe('Primera\nSegunda');
  });

  it('nunca resetea la disponibilidad de toda la tabla', async () => {
    await songRepository.upsertBatch([scanned('m-1')]);

    expect(
      mockRunLog.some((entry) => entry.sql.includes('UPDATE songs SET is_available = 0'))
    ).toBe(false);
  });

  it('resuelve artistas y álbumes una sola vez por lote', async () => {
    await songRepository.upsertBatch([scanned('m-1'), scanned('m-2')]);

    expect(mockRunLog.filter((entry) => entry.sql.includes('INSERT INTO artists'))).toHaveLength(1);
    expect(mockRunLog.filter((entry) => entry.sql.includes('INSERT INTO albums'))).toHaveLength(1);
  });

  it('protege los metadatos editados a mano al reescribir (FASE 5.2)', async () => {
    await songRepository.upsertBatch([scanned('m-1')]);

    const insert = mockRunLog.find((entry) => entry.sql.includes('INSERT INTO songs'));
    expect(insert?.sql).toContain(
      'title = CASE WHEN metadata_manual = 1 THEN title ELSE excluded.title END'
    );
    expect(insert?.sql).toContain(
      'artist_id = CASE WHEN metadata_manual = 1 THEN artist_id ELSE excluded.artist_id END'
    );
    expect(insert?.sql).toContain(
      'album_id = CASE WHEN metadata_manual = 1 THEN album_id ELSE excluded.album_id END'
    );
  });
});

describe('songRepository.markMissing', () => {
  it('marca por chunks de 500 ids sin borrar filas', async () => {
    const ids = Array.from({ length: 1_200 }, (_, index) => `m-${index}`);

    await songRepository.markMissing(ids);

    const updates = mockRunLog.filter((entry) =>
      entry.sql.includes('SET is_available = 0')
    );
    expect(updates).toHaveLength(3);
    expect(updates.map((entry) => entry.params.length)).toEqual([500, 500, 200]);
    expect(updates.every((entry) => entry.sql.startsWith('UPDATE songs SET'))).toBe(true);
  });

  it('no consulta SQLite sin ids', async () => {
    await songRepository.markMissing([]);

    expect(mockRunLog).toHaveLength(0);
  });
});

describe('songRepository.setAudiobook', () => {
  it('actualiza por chunks de 500 ids', async () => {
    const ids = Array.from({ length: 1_200 }, (_, index) => index + 1);

    await songRepository.setAudiobook(ids, true);

    const updates = mockRunLog.filter((entry) =>
      entry.sql.includes('audiobook_manual = 1')
    );
    expect(updates).toHaveLength(3);
    expect(updates[0].params[0]).toBe(1);
    expect(updates.map((entry) => entry.params.length)).toEqual([501, 501, 201]);
  });
});

describe('songRepository.getByIds', () => {
  it('consulta por chunks de 500 y conserva el orden pedido', async () => {
    mockAllHandler = (_sql, params) => params.map((id) => songRow(Number(id)));
    const ids = Array.from({ length: 1_200 }, (_, index) => index + 1);

    const songs = await songRepository.getByIds(ids);

    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(3);
    expect(songs).toHaveLength(1_200);
    expect(songs[0].id).toBe(1);
    expect(songs[0].lyrics).toBe('Línea una\nLínea dos');
    expect(songs.at(-1)?.id).toBe(1_200);
  });

  it('resuelve ids repetidos sin duplicar la consulta', async () => {
    mockAllHandler = (_sql, params) => params.map((id) => songRow(Number(id)));

    const songs = await songRepository.getByIds([2, 1, 2]);

    expect(mockDb.getAllAsync).toHaveBeenCalledTimes(1);
    expect(songs.map((song) => song.id)).toEqual([2, 1, 2]);
  });
});

describe('songRepository.getScanState', () => {
  it('conserva la fecha nula y la disponibilidad de las filas migradas', async () => {
    mockAllHandler = () => [
      {
        media_id: 'vieja',
        modification_time: null,
        is_available: 1,
        uri: 'file:///music/Vieja.mp3',
        duration: 120,
        folder_name: 'music',
        artwork_uri: null,
        content_key: null,
      },
      {
        media_id: 'podada',
        modification_time: 50,
        is_available: 0,
        uri: 'file:///music/podada.mp3',
        duration: 90,
        folder_name: 'discos',
        artwork_uri: 'file:///documents/artwork/podada.jpg',
        content_key: 'huella',
      },
    ];

    const state = await songRepository.getScanState();
    const sql = mockDb.getAllAsync.mock.calls[0][0];

    expect(sql).toContain('folder_name');
    expect(sql).toContain('content_key');
    expect(state).toEqual([
      {
        mediaId: 'vieja',
        modificationTime: null,
        isAvailable: true,
        uri: 'file:///music/Vieja.mp3',
        filename: 'vieja.mp3',
        folder: 'music',
        durationMs: 120_000,
        artworkUri: null,
        contentKey: null,
      },
      {
        mediaId: 'podada',
        modificationTime: 50,
        isAvailable: false,
        uri: 'file:///music/podada.mp3',
        filename: 'podada.mp3',
        folder: 'discos',
        durationMs: 90_000,
        artworkUri: 'file:///documents/artwork/podada.jpg',
        contentKey: 'huella',
      },
    ]);
  });
});

describe('songRepository.relocateSong', () => {
  const next = {
    ...scanned('m-nuevo', 20),
    uri: 'file:///music/nuevo.mp3',
    artwork: 'file:///documents/artwork/huella.jpg',
    contentKey: 'huella',
  };
  const params = {
    oldMediaId: 'm-viejo',
    next,
    contentKey: 'huella',
    artworkUri: 'file:///documents/artwork/huella.jpg',
  };

  it('actualiza en sitio la fila existing sin borrar datos del usuario', async () => {
    mockFirstHandler = (sql) => (sql.includes('WHERE media_id = ?') ? { id: 42 } : null);

    await expect(songRepository.relocateSong(params)).resolves.toBe(true);

    const update = mockRunLog.find(
      (entry) => entry.sql.startsWith('UPDATE songs') && entry.sql.includes('media_id = ?')
    );
    expect(update?.sql).toContain('WHERE id = ?');
    expect(update?.params[0]).toBe('m-nuevo');
    expect(update?.params.at(-1)).toBe(42);
    expect(update?.sql).not.toContain('INSERT INTO');
  });

  it('aborta sin escribir si la fila antigua no existe', async () => {
    await expect(songRepository.relocateSong(params)).resolves.toBe(false);
    expect(mockRunLog).toHaveLength(0);
  });

  it('aborta sin escribir si el nuevo id o URI ya pertenece a otra fila', async () => {
    mockFirstHandler = (sql) =>
      sql.includes('AND id != ?') ? { id: 7 } : { id: 42 };

    await expect(songRepository.relocateSong(params)).resolves.toBe(false);
    expect(mockRunLog).toHaveLength(0);
  });
});

describe('songRepository: backfill de huellas', () => {
  it('pide solo filas sin huella ni intento previo', async () => {
    mockAllHandler = () => [];

    await songRepository.getContentKeyBackfillRows();

    const sql = mockDb.getAllAsync.mock.calls[0][0];
    expect(sql).toContain('content_key IS NULL');
    expect(sql).toContain('content_key_checked_at IS NULL');
  });

  it('guarda resultados (incluidos nulos) en lotes por debajo del límite de variables', async () => {
    const updates = Array.from({ length: 250 }, (_, index) => ({
      id: index + 1,
      contentKey: index === 0 ? null : `huella-${index}`,
    }));

    await songRepository.setContentKeyChecks(updates, 9_000);

    const writes = mockRunLog.filter((entry) => entry.sql.startsWith('UPDATE songs'));
    expect(writes).toHaveLength(2);
    expect(writes.map((entry) => entry.params.length)).toEqual([601, 151]);
    expect(writes[0].sql).toContain('CASE id');
    expect(writes[0].params).toContain(null);
    expect(writes[0].params).toContain(9_000);
  });
});

describe('songRepository.getArtworkCandidates', () => {
  it('sin force solo pide las pistas nunca verificadas', async () => {
    mockAllHandler = () => [
      { id: 1, media_id: 'm-1', uri: 'file:///m-1.flac', album_id: 7 },
    ];

    const candidates = await songRepository.getArtworkCandidates();

    expect(mockDb.getAllAsync.mock.calls[0][0]).toContain('artwork_checked_at IS NULL');
    expect(candidates).toEqual([
      { id: 1, mediaId: 'm-1', uri: 'file:///m-1.flac', albumId: 7 },
    ]);
  });

  it('con force revisa todas las pistas sin portada', async () => {
    mockAllHandler = () => [];

    await songRepository.getArtworkCandidates(true);

    const sql = mockDb.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('artwork_uri IS NULL');
    expect(sql).not.toContain('artwork_checked_at IS NULL');
  });
});

describe('songRepository.applyArtworkBackfill', () => {
  it('asigna la portada, sella la fecha y completa el álbum', async () => {
    await songRepository.applyArtworkBackfill({
      songIds: [1, 2],
      albumId: 9,
      artwork: 'file:///cache/art.jpg',
      checkedAt: 500,
    });

    const songUpdate = mockRunLog.find((entry) =>
      entry.sql.includes('UPDATE songs SET artwork_uri')
    );
    expect(songUpdate?.params).toEqual(['file:///cache/art.jpg', 500, 1, 2]);
    const albumUpdate = mockRunLog.find((entry) => entry.sql.includes('UPDATE albums'));
    expect(albumUpdate?.params).toEqual(['file:///cache/art.jpg', 9]);
  });

  it('sin portada solo sella la fecha y no toca el álbum', async () => {
    await songRepository.applyArtworkBackfill({
      songIds: [3],
      albumId: 9,
      artwork: null,
      checkedAt: 700,
    });

    const songUpdate = mockRunLog.find((entry) =>
      entry.sql.includes('UPDATE songs SET artwork_checked_at')
    );
    expect(songUpdate?.params).toEqual([700, 3]);
    expect(mockRunLog.some((entry) => entry.sql.includes('UPDATE albums'))).toBe(false);
  });

  it('no abre transacción sin ids', async () => {
    await songRepository.applyArtworkBackfill({
      songIds: [],
      albumId: 9,
      artwork: 'file:///x.jpg',
      checkedAt: 1,
    });

    expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
  });
});

describe('songRepository.updateSongMetadata', () => {
  it('actualiza título, artista y álbum y marca la edición manual', async () => {
    await songRepository.updateSongMetadata(7, {
      title: '  Nuevo  ',
      artist: 'Otro',
      album: 'Disco',
    });

    const update = mockRunLog.find((entry) => entry.sql.startsWith('UPDATE songs SET'));
    expect(update?.sql).toContain('title = ?');
    expect(update?.sql).toContain('artist_id = ?');
    expect(update?.sql).toContain('album_id = ?');
    expect(update?.sql).toContain('metadata_manual = 1');
    // Título recortado, artista creado (id 1), álbum creado (id 2), pista 7.
    expect(update?.params).toEqual(['Nuevo', 1, 2, 7]);
  });

  it('sin artista usa el de la pista para resolver el álbum', async () => {
    mockFirstHandler = (sql) =>
      sql.includes('artist_id FROM songs') ? { artist_id: 5 } : null;

    await songRepository.updateSongMetadata(9, { album: 'Disco' });

    const update = mockRunLog.find((entry) => entry.sql.startsWith('UPDATE songs SET'));
    expect(update?.sql).toContain('album_id = ?');
    expect(update?.sql).not.toContain('title = ?');
    expect(update?.params).toEqual([1, 9]);
  });

  it('no escribe nada si no hay campos útiles', async () => {
    await songRepository.updateSongMetadata(1, { title: '   ' });

    expect(mockRunLog).toHaveLength(0);
  });
});

describe('songRepository.renameAlbum', () => {
  it('renombra el álbum y marca sus pistas como editadas a mano', async () => {
    mockFirstHandler = (sql) =>
      sql.includes('FROM albums WHERE id =')
        ? { id: 3, title: 'Viejo', artist_id: 1, artwork_uri: null }
        : null;

    await songRepository.renameAlbum(3, 'Nuevo');

    expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockRunLog.find((entry) => entry.sql.includes('UPDATE albums SET title'))?.params).toEqual([
      'Nuevo',
      3,
    ]);
    expect(
      mockRunLog.find((entry) =>
        entry.sql.includes('UPDATE songs SET metadata_manual = 1 WHERE album_id')
      )?.params
    ).toEqual([3]);
    expect(mockRunLog.some((entry) => entry.sql.startsWith('DELETE FROM albums'))).toBe(false);
  });

  it('fusiona con un álbum existente y elimina el viejo', async () => {
    mockFirstHandler = (sql) => {
      if (sql.includes('FROM albums WHERE id =')) {
        return { id: 3, title: 'Viejo', artist_id: 1, artwork_uri: 'file:///a.jpg' };
      }
      if (sql.includes('id != ?')) {
        return { id: 8 };
      }
      return null;
    };

    await songRepository.renameAlbum(3, 'Existente');

    expect(
      mockRunLog.find((entry) => entry.sql.includes('UPDATE songs SET album_id = ?'))?.params
    ).toEqual([8, 3]);
    expect(
      mockRunLog.find((entry) => entry.sql.includes('UPDATE albums SET artwork_uri = COALESCE'))
        ?.params
    ).toEqual(['file:///a.jpg', 8]);
    expect(mockRunLog.find((entry) => entry.sql.startsWith('DELETE FROM albums'))?.params).toEqual([
      3,
    ]);
  });

  it('no hace nada si el título no cambia', async () => {
    mockFirstHandler = () => ({ id: 3, title: 'Igual', artist_id: 1, artwork_uri: null });

    await songRepository.renameAlbum(3, 'Igual');

    expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
    expect(mockRunLog).toHaveLength(0);
  });

  it('no hace nada con un título vacío', async () => {
    await songRepository.renameAlbum(3, '   ');

    expect(mockRunLog).toHaveLength(0);
  });
});

describe('songRepository.removeFromLibrary', () => {
  it('quita de la biblioteca y recuerda el media_id sin borrar la fila', async () => {
    await songRepository.removeFromLibrary([1, 2]);

    const insert = mockRunLog.find((entry) =>
      entry.sql.includes('INSERT OR IGNORE INTO ignored_media')
    );
    expect(insert?.sql).toContain('SELECT media_id, ? FROM songs WHERE id IN (?,?)');
    expect(insert?.params).toEqual([expect.any(Number), 1, 2]);
    expect(
      mockRunLog.find((entry) =>
        entry.sql.includes('UPDATE songs SET is_available = 0 WHERE id IN')
      )?.params
    ).toEqual([1, 2]);
    expect(mockRunLog.some((entry) => entry.sql.startsWith('DELETE FROM songs'))).toBe(false);
  });

  it('no abre transacción sin ids', async () => {
    await songRepository.removeFromLibrary([]);

    expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
  });
});

describe('songRepository.markUnavailable', () => {
  it('marca por chunks de 500 ids', async () => {
    const ids = Array.from({ length: 1_200 }, (_, index) => index + 1);

    await songRepository.markUnavailable(ids);

    const updates = mockRunLog.filter((entry) =>
      entry.sql.includes('UPDATE songs SET is_available = 0 WHERE id IN')
    );
    expect(updates).toHaveLength(3);
    expect(updates.map((entry) => entry.params.length)).toEqual([500, 500, 200]);
  });

  it('no consulta SQLite sin ids', async () => {
    await songRepository.markUnavailable([]);

    expect(mockRunLog).toHaveLength(0);
  });
});

describe('songRepository.ignored media', () => {
  it('devuelve el conjunto de media_id ignorados', async () => {
    mockAllHandler = () => [{ media_id: 'a' }, { media_id: 'b' }];

    const ignored = await songRepository.getIgnoredMediaIds();

    expect([...ignored]).toEqual(['a', 'b']);
  });

  it('cuenta las pistas ignoradas', async () => {
    mockFirstHandler = (sql) => (sql.includes('COUNT(*)') ? { count: 4 } : null);

    await expect(songRepository.countIgnored()).resolves.toBe(4);
  });

  it('devuelve 0 cuando no hay pistas ignoradas', async () => {
    await expect(songRepository.countIgnored()).resolves.toBe(0);
  });

  it('limpia la tabla al restaurar', async () => {
    await songRepository.restoreIgnored();

    expect(mockRunLog.some((entry) => entry.sql === 'DELETE FROM ignored_media')).toBe(true);
  });
});

describe('songRepository.artwork persistente', () => {
  it('devuelve las URIs guardadas de las pistas disponibles', async () => {
    mockAllHandler = () => [
      {
        id: 1,
        media_id: 'm-1',
        uri: 'file:///music/m-1.mp3',
        album_id: 7,
        artwork_uri: 'file:///cache/artwork/m-1.jpg',
      },
    ];

    await expect(songRepository.getStoredArtworkUris()).resolves.toEqual([
      {
        id: 1,
        mediaId: 'm-1',
        uri: 'file:///music/m-1.mp3',
        albumId: 7,
        artworkUri: 'file:///cache/artwork/m-1.jpg',
      },
    ]);
    expect(mockDb.getAllAsync.mock.calls[0][0]).toContain('s.artwork_uri IS NOT NULL');
  });

  it('sustituye la URI rota en songs y albums en una transacción', async () => {
    await songRepository.replaceArtworkUri(
      'file:///cache/artwork/m-1.jpg',
      'file:///documents/artwork/m-1.jpg'
    );

    expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockRunLog.map((entry) => entry.sql)).toEqual([
      'UPDATE songs SET artwork_uri = ? WHERE artwork_uri = ?',
      'UPDATE albums SET artwork_uri = ? WHERE artwork_uri = ?',
    ]);
    expect(mockRunLog[0].params).toEqual([
      'file:///documents/artwork/m-1.jpg',
      'file:///cache/artwork/m-1.jpg',
    ]);
  });

  it('libera la URI irreparable y permite volver a intentarlo', async () => {
    await songRepository.clearArtworkUri('file:///cache/artwork/m-1.jpg');

    expect(mockRunLog[0].sql).toContain('artwork_uri = NULL, artwork_checked_at = NULL');
    expect(mockRunLog[1].sql).toBe(
      'UPDATE albums SET artwork_uri = NULL WHERE artwork_uri = ?'
    );
    expect(mockRunLog[1].params).toEqual(['file:///cache/artwork/m-1.jpg']);
  });
});
