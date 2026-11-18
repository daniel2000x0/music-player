/**
 * Permiso de notificaciones en contexto (`M-01`).
 *
 * LÓGICA: se aísla el registro de módulos para cargar `audio-mode` con
 * `Platform.OS = 'android'` y un `expo-audio` falso que decide si el diálogo
 * del sistema concede o deniega. Así se prueba la ruta completa: explicación →
 * acción → resultado visible y reversible, sin depender del dispositivo.
 */

type AudioMode = typeof import('@/services/audio/audio-mode');
type Capabilities = typeof import('@/services/capabilities');
type NoticeStore = typeof import('@/stores/notice.store');

function loadAudioMode(granted: boolean): {
  audioMode: AudioMode;
  notices: NoticeStore;
  capabilities: Capabilities;
} {
  jest.doMock('react-native', () => ({
    Platform: { OS: 'android' },
    Linking: { openSettings: jest.fn(async () => undefined) },
  }));
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { executionEnvironment: 'standalone', appOwnership: null },
  }));
  jest.doMock('expo-audio', () => ({
    setAudioModeAsync: jest.fn(async () => undefined),
    requestNotificationPermissionsAsync: jest.fn(async () => ({ granted })),
  }));
  jest.doMock('@/services/error-log.service', () => ({
    logError: jest.fn(),
    logWarning: jest.fn(),
  }));

  return {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    audioMode: require('@/services/audio/audio-mode') as AudioMode,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notices: require('@/stores/notice.store') as NoticeStore,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    capabilities: require('@/services/capabilities') as Capabilities,
  };
}

/** Vacía la cola de microtareas de la cadena asíncrona del permiso. */
async function flush(): Promise<void> {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  jest.dontMock('react-native');
  jest.dontMock('expo-constants');
  jest.dontMock('expo-audio');
  jest.dontMock('@/services/error-log.service');
});

describe('permiso de notificaciones en contexto (M-01)', () => {
  it('explica para qué sirve y ofrece permitir', () => {
    const { audioMode, notices } = loadAudioMode(false);
    notices.useNoticeStore.getState().clear();

    audioMode.promptNotificationPermission();

    const notice = notices.useNoticeStore.getState().notices[0];
    expect(notice).toMatchObject({ code: 'playback.notifications', severity: 'info' });
    expect(notice.message).toContain('notificaciones');
    expect(notice.action?.label).toBe('Permitir');
  });

  it('no insiste: como mucho un aviso por sesión', () => {
    const { audioMode, notices } = loadAudioMode(false);
    notices.useNoticeStore.getState().clear();

    audioMode.promptNotificationPermission();
    audioMode.promptNotificationPermission();

    expect(notices.useNoticeStore.getState().notices).toHaveLength(1);
  });

  it('si se deniega, el aviso es visible y ofrece abrir ajustes', async () => {
    const { audioMode, notices } = loadAudioMode(false);
    notices.useNoticeStore.getState().clear();

    audioMode.promptNotificationPermission();
    notices.useNoticeStore.getState().notices[0].action?.onPress();
    await flush();

    const notice = notices.useNoticeStore.getState().notices[0];
    expect(notice).toMatchObject({ code: 'playback.notifications', severity: 'warning' });
    expect(notice.action?.label).toBe('Abrir ajustes');
  });

  it('si se concede, retira el aviso y lo refleja en capabilities', async () => {
    const { audioMode, notices, capabilities } = loadAudioMode(true);
    notices.useNoticeStore.getState().clear();

    audioMode.promptNotificationPermission();
    notices.useNoticeStore.getState().notices[0].action?.onPress();
    await flush();

    expect(notices.useNoticeStore.getState().notices).toHaveLength(0);
    expect(capabilities.getCapabilities()['playback.notifications']).toBe(true);
  });

  it('no pide nada si el permiso ya estaba resuelto', () => {
    const { audioMode, notices, capabilities } = loadAudioMode(false);
    notices.useNoticeStore.getState().clear();
    capabilities.setPermissionSnapshot({ notifications: true });

    audioMode.promptNotificationPermission();

    expect(notices.useNoticeStore.getState().notices).toHaveLength(0);
  });
});
