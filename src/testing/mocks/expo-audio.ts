/**
 * Doble reutilizable de `expo-audio` para pruebas del motor.
 *
 * Se usa desde un factory de `jest.mock`:
 *
 * ```ts
 * jest.mock('expo-audio', () => require('@/testing/mocks/expo-audio'));
 * ```
 *
 * Expone controles deterministas (`__setLockScreenFailures`, `__emit`, …)
 * para reproducir carreras de buffering, fallos de la sesión de medios y
 * eventos nativos sin depender del dispositivo.
 */

export type FakeSource = { uri: string };

export type FakeListener = (payload: Record<string, unknown>) => void;

export type FakePlaylistOptions = {
  sources: FakeSource[];
  updateInterval?: number;
  loop?: string;
};

export type FakePlaylist = {
  sources: FakeSource[];
  updateInterval: number;
  loop: string;
  volume: number;
  currentIndex: number;
  currentTime: number;
  duration: number;
  trackCount: number;
  playing: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  next: jest.Mock;
  previous: jest.Mock;
  skipTo: jest.Mock;
  add: jest.Mock;
  insert: jest.Mock;
  remove: jest.Mock;
  seekTo: jest.Mock;
  destroy: jest.Mock;
  release: jest.Mock;
  setActiveForLockScreen: jest.Mock;
  updateLockScreenMetadata: jest.Mock;
  clearLockScreenControls: jest.Mock;
  addListener: jest.Mock;
  __listeners: Record<string, FakeListener[]>;
  /** Dispara un evento nativo contra los oyentes registrados en esta playlist. */
  __emit: (event: string, payload: Record<string, unknown>) => void;
};

/** `-1` falla siempre; `> 0` falla esa cantidad de veces; `0` funciona. */
let lockScreenFailures = 0;
/** `-1` falla siempre; `> 0` falla esa cantidad de veces; `0` funciona. */
let audioModeFailures = 0;
/** `-1` rechaza siempre; `> 0` rechaza esa cantidad de veces; `0` funciona. */
let seekFailures = 0;
let notificationsGranted = true;
let instances: FakePlaylist[] = [];

export function __reset(): void {
  lockScreenFailures = 0;
  audioModeFailures = 0;
  seekFailures = 0;
  notificationsGranted = true;
  instances = [];
  createAudioPlaylist.mockClear();
  setAudioModeAsync.mockClear();
  requestNotificationPermissionsAsync.mockClear();
}

export function __instances(): FakePlaylist[] {
  return instances;
}

export function __last(): FakePlaylist | undefined {
  return instances[instances.length - 1];
}

export function __setLockScreenFailures(value: number): void {
  lockScreenFailures = value;
}

export function __setAudioModeFailures(value: number): void {
  audioModeFailures = value;
}

export function __setSeekFailures(value: number): void {
  seekFailures = value;
}

export function __setNotificationPermission(granted: boolean): void {
  notificationsGranted = granted;
}

export const createAudioPlaylist = jest.fn((options: FakePlaylistOptions): FakePlaylist => {
  const sources = options.sources;
  const instance: FakePlaylist = {
    sources,
    updateInterval: options.updateInterval ?? 500,
    loop: options.loop ?? 'none',
    volume: 1,
    currentIndex: 0,
    currentTime: 0,
    duration: 0,
    trackCount: sources.length,
    playing: false,
    play: jest.fn(),
    pause: jest.fn(),
    next: jest.fn(),
    previous: jest.fn(),
    skipTo: jest.fn(),
    add: jest.fn(),
    insert: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(),
    destroy: jest.fn(),
    release: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    updateLockScreenMetadata: jest.fn(),
    clearLockScreenControls: jest.fn(),
    addListener: jest.fn(),
    __listeners: {},
    __emit: () => undefined,
  };

  instance.play.mockImplementation(() => {
    instance.playing = true;
  });
  instance.pause.mockImplementation(() => {
    instance.playing = false;
  });
  instance.next.mockImplementation(() => {
    instance.currentIndex = Math.min(instance.currentIndex + 1, instance.trackCount - 1);
  });
  instance.previous.mockImplementation(() => {
    instance.currentIndex = Math.max(instance.currentIndex - 1, 0);
  });
  instance.skipTo.mockImplementation((index: number) => {
    instance.currentIndex = index;
  });
  instance.seekTo.mockImplementation(async () => {
    if (seekFailures === -1 || seekFailures > 0) {
      if (seekFailures > 0) {
        seekFailures -= 1;
      }
      throw new Error('seek nativo no disponible');
    }
    return undefined;
  });
  instance.setActiveForLockScreen.mockImplementation(() => {
    if (lockScreenFailures === -1 || lockScreenFailures > 0) {
      if (lockScreenFailures > 0) {
        lockScreenFailures -= 1;
      }
      throw new Error('lock screen no disponible');
    }
  });
  instance.addListener.mockImplementation((event: string, listener: FakeListener) => {
    const listeners = instance.__listeners[event] ?? [];
    listeners.push(listener);
    instance.__listeners[event] = listeners;
    return { remove: jest.fn() };
  });
  instance.__emit = (event: string, payload: Record<string, unknown>) => {
    for (const listener of instance.__listeners[event] ?? []) {
      listener(payload);
    }
  };

  instances.push(instance);
  return instance;
});

export const setAudioModeAsync = jest.fn(async () => {
  if (audioModeFailures === -1 || audioModeFailures > 0) {
    if (audioModeFailures > 0) {
      audioModeFailures -= 1;
    }
    throw new Error('modo de audio no disponible');
  }
  return undefined;
});

export const requestNotificationPermissionsAsync = jest.fn(async () => ({
  granted: notificationsGranted,
  canAskAgain: true,
  expires: 'never',
  status: notificationsGranted ? 'granted' : 'denied',
}));
