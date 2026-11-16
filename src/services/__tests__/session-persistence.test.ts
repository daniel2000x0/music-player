import { playbackSessionRepository } from '@/data/repositories/playback-session.repository';
import { QUEUE_DEBOUNCE_MS, type PlaybackSession } from '@/domain/playback/session';
import {
  flushSessionPersistence,
  resetSessionPersistence,
  savePositionThrottled,
  saveSessionNow,
  saveSessionSoon,
} from '@/services/audio/session-persistence';

jest.mock('@/data/repositories/playback-session.repository', () => ({
  playbackSessionRepository: { save: jest.fn(async () => undefined) },
}));

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
}));

const saveMock = playbackSessionRepository.save as jest.Mock;

function session(position = 0): PlaybackSession {
  return {
    queueSongIds: [1, 2, 3],
    currentSongId: 1,
    positionSeconds: position,
    repeatMode: 'none',
    shuffle: false,
    updatedAt: Date.now(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  resetSessionPersistence();
});

afterEach(() => {
  resetSessionPersistence();
  jest.useRealTimers();
});

describe('session-persistence: posición', () => {
  it('escribe como máximo 3 veces en 10 s con un tick cada 100 ms', async () => {
    for (let tick = 0; tick < 100; tick += 1) {
      savePositionThrottled(() => session(tick));
      jest.advanceTimersByTime(100);
    }
    await flushSessionPersistence();

    // Sin throttle serían 100 escrituras; con 5 s de ventana, 2 o 3.
    expect(saveMock.mock.calls.length).toBeGreaterThan(0);
    expect(saveMock.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('no construye la sesión cuando el throttle la descarta', () => {
    const build = jest.fn(() => session());

    savePositionThrottled(build);
    savePositionThrottled(build);

    expect(build).toHaveBeenCalledTimes(1);
  });
});

describe('session-persistence: cola', () => {
  it('agrupa los cambios de cola en una sola escritura', async () => {
    saveSessionSoon(() => session(1));
    jest.advanceTimersByTime(QUEUE_DEBOUNCE_MS / 2);
    saveSessionSoon(() => session(2));
    jest.advanceTimersByTime(QUEUE_DEBOUNCE_MS / 2);
    saveSessionSoon(() => session(3));

    expect(saveMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(QUEUE_DEBOUNCE_MS);
    await flushSessionPersistence();

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0][0]).toMatchObject({ positionSeconds: 3 });
  });
});

describe('session-persistence: escritura inmediata', () => {
  it('cancela el debounce pendiente y escribe el estado más reciente', async () => {
    saveSessionSoon(() => session(1));
    saveSessionNow(() => session(9));
    await flushSessionPersistence();

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0][0]).toMatchObject({ positionSeconds: 9 });

    jest.advanceTimersByTime(QUEUE_DEBOUNCE_MS * 2);
    await flushSessionPersistence();

    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});

describe('session-persistence: flush', () => {
  it('vuelca lo pendiente al pasar a segundo plano', async () => {
    saveSessionSoon(() => session(4));

    await flushSessionPersistence();

    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('serializa las escrituras y no propaga un fallo del repositorio', async () => {
    saveMock.mockRejectedValueOnce(new Error('disco lleno'));

    saveSessionNow(() => session(1));
    saveSessionNow(() => session(2));

    await expect(flushSessionPersistence()).resolves.toBeUndefined();
    expect(saveMock).toHaveBeenCalledTimes(2);
  });
});
