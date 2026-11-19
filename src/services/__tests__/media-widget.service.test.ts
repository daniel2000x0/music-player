/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Pruebas del puente con el widget de pantalla de inicio (`A-02`, `M-06`).
 *
 * El servicio guarda estado a nivel de módulo (cola de snapshots, último estado
 * publicado y última clave escrita), así que cada caso recarga los módulos con
 * `jest.resetModules()` para partir de cero. Expo, los stores y el resolve de
 * portadas se sustituyen por dobles controlados; no se toca código de producción.
 *
 * NOTA: Jest 30 evalúa los módulos en un VM sin el callback de `import()`
 * dinámico (requiere `--experimental-vm-modules`). El servicio carga el widget
 * con `import()` diferido, así que aquí se transforma solo esa expresión a un
 * `require()` dentro de una promesa; el resto del fichero fuente se ejecuta
 * tal cual con los mocks de Jest.
 */
import { makeSong } from '@/testing/fixtures';
import type { Song } from '@/types/song';
import type { ThemeMode } from '@/types/settings';
import {
  MEDIA_WIDGET_NAME,
  MEDIA_WIDGET_TARGETS,
  type MediaWidgetProps,
} from '@/widgets/media-widget.contract';
import { resolveWidgetTheme } from '@/widgets/media-widget-theme';

declare const __dirname: string;

const babel = require('@babel/core') as typeof import('@babel/core');
const { readFileSync } = require('node:fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('node:path') as { join: (...parts: string[]) => string };

// `constants/theme` importa el CSS global: Metro lo transforma, Jest no.
jest.mock('@/global.css', () => ({}));

/**
 * La plataforma se lee desde una variable compartida: al resetear módulos el
 * objeto `Platform` se recrea, pero el getter sigue leyendo este valor. Así se
 * puede simular iOS sin depender del mock de React Native de jest-expo.
 */
let mockPlatformOS: 'android' | 'ios' = 'android';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
    select: (options: Record<string, unknown>) =>
      options[mockPlatformOS] ?? options.default,
  },
}));

/**
 * El doble compartido expone las clases como `FakeFile`/`FakeDirectory`; aquí
 * se les da además el nombre que el servicio importa (`File`/`Directory`).
 */
jest.mock('expo-file-system', () => {
  const doble = require('@/testing/mocks/expo-file-system') as {
    FakeFile: unknown;
    FakeDirectory: unknown;
  };
  return { ...doble, File: doble.FakeFile, Directory: doble.FakeDirectory };
});
jest.mock('expo-widgets', () => require('@/testing/mocks/expo-widgets'));
jest.mock('expo-modules-core', () => require('@/testing/mocks/expo-modules-core'));

jest.mock('@/widgets/media-widget', () => ({
  __esModule: true,
  default: {
    updateSnapshot: jest.fn((props: MediaWidgetProps) =>
      require('expo-widgets').__recordSnapshot(props)
    ),
  },
}));

jest.mock('@/services/artwork.service', () => ({
  resolveArtworkUri: jest.fn(async () => null),
}));

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

jest.mock('@/stores/player.store', () => ({
  usePlayerStore: { getState: jest.fn(), setState: jest.fn() },
}));

jest.mock('@/stores/library.store', () => ({
  useLibraryStore: { getState: jest.fn() },
}));

jest.mock('@/stores/settings.store', () => ({
  useSettingsStore: { getState: jest.fn() },
}));

jest.mock('@/stores/playback-progress', () => ({
  getPlaybackPosition: jest.fn(() => 0),
  getPlaybackDuration: jest.fn(() => 0),
}));

type Service = typeof import('@/services/media-widget.service');
type WidgetsMock = typeof import('@/testing/mocks/expo-widgets');
type FileSystemMock = typeof import('@/testing/mocks/expo-file-system');
type NativeCoreMock = typeof import('@/testing/mocks/expo-modules-core');

type PlayerState = {
  queue: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  previous: jest.Mock;
  toggle: jest.Mock;
  next: jest.Mock;
};

type LoadOptions = {
  os?: 'android' | 'ios';
  nativeAvailable?: boolean;
  theme?: ThemeMode;
  queue?: Song[];
  currentSong?: Song | null;
  isPlaying?: boolean;
  position?: number;
  duration?: number;
  getSongById?: (id: number) => Song | undefined;
};

type Loaded = {
  service: Service;
  widgets: WidgetsMock;
  fileSystem: FileSystemMock;
  playerState: PlayerState;
  playerStore: { usePlayerStore: { setState: jest.Mock } };
  libraryStore: { useLibraryStore: { getState: jest.Mock } };
  settingsStore: { useSettingsStore: { getState: jest.Mock } };
  artwork: { resolveArtworkUri: jest.Mock };
  progress: { getPlaybackPosition: jest.Mock; getPlaybackDuration: jest.Mock };
  logError: jest.Mock;
};

/** El servicio publica de forma asíncrona (import diferido + portada). */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Sustituye `import('x')` por `Promise.resolve().then(() => require('x'))`. */
function importToRequire({ types: t }: { types: typeof import('@babel/types') }) {
  return {
    name: 'import-diferido-a-require',
    visitor: {
      CallExpression(path: import('@babel/traverse').NodePath<import('@babel/types').CallExpression>) {
        if (!t.isImport(path.node.callee)) {
          return;
        }
        const [specifier] = path.node.arguments;
        if (!t.isStringLiteral(specifier)) {
          return;
        }
        path.replaceWith(
          t.callExpression(
            t.memberExpression(
              t.callExpression(t.memberExpression(t.identifier('Promise'), t.identifier('resolve')), []),
              t.identifier('then')
            ),
            [t.arrowFunctionExpression([], t.callExpression(t.identifier('require'), [specifier]))]
          )
        );
      },
    },
  };
}

/** Código transformado, compartido por todas las pruebas (el estado se reinicia al evaluarlo). */
let transformedService: string | null = null;

/** Transforma el fuente una sola vez; el resultado se comparte entre pruebas. */
function transformedSource(): string {
  if (transformedService === null) {
    const filename = join(__dirname, '..', 'media-widget.service.ts');
    transformedService =
      babel.transformSync(readFileSync(filename, 'utf8'), {
        filename,
        babelrc: false,
        configFile: false,
        presets: ['babel-preset-expo'],
        plugins: [importToRequire],
      })?.code ?? null;
    if (!transformedService) {
      throw new Error('No se pudo transformar media-widget.service.ts');
    }
  }
  return transformedService;
}

/**
 * Babel tarda varios segundos en transformar el servicio. Se calienta aquí,
 * fuera del presupuesto de 5 s de cada prueba: al ejecutar la suite completa
 * (65 archivos) la primera prueba que lo transformaba agotaba el timeout.
 */
beforeAll(() => {
  transformedSource();
}, 30_000);

/** Evalúa el fuente real del servicio con el import diferido ya resuelto. */
function requireService(): Service {
  const code = transformedSource();
  const loaded = { exports: {} as Record<string, unknown> };
  const evaluate = new Function('require', 'module', 'exports', code) as (
    require: (id: string) => unknown,
    module: { exports: Record<string, unknown> },
    exports: Record<string, unknown>
  ) => void;
  evaluate(require, loaded, loaded.exports);
  return loaded.exports as unknown as Service;
}

/** Recarga el servicio con un entorno controlado y devuelve sus dobles. */
function loadService(options: LoadOptions = {}): Loaded {
  const {
    os = 'android',
    nativeAvailable = true,
    theme = 'dark',
    queue = [],
    currentSong = null,
    isPlaying = false,
    position = 0,
    duration = 0,
    getSongById = () => undefined,
  } = options;

  jest.resetModules();
  mockPlatformOS = os;

  const nativeCore = jest.requireMock('expo-modules-core') as NativeCoreMock;
  nativeCore.__setWidgetModuleAvailable(nativeAvailable);

  const fileSystem = jest.requireMock('expo-file-system') as FileSystemMock;
  const widgets = jest.requireMock('expo-widgets') as WidgetsMock;
  fileSystem.__reset();
  widgets.__reset();
  fileSystem.__seedDirectory(widgets.widgetsDirectory);

  const playerState: PlayerState = {
    queue,
    currentSong,
    isPlaying,
    previous: jest.fn(),
    toggle: jest.fn(),
    next: jest.fn(),
  };
  const playerStore = jest.requireMock('@/stores/player.store') as Loaded['playerStore'] & {
    usePlayerStore: { getState: jest.Mock<PlayerState> };
  };
  playerStore.usePlayerStore.getState.mockReturnValue(playerState);

  const libraryStore = jest.requireMock('@/stores/library.store') as Loaded['libraryStore'];
  libraryStore.useLibraryStore.getState.mockReturnValue({
    getSongById: jest.fn(getSongById),
  });

  const settingsStore = jest.requireMock('@/stores/settings.store') as Loaded['settingsStore'];
  settingsStore.useSettingsStore.getState.mockReturnValue({ theme });

  const progress = jest.requireMock('@/stores/playback-progress') as Loaded['progress'];
  progress.getPlaybackPosition.mockReturnValue(position);
  progress.getPlaybackDuration.mockReturnValue(duration);

  const artwork = jest.requireMock('@/services/artwork.service') as Loaded['artwork'];
  artwork.resolveArtworkUri.mockResolvedValue(null);

  const logError = (jest.requireMock('@/services/error-log.service') as {
    logError: jest.Mock;
  }).logError;

  const service = requireService();
  return {
    service,
    widgets,
    fileSystem,
    playerState,
    playerStore,
    libraryStore,
    settingsStore,
    artwork,
    progress,
    logError,
  };
}

const SONG = makeSong({ id: 1, title: 'Canción de prueba', artist: 'Artista de prueba' });
const NEXT_SONG = makeSong({ id: 2, title: 'Siguiente', artist: 'Otro artista' });
const COVER_URI = 'file:///cache/artwork/media-1.jpg';

describe('syncMediaWidget', () => {
  it('publica un snapshot con título, artista, estado, portada y tema', async () => {
    const { service, widgets, fileSystem } = loadService({
      theme: 'light',
      queue: [SONG, NEXT_SONG],
    });
    const song = makeSong({ ...SONG, artwork: COVER_URI });
    fileSystem.__seedFile(COVER_URI, 'bytes-de-portada');

    service.syncMediaWidget(song, true, 12.4, 200.6);
    await flush();

    expect(widgets.__snapshots()).toHaveLength(1);
    expect(widgets.__lastSnapshot()).toMatchObject({
      title: 'Canción de prueba',
      artist: 'Artista de prueba',
      isPlaying: true,
      hasSong: true,
      position: 12,
      duration: 201,
      artwork: `file:///widgets/media-cover-${song.id}.jpg`,
      canGoPrevious: true,
      canGoNext: true,
      statusLabel: 'Canción de prueba — Artista de prueba, en reproducción',
    });
    expect(widgets.__lastSnapshot()?.theme).toEqual(resolveWidgetTheme('light'));
  });

  it('filtra los ticks de progreso menores a un segundo', async () => {
    const { service, widgets } = loadService();

    service.syncMediaWidget(SONG, true, 10.2, 200);
    await flush();
    service.syncMediaWidget(SONG, true, 10.4, 200);
    await flush();
    service.syncMediaWidget(SONG, true, 10.49, 200);
    await flush();

    expect(widgets.__snapshots()).toHaveLength(1);
    expect(widgets.__lastSnapshot()?.position).toBe(10);

    service.syncMediaWidget(SONG, true, 11.2, 200);
    await flush();

    expect(widgets.__snapshots().map((props) => props.position)).toEqual([10, 11]);
  });

  it('refleja seeks de retroceso y salto al instante', async () => {
    const { service, widgets } = loadService();

    service.syncMediaWidget(SONG, true, 30, 200);
    await flush();
    service.syncMediaWidget(SONG, true, 5, 200);
    await flush();
    service.syncMediaWidget(SONG, true, 120, 200);
    await flush();

    expect(widgets.__snapshots().map((props) => props.position)).toEqual([30, 5, 120]);
  });

  it('vuelve a publicar al cambiar el tema', async () => {
    const { service, widgets, settingsStore } = loadService({ theme: 'dark' });

    service.syncMediaWidget(SONG, true, 10, 200);
    await flush();
    settingsStore.useSettingsStore.getState.mockReturnValue({ theme: 'light' });
    service.syncMediaWidget(SONG, true, 10, 200);
    await flush();

    expect(widgets.__snapshots()).toHaveLength(2);
    expect(widgets.__snapshots()[0].theme).toEqual(resolveWidgetTheme('dark'));
    expect(widgets.__lastSnapshot()?.theme).toEqual(resolveWidgetTheme('light'));
  });

  it('vuelve a publicar al cambiar la capacidad de salto (cola > 1)', async () => {
    const { service, widgets, playerState } = loadService({ queue: [SONG] });

    service.syncMediaWidget(SONG, true, 10, 200);
    await flush();
    expect(widgets.__lastSnapshot()).toMatchObject({
      canGoPrevious: false,
      canGoNext: false,
    });

    playerState.queue = [SONG, NEXT_SONG];
    service.syncMediaWidget(SONG, true, 10, 200);
    await flush();

    expect(widgets.__snapshots()).toHaveLength(2);
    expect(widgets.__lastSnapshot()).toMatchObject({
      canGoPrevious: true,
      canGoNext: true,
    });
  });

  it('colapsa las llamadas seguidas y publica solo el último estado', async () => {
    const { service, widgets, artwork } = loadService();
    const pending: { release: ((uri: string | null) => void) | null } = { release: null };
    artwork.resolveArtworkUri.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          pending.release = resolve;
        })
    );

    // El primer snapshot se queda esperando la portada; el segundo llega antes.
    service.syncMediaWidget(SONG, true, 5, 100);
    for (let i = 0; i < 20 && pending.release === null; i += 1) {
      await Promise.resolve();
    }
    expect(pending.release).not.toBeNull();
    service.syncMediaWidget(NEXT_SONG, false, 9, 120);
    pending.release?.(null);
    await flush();

    expect(widgets.__snapshots()).toHaveLength(1);
    expect(widgets.__lastSnapshot()).toMatchObject({
      title: 'Siguiente',
      artist: 'Otro artista',
      isPlaying: false,
      position: 9,
      duration: 120,
    });
  });

  it('publica el estado vacío con el tema activo cuando no hay pista', async () => {
    const { service, widgets } = loadService({ theme: 'light', queue: [SONG] });

    service.syncMediaWidget(null, false, 0, 0);
    await flush();

    expect(widgets.__lastSnapshot()).toMatchObject({
      hasSong: false,
      title: 'Sin reproducción',
      isPlaying: false,
      artwork: null,
    });
    expect(widgets.__lastSnapshot()?.theme).toEqual(resolveWidgetTheme('light'));
  });
});

describe('reconcileMediaWidget', () => {
  it('refresca la pista actual con metadatos frescos y fuerza la republicación', async () => {
    const stale = makeSong({ id: 7, title: 'Viejo', artist: 'Artista viejo' });
    const fresh = makeSong({ id: 7, title: 'Nuevo', artist: 'Artista nuevo' });
    const { service, widgets, playerStore, libraryStore } = loadService({
      queue: [stale],
      currentSong: stale,
      isPlaying: true,
      position: 40,
      duration: 180,
    });

    service.syncMediaWidget(stale, true, 40, 180);
    await flush();
    expect(widgets.__snapshots()).toHaveLength(1);

    libraryStore.useLibraryStore.getState.mockReturnValue({
      getSongById: () => fresh,
    });
    service.reconcileMediaWidget();
    await flush();

    expect(playerStore.usePlayerStore.setState).toHaveBeenCalledWith({
      currentSong: fresh,
      queue: [fresh],
    });
    expect(widgets.__snapshots()).toHaveLength(2);
    expect(widgets.__lastSnapshot()).toMatchObject({
      title: 'Nuevo',
      artist: 'Artista nuevo',
      position: 40,
      duration: 180,
      isPlaying: true,
    });
  });

  it('fuerza una republicación aunque las props sean idénticas', async () => {
    const { service, widgets, playerStore } = loadService({
      queue: [SONG],
      currentSong: SONG,
      isPlaying: false,
      position: 12,
      duration: 200,
    });

    service.syncMediaWidget(SONG, false, 12, 200);
    await flush();
    service.reconcileMediaWidget();
    await flush();

    expect(widgets.__snapshots()).toHaveLength(2);
    expect(widgets.__snapshots()[1]).toEqual(widgets.__snapshots()[0]);
    expect(playerStore.usePlayerStore.setState).not.toHaveBeenCalled();
  });
});

describe('registerMediaWidgetInteractions', () => {
  it('traduce previous/toggle/next a acciones del store del reproductor', async () => {
    const { service, widgets, playerState } = loadService();
    const unsubscribe = service.registerMediaWidgetInteractions();
    await flush();

    widgets.__emitInteraction({ source: MEDIA_WIDGET_NAME, target: MEDIA_WIDGET_TARGETS.previous });
    widgets.__emitInteraction({ source: MEDIA_WIDGET_NAME, target: MEDIA_WIDGET_TARGETS.toggle });
    widgets.__emitInteraction({ source: MEDIA_WIDGET_NAME, target: MEDIA_WIDGET_TARGETS.next });

    expect(playerState.previous).toHaveBeenCalledTimes(1);
    expect(playerState.toggle).toHaveBeenCalledTimes(1);
    expect(playerState.next).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('ignora las pulsaciones que vienen de otro widget', async () => {
    const { service, widgets, playerState } = loadService();
    const unsubscribe = service.registerMediaWidgetInteractions();
    await flush();

    widgets.__emitInteraction({ source: 'OtroWidget', target: MEDIA_WIDGET_TARGETS.next });
    expect(playerState.next).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('retira el oyente al cancelar', async () => {
    const { service, widgets, playerState } = loadService();
    const unsubscribe = service.registerMediaWidgetInteractions();
    await flush();
    const subscription = widgets.addUserInteractionListener.mock.results[0]
      .value as { remove: jest.Mock };

    unsubscribe();

    expect(subscription.remove).toHaveBeenCalledTimes(1);
    widgets.__emitInteraction({ source: MEDIA_WIDGET_NAME, target: MEDIA_WIDGET_TARGETS.next });
    expect(playerState.next).not.toHaveBeenCalled();
  });
});

describe('degradación sin widget nativo', () => {
  it('sin el módulo ExpoWidgets todo es no-op y no se registra el oyente', async () => {
    const { service, widgets, playerState, playerStore, logError } = loadService({
      nativeAvailable: false,
    });

    service.syncMediaWidget(SONG, true, 10, 200);
    service.reconcileMediaWidget();
    const unsubscribe = service.registerMediaWidgetInteractions();
    await flush();

    expect(widgets.__snapshots()).toHaveLength(0);
    expect(widgets.addUserInteractionListener).not.toHaveBeenCalled();
    expect(playerStore.usePlayerStore.setState).not.toHaveBeenCalled();
    expect(playerState.next).not.toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');
    expect(logError).not.toHaveBeenCalled();
  });

  it('en iOS tampoco publica ni escucha aunque el módulo esté disponible', async () => {
    const { service, widgets } = loadService({ os: 'ios', nativeAvailable: true });

    service.syncMediaWidget(SONG, true, 10, 200);
    service.reconcileMediaWidget();
    const unsubscribe = service.registerMediaWidgetInteractions();
    await flush();

    expect(widgets.__snapshots()).toHaveLength(0);
    expect(widgets.addUserInteractionListener).not.toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');
  });
});
