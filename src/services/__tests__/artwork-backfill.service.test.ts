import {
  songRepository,
  type ArtworkCandidate,
} from '@/data/repositories/song.repository';
import type { ScanProgress } from '@/domain/library/scan-progress';
import { resolveAlbumArtwork } from '@/services/artwork.service';
import { runArtworkBackfill } from '@/services/artwork-backfill.service';
import { logError } from '@/services/error-log.service';

jest.mock('@/data/repositories/song.repository', () => ({
  songRepository: {
    getArtworkCandidates: jest.fn(async () => []),
    applyArtworkBackfill: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/artwork.service', () => ({
  EXTRACTION_CONCURRENCY: 2,
  resolveAlbumArtwork: jest.fn(async () => null),
}));

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
}));

const mockedCandidates = jest.mocked(songRepository.getArtworkCandidates);
const mockedApply = jest.mocked(songRepository.applyArtworkBackfill);
const mockedResolve = jest.mocked(resolveAlbumArtwork);
const mockedLogError = jest.mocked(logError);

function candidate(id: number, albumId: number): ArtworkCandidate {
  return {
    id,
    mediaId: `m-${id}`,
    uri: `file:///music/m-${id}.flac`,
    albumId,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedCandidates.mockReset();
  mockedApply.mockReset();
  mockedResolve.mockReset();
  mockedCandidates.mockResolvedValue([]);
  mockedApply.mockResolvedValue(undefined);
  mockedResolve.mockResolvedValue(null);
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
});
