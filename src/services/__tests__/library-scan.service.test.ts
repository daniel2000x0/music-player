import { songRepository } from '@/data/repositories/song.repository';
import type { DeviceTrack } from '@/domain/library/scan-diff';
import type { ScanProgress } from '@/domain/library/scan-progress';
import { assignAlbumArtwork } from '@/services/artwork.service';
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
  },
}));

jest.mock('@/services/artwork.service', () => ({
  assignAlbumArtwork: jest.fn(async () => undefined),
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
    artwork: null,
    modificationTime: track.modificationTime,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetScanState.mockResolvedValue([]);
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
