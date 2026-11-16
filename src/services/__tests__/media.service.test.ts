import { logError, logWarning } from '@/services/error-log.service';
import {
  AUDIO_PAGE_SIZE,
  enumerateDeviceAudio,
  folderFromUri,
  listDeviceAudioIds,
  readDeviceTrack,
} from '@/services/media.service';

/**
 * La mediateca se simula con metadatos paginables y un mapa de assets. Cada
 * llamada a `exeForMetadata()` devuelve la página del `offset` pedido y
 * `new Asset(id).getInfo()` resuelve el asset del mapa, igual que la API real
 * de `expo-media-library` SDK 58.
 */
type MockMetadata = { id: string; modificationTime: number | null };
type MockAsset = {
  id: string;
  filename: string;
  uri: string;
  duration: number;
  modificationTime: number;
};

const mockMetadata: MockMetadata[] = [];
const mockAssets = new Map<string, MockAsset>();
let mockFailQueries = false;
let mockPageReads = 0;
let mockRepeatFirstPage = false;
let mockFailAssetId: string | null = null;

function mockPage(offset: number): MockMetadata[] {
  mockPageReads += 1;
  if (mockFailQueries) {
    throw new Error('MediaStore no disponible');
  }
  if (mockRepeatFirstPage && mockPageReads > 1) {
    // Simula un proveedor que ignora `offset` y repite la primera página.
    return mockMetadata.slice(0, AUDIO_PAGE_SIZE);
  }
  return mockMetadata.slice(offset, offset + AUDIO_PAGE_SIZE);
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

    exeForMetadata() {
      return Promise.resolve(mockPage(this.offsetValue));
    }
  }

  class Asset {
    readonly id: string;

    constructor(id: string) {
      this.id = id;
    }

    async getInfo() {
      if (this.id === mockFailAssetId) {
        throw new Error('Asset eliminado');
      }
      const info = mockAssets.get(this.id);
      if (!info) {
        throw new Error('Asset desconocido');
      }
      return info;
    }
  }

  return {
    Query,
    Asset,
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

function makeMetadata(count: number): void {
  for (let index = 0; index < count; index += 1) {
    mockMetadata.push({ id: `media-${index}`, modificationTime: 1_000 + index });
  }
}

beforeEach(() => {
  mockMetadata.length = 0;
  mockAssets.clear();
  mockFailQueries = false;
  mockPageReads = 0;
  mockRepeatFirstPage = false;
  mockFailAssetId = null;
  jest.clearAllMocks();
});

describe('enumerateDeviceAudio (C-02: sin tope silencioso)', () => {
  it('recorre todas las páginas de una biblioteca de 12 000 pistas', async () => {
    makeMetadata(12_000);

    const tracks = await enumerateDeviceAudio();

    expect(tracks).not.toBeNull();
    expect(tracks).toHaveLength(12_000);
    expect(tracks?.[11_999]).toEqual({
      mediaId: 'media-11999',
      modificationTime: 1_000 + 11_999,
    });
    // 12 páginas completas + una vacía que confirma el final.
    expect(mockPageReads).toBe(13);
  });

  it('continúa cuando el total es múltiplo exacto del tamaño de página', async () => {
    makeMetadata(AUDIO_PAGE_SIZE * 2);

    const tracks = await enumerateDeviceAudio();

    expect(tracks).toHaveLength(AUDIO_PAGE_SIZE * 2);
    expect(mockPageReads).toBe(3);
  });

  it('deduplica ids y se detiene si el proveedor ignora el offset', async () => {
    makeMetadata(AUDIO_PAGE_SIZE);
    mockRepeatFirstPage = true;

    const tracks = await enumerateDeviceAudio();

    expect(tracks).toHaveLength(AUDIO_PAGE_SIZE);
    expect(mockPageReads).toBe(2);
    expect(logWarning).toHaveBeenCalled();
  });

  it('devuelve una lista vacía (no null) si no hay audio', async () => {
    const tracks = await enumerateDeviceAudio();

    expect(tracks).toEqual([]);
  });

  it('devuelve null y registra el fallo si la consulta revienta', async () => {
    mockFailQueries = true;

    const tracks = await enumerateDeviceAudio();

    expect(tracks).toBeNull();
    expect(logError).toHaveBeenCalledWith(
      'media-service',
      'query.exeForMetadata',
      expect.any(Error)
    );
  });

  it('conserva una fecha nula para que el diff caiga a escaneo completo', async () => {
    mockMetadata.push({ id: 'sin-fecha', modificationTime: null });

    const tracks = await enumerateDeviceAudio();

    expect(tracks?.[0].modificationTime).toBeNull();
  });
});

describe('listDeviceAudioIds (utilidad liviana)', () => {
  it('deriva los ids de la enumeración completa', async () => {
    makeMetadata(3);

    const ids = await listDeviceAudioIds();

    expect(ids).toEqual(new Set(['media-0', 'media-1', 'media-2']));
  });

  it('devuelve null si la mediateca no se pudo leer', async () => {
    mockFailQueries = true;

    expect(await listDeviceAudioIds()).toBeNull();
  });
});

describe('readDeviceTrack (hidratación de una pista)', () => {
  it('resuelve metadatos, carpeta SAF y duración en segundos', async () => {
    mockAssets.set('content://media/external/audio/media/7', {
      id: 'content://media/external/audio/media/7',
      filename: 'capitulo-01.mp3',
      uri: 'content://com.android.externalstorage.documents/document/primary%3AMusic%2FBook%2Fcapitulo-01.mp3',
      duration: 600_000,
      modificationTime: 1_700_000_000_000,
    });

    const song = await readDeviceTrack({
      mediaId: 'content://media/external/audio/media/7',
      modificationTime: 1_700_000_000_000,
    });

    expect(song).toMatchObject({
      mediaId: 'content://media/external/audio/media/7',
      title: 'capitulo-01',
      folder: 'Book',
      duration: 600,
      artwork: null,
      modificationTime: 1_700_000_000_000,
    });
  });

  it('devuelve null y registra el fallo si el asset ya no existe', async () => {
    mockFailAssetId = 'media-borrada';

    const song = await readDeviceTrack({
      mediaId: 'media-borrada',
      modificationTime: 10,
    });

    expect(song).toBeNull();
    expect(logError).toHaveBeenCalledWith('media-service', 'asset.getInfo', expect.any(Error));
  });
});

describe('folderFromUri (A-07: agrupación con content://)', () => {
  it('extrae la carpeta de un file:// real', () => {
    expect(folderFromUri('file:///storage/emulated/0/Music/Libro/pista.mp3')).toBe('Libro');
  });

  it('extrae la carpeta de un documento SAF codificado', () => {
    expect(
      folderFromUri(
        'content://com.android.externalstorage.documents/document/primary%3AMusic%2FBook%2Fcap01.mp3'
      )
    ).toBe('Book');
  });

  it('ignora la query string antes de resolver la ruta', () => {
    expect(folderFromUri('file:///music/Autor/Libro/pista.mp3?token=abc')).toBe('Libro');
  });

  it('devuelve null para MediaStore y para PHAsset de iOS', () => {
    expect(folderFromUri('content://media/external/audio/media/123')).toBeNull();
    expect(folderFromUri('ph://ABC-123')).toBeNull();
  });

  it('devuelve null cuando el URI no alcanza para deducir carpeta', () => {
    expect(folderFromUri('file:///pista.mp3')).toBeNull();
    expect(folderFromUri('')).toBeNull();
  });
});
