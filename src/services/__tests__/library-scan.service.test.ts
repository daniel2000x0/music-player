import { songRepository } from '@/data/repositories/song.repository';
import type { DeviceTrack } from '@/domain/library/scan-diff';
import type { ScanProgress } from '@/domain/library/scan-progress';
import { assignAlbumArtwork, remapArtworkUri } from '@/services/artwork.service';
import { computeContentKey } from '@/services/content-key.service';
import { runArtworkBackfill } from '@/services/artwork-backfill.service';
import { runLibraryScan } from '@/services/library-scan.service';
import { enumerateDeviceAudio, readDeviceTrack } from '@/services/media.service';
import type { ScannedSong } from '@/types/song';

jest.mock('@/services/media.service', () => ({
  TAG_CONCURRENCY: 2,
  enumerateDeviceAudio: jest.fn(),
  readDeviceTrack: jest.fn(),
}));

jest.mock('@/data/repositories/song.repository', () => ({
  songRepository: {
    getScanState: jest.fn(async () => []),
    upsertBatch: jest.fn(async () => undefined),
    markMissing: jest.fn(async () => undefined),
    reclassifyAudiobooks: jest.fn(async () => undefined),
    getIgnoredMediaIds: jest.fn(async () => new Set<string>()),
    relocateSong: jest.fn(async () => false),
    replaceArtworkUri: jest.fn(async () => undefined),
    clearArtworkUri: jest.fn(async () => undefined),
    getContentKeyBackfillRows: jest.fn(async () => []),
    setContentKeyChecks: jest.fn(async () => undefined),
    backfillFileFormats: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/artwork.service', () => ({
  assignAlbumArtwork: jest.fn(async () => undefined),
  remapArtworkUri: jest.fn(async () => null),
}));

jest.mock('@/services/artwork-backfill.service', () => ({
  runArtworkBackfill: jest.fn(async () => undefined),
}));

jest.mock('@/services/content-key.service', () => ({
  computeContentKey: jest.fn(async () => null),
}));

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

const mockedEnumerate = jest.mocked(enumerateDeviceAudio);
const mockedRead = jest.mocked(readDeviceTrack);
const mockedGetScanState = jest.mocked(songRepository.getScanState);
const mockedUpsert = jest.mocked(songRepository.upsertBatch);
const mockedMarkMissing = jest.mocked(songRepository.markMissing);
const mockedReclassify = jest.mocked(songRepository.reclassifyAudiobooks);
const mockedGetIgnored = jest.mocked(songRepository.getIgnoredMediaIds);
const mockedRelocate = jest.mocked(songRepository.relocateSong);
const mockedReplaceArtwork = jest.mocked(songRepository.replaceArtworkUri);
const mockedRemap = jest.mocked(remapArtworkUri);
const mockedComputeKey = jest.mocked(computeContentKey);

function device(mediaId: string, modificationTime: number | null = 100): DeviceTrack {
  return { mediaId, modificationTime };
}

function scanned(track: DeviceTrack): ScannedSong {
  return {
    mediaId: track.mediaId,
    uri: `file:///music/${track.mediaId}.mp3`,
    title: track.mediaId,
    artist: 'Artista',
    album: 'Álbum',
    track: null,
    folder: 'music',
    duration: 120,
    fileFormat: 'mp3',
    bitDepth: null,
    sampleRate: null,
    bitrate: null,
hasLyrics: false,
lyrics: null,
    artwork: null,
    modificationTime: track.modificationTime,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetScanState.mockResolvedValue([]);
  mockedGetIgnored.mockResolvedValue(new Set<string>());
  mockedRead.mockImplementation(async (track) => scanned(track));
});

describe('runLibraryScan: enumeración', () => {
  it('devuelve null y no toca SQLite si la mediateca falla', async () => {
    mockedEnumerate.mockResolvedValueOnce(null);
    const phases: string[] = [];

    const report = await runLibraryScan((progress) => phases.push(progress.phase));

    expect(report).toBeNull();
    expect(phases).toEqual(['enumerate']);
    expect(mockedGetScanState).not.toHaveBeenCalled();
    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(mockedMarkMissing).not.toHaveBeenCalled();
  });

  it('filtra las pistas quitadas de la biblioteca antes del diff (FASE 5.2)', async () => {
    mockedEnumerate.mockResolvedValueOnce([device('normal', 100), device('quitada', 200)]);
    mockedGetIgnored.mockResolvedValueOnce(new Set(['quitada']));

    const report = await runLibraryScan();

    // La pista ignorada no se hidrata ni se persiste, y no se cuenta como
    // ausente: simplemente no existe para el escaneo.
    expect(mockedRead.mock.calls.map(([track]) => track.mediaId)).toEqual(['normal']);
    expect(report).toMatchObject({ deviceTotal: 1, added: 1, missing: 0 });
    expect(mockedMarkMissing).not.toHaveBeenCalled();
  });
});

describe('runLibraryScan: incremental', () => {
  it('solo hidrata nuevas y modificadas y poda las ausentes', async () => {
    mockedEnumerate.mockResolvedValueOnce([
      device('igual', 100),
      device('cambiada', 200),
      device('nueva', 300),
    ]);
    mockedGetScanState.mockResolvedValueOnce([
      { mediaId: 'igual', modificationTime: 100, isAvailable: true },
      { mediaId: 'cambiada', modificationTime: 150, isAvailable: true },
      { mediaId: 'ausente', modificationTime: 400, isAvailable: true },
    ]);

    const report = await runLibraryScan();

    expect(mockedRead.mock.calls.map(([track]) => track.mediaId)).toEqual([
      'nueva',
      'cambiada',
    ]);
    expect(mockedUpsert).toHaveBeenCalledTimes(1);
    expect(mockedUpsert.mock.calls[0][0].map((song) => song.mediaId)).toEqual([
      'nueva',
      'cambiada',
    ]);
    expect(assignAlbumArtwork).toHaveBeenCalledTimes(1);
    expect(runArtworkBackfill).toHaveBeenCalledTimes(1);
    expect(mockedMarkMissing).toHaveBeenCalledWith(['ausente']);
    expect(mockedReclassify).toHaveBeenCalledTimes(1);
    expect(report).toMatchObject({
      mode: 'incremental',
      deviceTotal: 3,
      added: 1,
      updated: 1,
      unchanged: 1,
      missing: 1,
      skipped: 0,
    });
  });

  it('no relee ni escribe nada cuando la biblioteca está al día', async () => {
    mockedEnumerate.mockResolvedValueOnce([device('igual', 100)]);
    mockedGetScanState.mockResolvedValueOnce([
      { mediaId: 'igual', modificationTime: 100, isAvailable: true },
    ]);

    const report = await runLibraryScan();

    expect(mockedRead).not.toHaveBeenCalled();
    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(mockedMarkMissing).not.toHaveBeenCalled();
    expect(mockedReclassify).not.toHaveBeenCalled();
    // El barrido de carátulas corre aunque la biblioteca esté al día: es donde
    // se reparan las pistas guardadas sin portada.
    expect(runArtworkBackfill).toHaveBeenCalledTimes(1);
    expect(report).toMatchObject({ unchanged: 1, added: 0, updated: 0, missing: 0 });
  });

  it('cae a escaneo completo si el proveedor no expone la fecha', async () => {
    mockedEnumerate.mockResolvedValueOnce([device('a', null)]);
    mockedGetScanState.mockResolvedValueOnce([
      { mediaId: 'a', modificationTime: 100, isAvailable: true },
    ]);

    const report = await runLibraryScan();

    expect(mockedRead).toHaveBeenCalledTimes(1);
    expect(report?.mode).toBe('full');
  });

  it('cuenta como ilegibles las pistas que no se pueden leer', async () => {
    mockedEnumerate.mockResolvedValueOnce([device('rota', 100)]);
    mockedRead.mockResolvedValueOnce(null);

    const report = await runLibraryScan();

    expect(report).toMatchObject({ added: 1, skipped: 1 });
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it('persiste en lotes acotados para bibliotecas grandes', async () => {
    const tracks = Array.from({ length: 250 }, (_, index) => device(`n-${index}`, 100 + index));
    mockedEnumerate.mockResolvedValueOnce(tracks);

    await runLibraryScan();

    expect(mockedUpsert).toHaveBeenCalledTimes(3);
    expect(mockedUpsert.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 50]);
    expect(mockedRead).toHaveBeenCalledTimes(250);
  });
});

describe('runLibraryScan: reubicaciones', () => {
  it('reconoce por huella una canción movida y conserva su fila', async () => {
    const moved = {
      ...scanned(device('nuevo', 200)),
      contentKey: 'huella',
      artwork: 'file:///documents/artwork/huella.jpg',
    };
    mockedEnumerate.mockResolvedValueOnce([device('nuevo', 200)]);
    mockedGetScanState.mockResolvedValueOnce([
      {
        mediaId: 'viejo',
        modificationTime: 100,
        isAvailable: true,
        uri: 'file:///music/viejo.mp3',
        filename: 'viejo.mp3',
        folder: 'Album',
        durationMs: 120_000,
        contentKey: 'huella',
        artworkUri: 'file:///documents/artwork/viejo.jpg',
      },
    ]);
    mockedRead.mockResolvedValueOnce(moved);
    mockedRemap.mockResolvedValueOnce('file:///documents/artwork/huella.jpg');
    mockedRelocate.mockResolvedValueOnce(true);

    const report = await runLibraryScan();

    expect(mockedRelocate).toHaveBeenCalledWith({
      oldMediaId: 'viejo',
      next: moved,
      contentKey: 'huella',
      artworkUri: 'file:///documents/artwork/huella.jpg',
    });
    expect(mockedRemap).toHaveBeenCalledWith({
      oldUri: 'file:///documents/artwork/viejo.jpg',
      nextMediaId: 'nuevo',
      nextUri: moved.uri,
      nextContentKey: 'huella',
    });
    expect(mockedReplaceArtwork).toHaveBeenCalledWith(
      'file:///documents/artwork/viejo.jpg',
      'file:///documents/artwork/huella.jpg'
    );
    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(mockedMarkMissing).not.toHaveBeenCalled();
    expect(report).toMatchObject({ added: 0, missing: 0, unchanged: 0, updated: 0 });
  });

  it('inserta como nueva si la reubicación choca con otra fila', async () => {
    const moved = { ...scanned(device('nuevo', 200)), contentKey: 'huella' };
    mockedEnumerate.mockResolvedValueOnce([device('nuevo', 200)]);
    mockedGetScanState.mockResolvedValueOnce([
      {
        mediaId: 'viejo',
        modificationTime: 100,
        isAvailable: true,
        uri: 'file:///music/viejo.mp3',
        filename: 'viejo.mp3',
        durationMs: 120_000,
        contentKey: 'huella',
      },
    ]);
    mockedRead.mockResolvedValueOnce(moved);
    mockedRelocate.mockResolvedValueOnce(false);

    await runLibraryScan();

    expect(mockedUpsert.mock.calls[0][0].map((song) => song.mediaId)).toEqual(['nuevo']);
    expect(mockedMarkMissing).toHaveBeenCalledWith(['viejo']);
  });

  it('calcula la huella de las filas anteriores antes del diff', async () => {
    mockedEnumerate.mockResolvedValueOnce([device('igual', 100)]);
    mockedGetScanState.mockResolvedValueOnce([
      { mediaId: 'igual', modificationTime: 100, isAvailable: true },
    ]);
    mockedComputeKey.mockResolvedValueOnce('huella-antigua');
    jest.mocked(songRepository.getContentKeyBackfillRows).mockResolvedValueOnce([
      { id: 7, uri: 'file:///music/igual.mp3', duration: 120 },
    ]);

    await runLibraryScan();

    expect(mockedComputeKey).toHaveBeenCalledWith('file:///music/igual.mp3', 120);
    expect(songRepository.setContentKeyChecks).toHaveBeenCalledWith(
      [{ id: 7, contentKey: 'huella-antigua' }],
      expect.any(Number)
    );
  });
});

describe('runLibraryScan: progreso', () => {
  it('emite todas las fases en orden', async () => {
    mockedEnumerate.mockResolvedValueOnce([device('nueva', 100)]);
    mockedGetScanState.mockResolvedValueOnce([]);
    const phases: string[] = [];
    const progress: ScanProgress[] = [];

    await runLibraryScan((next) => {
      phases.push(next.phase);
      progress.push(next);
    });

    expect(phases).toEqual([
      'enumerate',
      'enumerate',
      'diff',
      'hydrate',
      'hydrate',
      'persist',
      'done',
    ]);
    expect(progress.at(-1)).toMatchObject({ phase: 'done', processed: 1, total: 1 });
    expect(progress.some((next) => next.mode === 'incremental')).toBe(true);
  });
});
