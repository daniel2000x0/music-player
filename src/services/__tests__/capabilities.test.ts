type CapabilitiesModule = typeof import('@/services/capabilities');

/**
 * Capacidades del entorno (`A-04`).
 *
 * Se aísla el registro de módulos en cada caso porque `capabilities` deriva su
 * fotografía de `Platform` y del entorno de expo-constants al cargarse.
 */
function loadCapabilities(
  os: 'android' | 'ios' | 'web',
  executionEnvironment: string,
  appOwnership: string | null = null
): CapabilitiesModule {
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: { executionEnvironment, appOwnership },
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/services/capabilities') as CapabilitiesModule;
}

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  jest.dontMock('react-native');
  jest.dontMock('expo-constants');
});

describe('capabilities: build nativo en Android', () => {
  it('promete reproducción en segundo plano, lock screen y widget', () => {
    const capabilities = loadCapabilities('android', 'standalone');

    expect(capabilities.getCapabilities()).toMatchObject({
      'playback.background': true,
      'playback.lockScreen': true,
      'widget.homeScreen': true,
      'library.incrementalScan': true,
      'library.albumFolderGrouping': true,
    });
    // Sin permisos resueltos no se promete ni mediateca ni notificaciones.
    expect(capabilities.getCapabilities()['mediaLibrary.read']).toBe(false);
    expect(capabilities.getCapabilities()['playback.notifications']).toBe(false);
  });

  it('refleja los permisos concedidos y notifica a los suscriptores', () => {
    const capabilities = loadCapabilities('android', 'standalone');
    const seen: boolean[] = [];
    const unsubscribe = capabilities.subscribeCapabilities((snapshot) =>
      seen.push(snapshot['mediaLibrary.read'])
    );

    capabilities.setPermissionSnapshot({ mediaLibrary: true, notifications: true });

    expect(capabilities.getCapabilities()).toMatchObject({
      'mediaLibrary.read': true,
      'playback.notifications': true,
    });
    expect(seen).toEqual([false, true]);

    unsubscribe();
    capabilities.setPermissionSnapshot({ mediaLibrary: false });
    expect(seen).toEqual([false, true]);
  });
});

describe('capabilities: Expo Go', () => {
  it('no promete lock screen ni widget aunque sea Android', () => {
    const capabilities = loadCapabilities('android', 'storeClient', 'expo');

    expect(capabilities.getCapabilities()).toMatchObject({
      'playback.background': true,
      'playback.lockScreen': false,
      'widget.homeScreen': false,
    });
  });
});

describe('capabilities: iOS', () => {
  it('considera disponible la notificación de reproducción sin pedir permiso', () => {
    const capabilities = loadCapabilities('ios', 'standalone');

    expect(capabilities.getCapabilities()).toMatchObject({
      'playback.background': true,
      'playback.lockScreen': true,
      'playback.notifications': true,
      'widget.homeScreen': false,
      'mediaLibrary.read': false,
    });
  });
});

describe('capabilities: web', () => {
  it('no promete ninguna capacidad nativa', () => {
    const capabilities = loadCapabilities('web', 'standalone');

    const values = Object.values(capabilities.getCapabilities());
    expect(values.every((value) => value === false)).toBe(true);
  });
});
