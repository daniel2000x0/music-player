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

describe('capabilities: detección de Expo Go', () => {
  it('detecta Expo Go por appOwnership aunque el entorno sea standalone', () => {
    const capabilities = loadCapabilities('android', 'standalone', 'expo');

    expect(capabilities.getCapabilities()).toMatchObject({
      'playback.background': true,
      'playback.lockScreen': false,
      'widget.homeScreen': false,
    });
  });

  it('detecta Expo Go por executionEnvironment sin appOwnership', () => {
    const capabilities = loadCapabilities('ios', 'storeClient');

    expect(capabilities.getCapabilities()).toMatchObject({
      'playback.background': true,
      'playback.lockScreen': false,
      'widget.homeScreen': false,
    });
  });
});

describe('capabilities: notificaciones y reactividad', () => {
  it('en iOS no exige permiso de notificaciones', () => {
    const capabilities = loadCapabilities('ios', 'standalone');

    capabilities.setPermissionSnapshot({ notifications: false, mediaLibrary: false });

    expect(capabilities.getCapabilities()['playback.notifications']).toBe(true);
  });

  it('en Android las notificaciones dependen del permiso concedido', () => {
    const capabilities = loadCapabilities('android', 'standalone');

    expect(capabilities.getCapabilities()['playback.notifications']).toBe(false);

    capabilities.setPermissionSnapshot({ notifications: true });

    expect(capabilities.getCapabilities()['playback.notifications']).toBe(true);
  });

  it('guarda en caché la fotografía y no emite si el permiso no cambia', () => {
    const capabilities = loadCapabilities('android', 'standalone');
    const snapshot = capabilities.getCapabilities();
    const seen: unknown[] = [];
    const unsubscribe = capabilities.subscribeCapabilities((next) => seen.push(next));

    expect(seen).toEqual([snapshot]);
    expect(capabilities.getCapabilities()).toBe(snapshot);

    capabilities.setPermissionSnapshot({ mediaLibrary: false, notifications: false });

    expect(seen).toEqual([snapshot]);
    expect(capabilities.getCapabilities()).toBe(snapshot);

    unsubscribe();
  });

  it('emite a todos los suscriptores y respeta el unsubscribe de cada uno', () => {
    const capabilities = loadCapabilities('android', 'standalone');
    const first: boolean[] = [];
    const second: boolean[] = [];
    const stopFirst = capabilities.subscribeCapabilities((next) =>
      first.push(next['mediaLibrary.read'])
    );
    const stopSecond = capabilities.subscribeCapabilities((next) =>
      second.push(next['mediaLibrary.read'])
    );

    capabilities.setPermissionSnapshot({ mediaLibrary: true });
    stopFirst();
    capabilities.setPermissionSnapshot({ mediaLibrary: false });

    expect(first).toEqual([false, true]);
    expect(second).toEqual([false, true, false]);

    stopSecond();
  });
});
