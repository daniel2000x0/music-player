import { logError, logWarning } from '@/services/error-log.service';
import {
  AUDIO_PAGE_SIZE,
  listDeviceAudioIds,
  loadDeviceAudio,
} from '@/services/media.service';

/**
 * La mediateca se simula con un dataset paginable. Cada llamada a `exe()` o
 * `exeForMetadata()` devuelve la página correspondiente al `offset` pedido,
 * igual que la API real de `expo-media-library`.
 */
const mockDataset: { id: string; getInfo?: () => Promise<unknown> }[] = [];
let mockFailQueries = false;
let mockPageReads = 0;
let mockRepeatFirstPage = false;

function mockPage(offset: number) {
  mockPageReads += 1;
  if (mockFailQueries) {
    throw new Error('MediaStore no disponible');
  }
  if (mockRepeatFirstPage && mockPageReads > 1) {
    // Simula un proveedor que ignora `offset` y repite la primera página.
    return mockDataset.slice(0, AUDIO_PAGE_SIZE);
  }
  return mockDataset.slice(offset, offset + AUDIO_PAGE_SIZE);
}

jest.mock('expo-media-library', () => {
  class Query {
    private offsetValue = 0;

    eq() {
      return this;
    }

    orderBy() {
      return this;
    }

    limit() {
      return this;
    }

    offset(value: number) {
      this.offsetValue = value;
      return this;
    }

    exe() {
      return Promise.resolve(mockPage(this.offsetValue));
    }

    exeForMetadata() {
      return Promise.resolve(mockPage(this.offsetValue));
    }
  }

  return {
    Query,
    AssetField: { MEDIA_TYPE: 'mediaType', CREATION_TIME: 'creationTime' },
    MediaType: { AUDIO: 'audio' },
    getPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  };
});

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
  logWarning: jest.fn(),
}));

jest.mock('@/services/tag.service', () => ({
  readAudioTags: jest.fn(async () => ({
    title: null,
    artist: null,
    album: null,
    albumArtist: null,
    track: null,
  })),
}));

jest.mock('@/services/artwork.service', () => ({
  assignAlbumArtwork: jest.fn(async () => undefined),
}));

function makeMetadata(count: number): void {
  for (let index = 0; index < count; index += 1) {
    mockDataset.push({ id: `media-${index}` });
  }
}

function makeAssets(count: number): void {
  for (let index = 0; index < count; index += 1) {
    const id = `asset-${index}`;
    mockDataset.push({
      id,
      getInfo: async () => ({
        id,
        filename: `pista-${index}.mp3`,
        uri: 'file:///storage/emulated/0/Audio/Libro/pista.mp3',
        duration: 180_000,
      }),
    });
  }
}

beforeEach(() => {
  mockDataset.length = 0;
  mockFailQueries = false;
  mockPageReads = 0;
  mockRepeatFirstPage = false;
  jest.clearAllMocks();
});

describe('listDeviceAudioIds (C-02: sin tope silencioso)', () => {
  it('recorre todas las páginas de una biblioteca de 12 000 pistas', async () => {
    makeMetadata(12_000);

    const ids = await listDeviceAudioIds();

    expect(ids).not.toBeNull();
    expect(ids?.size).toBe(12_000);
    // 12 páginas completas + una vacía que confirma el final.
    expect(mockPageReads).toBe(13);
  });

  it('continúa cuando el total es múltiplo exacto del tamaño de página', async () => {
    makeMetadata(AUDIO_PAGE_SIZE * 2);

    const ids = await listDeviceAudioIds();

    expect(ids?.size).toBe(AUDIO_PAGE_SIZE * 2);
    expect(mockPageReads).toBe(3);
  });

  it('deduplica ids y se detiene si el proveedor ignora el offset', async () => {
    makeMetadata(AUDIO_PAGE_SIZE);
    mockRepeatFirstPage = true;

    const ids = await listDeviceAudioIds();

    expect(ids?.size).toBe(AUDIO_PAGE_SIZE);
    expect(mockPageReads).toBe(2);
    expect(logWarning).toHaveBeenCalled();
  });

  it('devuelve un conjunto vacío (no null) si no hay audio', async () => {
    const ids = await listDeviceAudioIds();

    expect(ids).not.toBeNull();
    expect(ids?.size).toBe(0);
  });

  it('devuelve null y registra el fallo si la consulta revienta', async () => {
    mockFailQueries = true;

    const ids = await listDeviceAudioIds();

    expect(ids).toBeNull();
    expect(logError).toHaveBeenCalledWith(
      'media-service',
      'query.exeForMetadata',
      expect.any(Error)
    );
  });
});

describe('loadDeviceAudio (C-02: biblioteca completa)', () => {
  it('resuelve más de 5000 canciones sin truncar', async () => {
    makeAssets(6000);

    const songs = await loadDeviceAudio();

    expect(songs).not.toBeNull();
    expect(songs).toHaveLength(6000);
    expect(songs?.[5999]).toMatchObject({
      mediaId: 'asset-5999',
      folder: 'Libro',
      duration: 180,
    });
  });

  it('devuelve un array vacío (no null) si el dispositivo no tiene audio', async () => {
    const songs = await loadDeviceAudio();

    expect(songs).toEqual([]);
  });

  it('devuelve null y registra el fallo si la consulta revierte', async () => {
    mockFailQueries = true;

    const songs = await loadDeviceAudio();

    expect(songs).toBeNull();
    expect(logError).toHaveBeenCalledWith('media-service', 'query.exec', expect.any(Error));
  });
});
