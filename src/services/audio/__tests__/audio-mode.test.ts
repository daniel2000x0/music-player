/**
 * Modo de audio y permiso de notificaciones (`audio-mode`).
 *
 * LÓGICA: la configuración nativa comparte la promesa en vuelo y reintenta con
 * backoff 1 s → 3 s registrando cada fallo. En Android el permiso se pide y se
 * refleja en `capabilities`; en iOS no hace falta. El aviso contextual se ofrece
 * una sola vez por sesión y pasa de `info` a `warning` si se deniega.
 */

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, executionEnvironment: 'bare' },
}));

jest.mock('expo-audio', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/testing/mocks/expo-audio')
);

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
  Linking: { openSettings: jest.fn(async () => undefined) },
}));

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

jest.mock('@/stores/notice.store', () => {
  const state = { push: jest.fn(), dismiss: jest.fn() };
  return {
    useNoticeStore: { getState: jest.fn(() => state) },
    __state: state,
  };
});

type AudioMock = typeof import('@/testing/mocks/expo-audio');
type Mode = typeof import('@/services/audio/audio-mode');
type Capabilities = typeof import('@/services/capabilities');
type ErrorLog = typeof import('@/services/error-log.service');
type NoticeMock = {
  __state: { push: jest.Mock; dismiss: jest.Mock };
  useNoticeStore: { getState: jest.Mock };
};

/** Variable con prefijo `mock` para que el factory de `jest.mock` la acepte. */
let mockPlatformOS: 'android' | 'ios' = 'android';
const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;
let audio: AudioMock;
let mode: Mode;
let capabilities: Capabilities;
let errorLog: ErrorLog;
let notices: NoticeMock;

/** Vacía la cadena de microtareas tras resolver un permiso asíncrono. */
async function flush(): Promise<void> {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
}

function load(os: 'android' | 'ios'): void {
  jest.resetModules();
  mockPlatformOS = os;
  audio = jest.requireMock<AudioMock>('expo-audio');
  audio.__reset();
  errorLog = jest.requireMock<ErrorLog>('@/services/error-log.service');
  notices = jest.requireMock<NoticeMock>('@/stores/notice.store');
  notices.__state.push.mockClear();
  notices.__state.dismiss.mockClear();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mode = require('@/services/audio/audio-mode') as Mode;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  capabilities = require('@/services/capabilities') as Capabilities;
}

beforeEach(() => {
  jest.useFakeTimers();
  // El permiso denegado avisa en desarrollo: se silencia para no ensuciar la salida.
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  load('android');
});

afterEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('modo de audio: configuración compartida y reintentos', () => {
  it('configura la sesión una sola vez con las opciones de segundo plano', async () => {
    await mode.configureAudioSession();

    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    expect(errorLog.logError).not.toHaveBeenCalled();
  });

  it('comparte la promesa en vuelo entre llamadas del puente de React', async () => {
    let resolveMode: () => void = () => undefined;
    audio.setAudioModeAsync.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          resolveMode = () => resolve(undefined);
        })
    );

    const first = mode.configureAudioSession();
    const second = mode.configureAudioSession();

    expect(second).toBe(first);
    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(1);

    resolveMode();
    await first;
  });

  it('reintenta tras 1 s y registra el fallo en logError', async () => {
    audio.__setAudioModeFailures(1);

    const pending = mode.configureAudioSession();
    await flush();
    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(errorLog.logError).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    await pending;

    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(2);
    expect(errorLog.logError).toHaveBeenCalledTimes(1);
  });

  it('respeta la espera de 3 s antes del segundo reintento', async () => {
    audio.__setAudioModeFailures(2);

    const pending = mode.configureAudioSession();
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();

    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(2);
    // El segundo intento también falla: ya hay dos errores registrados.
    expect(errorLog.logError).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(3000);
    await pending;

    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(3);
    expect(errorLog.logError).toHaveBeenCalledTimes(2);
  });

  it('deja de reintentar tras agotar 1 s y 3 s', async () => {
    audio.__setAudioModeFailures(-1);

    const pending = mode.configureAudioSession();
    await flush();
    jest.advanceTimersByTime(1000);
    await flush();
    jest.advanceTimersByTime(3000);
    await pending;

    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(3);
    expect(errorLog.logError).toHaveBeenCalledTimes(3);

    jest.advanceTimersByTime(60_000);
    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(3);
  });
});

describe('permiso de notificaciones y aviso contextual', () => {
  it('en Android pide el permiso y publica el resultado', async () => {
    audio.__setNotificationPermission(true);

    await mode.requestNotificationPermission();

    expect(audio.requestNotificationPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(capabilities.getCapabilities()['playback.notifications']).toBe(true);
  });

  it('en iOS no pide permiso: los controles funcionan sin él', async () => {
    load('ios');

    await mode.requestNotificationPermission();

    expect(audio.requestNotificationPermissionsAsync).not.toHaveBeenCalled();
    expect(capabilities.getCapabilities()['playback.notifications']).toBe(true);
  });

  it('en Android denegado conserva la capacidad en false y avisa en desarrollo', async () => {
    audio.__setNotificationPermission(false);
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await mode.requestNotificationPermission();

    expect(capabilities.getCapabilities()['playback.notifications']).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Permiso de notificaciones'));
  });

  it('un fallo al pedir el permiso se registra sin propagarse', async () => {
    audio.requestNotificationPermissionsAsync.mockImplementationOnce(async () => {
      throw new Error('permiso no disponible');
    });

    await expect(mode.requestNotificationPermission()).resolves.toBeUndefined();
    expect(errorLog.logError).toHaveBeenCalledWith(
      'audio/mode',
      'requestNotificationPermissionsAsync',
      expect.any(Error)
    );
  });

  it('ofrece el aviso informativo una sola vez por sesión', () => {
    capabilities.setPermissionSnapshot({ notifications: false });

    mode.promptNotificationPermission();
    mode.promptNotificationPermission();

    expect(notices.__state.push).toHaveBeenCalledTimes(1);
    expect(notices.__state.push).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'playback.notifications',
        severity: 'info',
        action: expect.objectContaining({ label: 'Permitir' }),
      })
    );
  });

  it('si se concede, retira el aviso y actualiza capabilities', async () => {
    audio.__setNotificationPermission(true);
    capabilities.setPermissionSnapshot({ notifications: false });

    mode.promptNotificationPermission();
    notices.__state.push.mock.calls[0][0].action.onPress();
    await flush();

    expect(notices.__state.dismiss).toHaveBeenCalledWith('playback.notifications');
    expect(capabilities.getCapabilities()['playback.notifications']).toBe(true);
  });

  it('si se deniega, el aviso pasa a warning y ofrece abrir ajustes', async () => {
    audio.__setNotificationPermission(false);
    capabilities.setPermissionSnapshot({ notifications: false });

    mode.promptNotificationPermission();
    notices.__state.push.mock.calls[0][0].action.onPress();
    await flush();

    expect(notices.__state.push).toHaveBeenCalledTimes(2);
    expect(notices.__state.push.mock.calls[1][0]).toMatchObject({
      code: 'playback.notifications',
      severity: 'warning',
      action: expect.objectContaining({ label: 'Abrir ajustes' }),
    });
  });

  it('no ofrece el aviso en iOS ni si el permiso ya estaba concedido', () => {
    load('ios');
    mode.promptNotificationPermission();
    expect(notices.__state.push).not.toHaveBeenCalled();

    load('android');
    capabilities.setPermissionSnapshot({ notifications: true });
    mode.promptNotificationPermission();
    expect(notices.__state.push).not.toHaveBeenCalled();
  });
});
