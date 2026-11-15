import { makeSong } from '@/testing/fixtures';

/**
 * `expo-constants` fuera de Expo Go: es el escenario de un build de
 * desarrollo/standalone, donde el lock screen sí debe intentarse.
 */
jest.mock('expo-constants', () => ({ __esModule: true, default: { appOwnership: null } }));

jest.mock('expo-audio', () => {
  let failures = 0;

  const createInstance = () => {
    const instance: Record<string, unknown> = {
      playing: false,
      currentIndex: 0,
      currentTime: 0,
      trackCount: 0,
      loop: 'none',
      setActiveForLockScreen: jest.fn(() => {
        if (failures === -1 || failures > 0) {
          if (failures > 0) {
            failures -= 1;
          }
          throw new Error('lock screen no disponible');
        }
      }),
      updateLockScreenMetadata: jest.fn(),
      clearLockScreenControls: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
      skipTo: jest.fn((index: number) => {
        instance.currentIndex = index;
      }),
      next: jest.fn(),
      previous: jest.fn(),
      add: jest.fn(),
      insert: jest.fn(),
      remove: jest.fn(),
      seekTo: jest.fn(async () => undefined),
      destroy: jest.fn(),
      release: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    };
    return instance;
  };

  return {
    /** `1` falla una vez; `-1` falla siempre; `0` funciona. */
    __setLockScreenFailures: (value: number) => {
      failures = value;
    },
    createAudioPlaylist: jest.fn(() => createInstance()),
    requestNotificationPermissionsAsync: jest.fn(async () => ({ granted: true })),
    setAudioModeAsync: jest.fn(async () => undefined),
  };
});

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

type Engine = typeof import('@/services/audio-engine');

let engine: Engine;
let audioMock: {
  __setLockScreenFailures: (value: number) => void;
  createAudioPlaylist: jest.Mock;
};

function lastInstance(): {
  setActiveForLockScreen: jest.Mock;
  clearLockScreenControls: jest.Mock;
} {
  const results = audioMock.createAudioPlaylist.mock.results;
  return results[results.length - 1].value;
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  audioMock = jest.requireMock('expo-audio');
  // `resetModules` borra el registro: este require crea un motor limpio para
  // que el estado del lock screen no se filtre entre pruebas.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  engine = require('@/services/audio-engine') as Engine;
  audioMock.__setLockScreenFailures(0);
});

afterEach(() => {
  engine.stopPlayback();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('lock screen (C-01): reintentos en vez de desactivación permanente', () => {
  it('se recupera de un fallo transitorio tras el primer backoff', () => {
    audioMock.__setLockScreenFailures(1);
    const song = makeSong({ id: 1 });

    engine.startQueue([song], { startSongId: 1, loop: 'none', shuffle: false });

    expect(engine.getLockScreenHealth()).toMatchObject({ status: 'unknown', attempts: 1 });

    jest.advanceTimersByTime(1000);

    expect(engine.getLockScreenHealth()).toMatchObject({
      status: 'active',
      attempts: 0,
      lastError: null,
    });
    expect(lastInstance().setActiveForLockScreen).toHaveBeenCalledTimes(2);
  });

  it('agota el backoff 1 s → 3 s → 10 s y declara la sesión degradada', () => {
    audioMock.__setLockScreenFailures(-1);
    const song = makeSong({ id: 2 });

    engine.startQueue([song], { startSongId: 2, loop: 'none', shuffle: false });
    expect(engine.getLockScreenHealth().attempts).toBe(1);

    jest.advanceTimersByTime(1000);
    expect(engine.getLockScreenHealth().attempts).toBe(2);

    jest.advanceTimersByTime(3000);
    expect(engine.getLockScreenHealth().attempts).toBe(3);

    jest.advanceTimersByTime(10_000);
    expect(engine.getLockScreenHealth()).toMatchObject({
      status: 'degraded',
      attempts: 3,
    });
    expect(lastInstance().setActiveForLockScreen).toHaveBeenCalledTimes(4);

    // No hay reintentos infinitos.
    jest.advanceTimersByTime(60_000);
    expect(lastInstance().setActiveForLockScreen).toHaveBeenCalledTimes(4);
  });

  it('emite la salud a los suscriptores y permite recuperarse con una cola nueva', () => {
    audioMock.__setLockScreenFailures(-1);
    const statuses: string[] = [];
    engine.subscribeLockScreenHealth((health) => statuses.push(health.status));

    engine.startQueue([makeSong({ id: 3 })], {
      startSongId: 3,
      loop: 'none',
      shuffle: false,
    });
    jest.advanceTimersByTime(14_000);

    expect(statuses).toContain('degraded');

    // El dispositivo vuelve a aceptar la sesión: una cola nueva reintenta.
    audioMock.__setLockScreenFailures(0);
    engine.startQueue([makeSong({ id: 4 }), makeSong({ id: 5 })], {
      startSongId: 4,
      loop: 'none',
      shuffle: false,
    });

    expect(engine.getLockScreenHealth()).toMatchObject({ status: 'active', attempts: 0 });
  });

  it('deja de reintentar si el usuario detiene la reproducción', () => {
    audioMock.__setLockScreenFailures(1);
    engine.startQueue([makeSong({ id: 6 })], {
      startSongId: 6,
      loop: 'none',
      shuffle: false,
    });

    engine.stopPlayback();
    jest.advanceTimersByTime(20_000);

    expect(lastInstance().setActiveForLockScreen).toHaveBeenCalledTimes(1);
    expect(engine.getLockScreenHealth().status).not.toBe('degraded');
  });
});
