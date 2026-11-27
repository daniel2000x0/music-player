import {
  songRepository,
  type ArtworkCandidate,
  type StoredArtworkUri,
} from '@/data/repositories/song.repository';
import type { ScanProgress } from '@/domain/library/scan-progress';
import {
  isUsableArtworkUri,
  resolveAlbumArtwork,
  resolveArtworkUri,
} from '@/services/artwork.service';
import { repairMissingArtwork, runArtworkBackfill } from '@/services/artwork-backfill.service';
import { logError } from '@/services/error-log.service';

jest.mock('@/data/repositories/song.repository', () => ({
  songRepository: {
    getArtworkCandidates: jest.fn(async () => []),
    applyArtworkBackfill: jest.fn(async () => undefined),
    getStoredArtworkUris: jest.fn(async () => []),
    replaceArtworkUri: jest.fn(async () => undefined),
    clearArtworkUri: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/artwork.service', () => ({
  EXTRACTION_CONCURRENCY: 2,
  resolveAlbumArtwork: jest.fn(async () => null),
  resolveArtworkUri: jest.fn(async () => null),
  isUsableArtworkUri: jest.fn(async () => true),
}));

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
}));

const mockedCandidates = jest.mocked(songRepository.getArtworkCandidates);
const mockedApply = jest.mocked(songRepository.applyArtworkBackfill);
const mockedStored = jest.mocked(songRepository.getStoredArtworkUris);
const mockedReplace = jest.mocked(songRepository.replaceArtworkUri);
const mockedClear = jest.mocked(songRepository.clearArtworkUri);
const mockedResolve = jest.mocked(resolveAlbumArtwork);
const mockedResolveUri = jest.mocked(resolveArtworkUri);
const mockedIsUsable = jest.mocked(isUsableArtworkUri);
const mockedLogError = jest.mocked(logError);

function candidate(id: number, albumId: number): ArtworkCandidate {
  return {
    id,
    mediaId: `m-${id}`,
    uri: `file:///music/m-${id}.flac`,
    albumId,
  };
}

function stored(id: number, artworkUri: string): StoredArtworkUri {
  return {
    id,
    mediaId: `m-${id}`,
    uri: `file:///music/m-${id}.flac`,
    albumId: 10,
    artworkUri,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedCandidates.mockReset();
  mockedApply.mockReset();
  mockedStored.mockReset();
  mockedReplace.mockReset();
  mockedClear.mockReset();
  mockedResolve.mockReset();
  mockedResolveUri.mockReset();
  mockedIsUsable.mockReset();
  mockedCandidates.mockResolvedValue([]);
  mockedApply.mockResolvedValue(undefined);
  mockedStored.mockResolvedValue([]);
  mockedReplace.mockResolvedValue(undefined);
  mockedClear.mockResolvedValue(undefined);
  mockedResolve.mockResolvedValue(null);
  mockedResolveUri.mockResolvedValue(null);
  mockedIsUsable.mockResolvedValue(true);
});

describe('repairMissingArtwork', () => {
  it('repara una URI rota compartida por varias pistas una sola vez', async () => {
    mockedStored.mockResolvedValue([
      stored(1, 'file:///cache/artwork/m-1.jpg'),
      stored(2, 'file:///cache/artwork/m-1.jpg'),
    ]);
    mockedIsUsable.mockResolvedValue(false);
    mockedResolveUri.mockResolvedValue('file:///documents/artwork/m-1.jpg');

    const report = await repairMissingArtwork();

    expect(report).toEqual({ checked: 1, resolved: 1 });
    expect(mockedResolveUri).toHaveBeenCalledTimes(1);
    expect(mockedResolveUri).toHaveBeenCalledWith({
      mediaId: 'm-1',
      uri: 'file:///music/m-1.flac',
    });
    expect(mockedReplace).toHaveBeenCalledWith(
      'file:///cache/artwork/m-1.jpg',
      'file:///documents/artwork/m-1.jpg'
    );
    expect(mockedClear).not.toHaveBeenCalled();
  });

  it('libera la URI si no se puede recuperar la portada', async () => {
    mockedStored.mockResolvedValue([stored(3, 'file:///documents/artwork/m-3.jpg')]);
    mockedIsUsable.mockResolvedValue(false);

    await expect(repairMissingArtwork()).resolves.toEqual({ checked: 1, resolved: 0 });
    expect(mockedClear).toHaveBeenCalledWith('file:///documents/artwork/m-3.jpg');
  });

  it('no toca URIs sanas', async () => {
    mockedStored.mockResolvedValue([stored(4, 'file:///music/album/cover.jpg')]);

    await expect(repairMissingArtwork()).resolves.toEqual({ checked: 0, resolved: 0 });
    expect(mockedResolveUri).not.toHaveBeenCalled();
  });

  it('continúa si falla la reparación de una URI', async () => {
    mockedStored.mockResolvedValue([
      stored(1, 'file:///cache/a.jpg'),
      stored(2, 'file:///cache/b.jpg'),
    ]);
    mockedIsUsable.mockResolvedValue(false);
    mockedResolveUri
      .mockRejectedValueOnce(new Error('tag ilegible'))
      .mockResolvedValueOnce('file:///documents/b.jpg');

    await expect(repairMissingArtwork()).resolves.toEqual({ checked: 2, resolved: 1 });
    expect(mockedLogError).toHaveBeenCalledWith(
      'artwork-backfill',
      'repair',
      expect.any(Error)
    );
    expect(mockedReplace).toHaveBeenCalledWith(
      'file:///cache/b.jpg',
      'file:///documents/b.jpg'
    );
  });
});

describe('runArtworkBackfill', () => {
  it('no hace nada si no hay candidatas', async () => {
    const report = await runArtworkBackfill();

    expect(report).toMatchObject({ candidates: 0, resolved: 0, albums: 0 });
    expect(mockedResolve).not.toHaveBeenCalled();
    expect(mockedApply).not.toHaveBeenCalled();
  });

  it('propaga la portada del álbum a todas sus pistas', async () => {
    mockedCandidates.mockResolvedValueOnce([
      candidate(1, 10),
      candidate(2, 10),
      candidate(3, 20),
    ]);
    mockedResolve.mockImplementation(async (group) =>
      group[0].mediaId === 'm-1' ? 'file:///cache/a.jpg' : null
    );
    const progress: ScanProgress[] = [];

    const report = await runArtworkBackfill({
      onProgress: (next) => progress.push(next),
    });

    expect(mockedResolve).toHaveBeenCalledTimes(2);
    expect(report).toMatchObject({ candidates: 3, resolved: 2, albums: 1 });
    expect(mockedApply).toHaveBeenCalledWith({
      songIds: [1, 2],
      albumId: 10,
      artwork: 'file:///cache/a.jpg',
      checkedAt: expect.any(Number),
    });
    expect(mockedApply).toHaveBeenCalledWith({
      songIds: [3],
      albumId: 20,
      artwork: null,
      checkedAt: expect.any(Number),
    });
    expect(progress.at(-1)).toMatchObject({
      phase: 'backfill',
      processed: 2,
      total: 2,
    });
  });

  it('reanuda el resto si falla al persistir un grupo', async () => {
    mockedCandidates.mockResolvedValueOnce([candidate(1, 10), candidate(2, 20)]);
    mockedResolve.mockResolvedValue('file:///cache/x.jpg');
    mockedApply
      .mockRejectedValueOnce(new Error('disco lleno'))
      .mockResolvedValueOnce(undefined);

    const report = await runArtworkBackfill();

    expect(mockedLogError).toHaveBeenCalled();
    expect(report).toMatchObject({ resolved: 1, albums: 1 });
  });

  it('pasa el modo forzado al repositorio', async () => {
    await runArtworkBackfill({ force: true });

    expect(mockedCandidates).toHaveBeenCalledWith(true);
  });

  it('informa de las URIs reparadas antes del barrido', async () => {
    mockedStored.mockResolvedValue([stored(1, 'file:///cache/a.jpg')]);
    mockedIsUsable.mockResolvedValue(false);
    mockedResolveUri.mockResolvedValue('file:///documents/a.jpg');

    const report = await runArtworkBackfill();

    expect(report.repaired).toBe(1);
    expect(mockedCandidates).toHaveBeenCalledWith(false);
  });
});
