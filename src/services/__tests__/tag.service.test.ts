import { ascii } from '@/domain/artwork/bytes';
import { extractId3Tags, parseId3TagSize } from '@/domain/artwork/id3';
import { extractMp4Tags } from '@/domain/artwork/mp4';
import { extractFlacTags } from '@/domain/artwork/flac';
import { readAudioTags } from '@/services/tag.service';
import { FakeFile, __reset, __seedFile } from '@/testing/mocks/expo-file-system';
import type { AudioTags } from '@/domain/metadata';

/**
 * Lectura de etiquetas de texto (`FASE 7`).
 *
 * Los parsers de dominio se sustituyen por dobles para comprobar QUÉ bytes
 * reciben (el tag ID3 recortado, los offsets del reader MP4/FLAC) sin depender
 * de archivos reales. El sistema de archivos es el doble en memoria ya
 * disponible en `src/testing/mocks`, sembrado con firmas binarias reales.
 */

jest.mock('expo-file-system', () => {
  const fake = jest.requireActual<typeof import('@/testing/mocks/expo-file-system')>(
    '@/testing/mocks/expo-file-system'
  );
  // El doble exporta FakeFile/FakeDirectory; el servicio importa File/Directory.
  return { ...fake, File: fake.FakeFile, Directory: fake.FakeDirectory };
});

jest.mock('@/domain/artwork/id3', () => ({
  extractId3Tags: jest.fn(),
  parseId3TagSize: jest.fn(),
}));

jest.mock('@/domain/artwork/mp4', () => ({
  extractMp4Tags: jest.fn(),
}));

jest.mock('@/domain/artwork/flac', () => ({
  extractFlacTags: jest.fn(),
}));

const mockedExtractId3Tags = jest.mocked(extractId3Tags);
const mockedParseId3TagSize = jest.mocked(parseId3TagSize);
const mockedExtractMp4Tags = jest.mocked(extractMp4Tags);
const mockedExtractFlacTags = jest.mocked(extractFlacTags);

const TAGS: AudioTags = {
  title: 'Título',
  artist: 'Artista',
  album: 'Álbum',
  albumArtist: null,
  track: 3,
  bitDepth: null,
  sampleRate: null,
  bitrate: null,
};

/** Cabecera ID3v2 de 14 bytes; el tamaño real lo decide el doble del parser. */
function id3Header(): Uint8Array {
  return Uint8Array.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0]);
}

/** Archivo con firma ID3 y el tamaño pedido (para probar el techo de lectura). */
function id3File(total: number): Uint8Array {
  const data = new Uint8Array(total);
  data.set(id3Header().subarray(0, 10));
  return data;
}

/** Contenedor MP4 mínimo con `ftyp` en [4..8) y un átomo `moov` en 40. */
function mp4Header(): Uint8Array {
  const data = new Uint8Array(64);
  data.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  data.set([0x6d, 0x6f, 0x6f, 0x76], 40);
  return data;
}

/** Cabecera FLAC con firma `fLaC` y una marca de prueba en el offset 20. */
function flacHeader(): Uint8Array {
  const data = new Uint8Array(48);
  data.set([0x66, 0x4c, 0x61, 0x43]);
  data.set([0x76, 0x6f, 0x72, 0x62], 20);
  return data;
}

beforeEach(() => {
  __reset();
  jest.clearAllMocks();
  mockedParseId3TagSize.mockReturnValue(512);
  mockedExtractId3Tags.mockReturnValue(TAGS);
  mockedExtractMp4Tags.mockResolvedValue(TAGS);
  mockedExtractFlacTags.mockResolvedValue(TAGS);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('readAudioTags: filtro de contenedores', () => {
  it('devuelve null sin leer el archivo si la extensión no es soportada', async () => {
    __seedFile('file:///music/pista.ogg', id3Header());

    await expect(readAudioTags('file:///music/pista.ogg')).resolves.toBeNull();
    await expect(readAudioTags('file:///music/sin-extension')).resolves.toBeNull();
    expect(mockedExtractId3Tags).not.toHaveBeenCalled();
    expect(mockedExtractMp4Tags).not.toHaveBeenCalled();
    expect(mockedExtractFlacTags).not.toHaveBeenCalled();
  });

  it('acepta URI content:// aunque no tengan extensión conocida', async () => {
    __seedFile('content://media/external/audio/media/9', id3Header());

    await expect(readAudioTags('content://media/external/audio/media/9')).resolves.toEqual(TAGS);
    expect(mockedExtractId3Tags).toHaveBeenCalledTimes(1);
  });

  it('devuelve null para un archivo inexistente o vacío', async () => {
    await expect(readAudioTags('file:///music/inexistente.mp3')).resolves.toBeNull();
    __seedFile('file:///music/vacio.flac', new Uint8Array(0));

    await expect(readAudioTags('file:///music/vacio.flac')).resolves.toBeNull();
    expect(mockedParseId3TagSize).not.toHaveBeenCalled();
  });

  it('devuelve null si la firma no es ID3, ftyp ni fLaC', async () => {
    __seedFile('file:///music/raro.mp3', new TextEncoder().encode('RIFFxxxxXXXX'));

    await expect(readAudioTags('file:///music/raro.mp3')).resolves.toBeNull();
    expect(mockedExtractId3Tags).not.toHaveBeenCalled();
    expect(mockedExtractMp4Tags).not.toHaveBeenCalled();
    expect(mockedExtractFlacTags).not.toHaveBeenCalled();
  });

  it('devuelve null si el tag ID3 declara un tamaño inválido', async () => {
    __seedFile('file:///music/corrupt.mp3', id3Header());
    mockedParseId3TagSize.mockReturnValueOnce(null);

    await expect(readAudioTags('file:///music/corrupt.mp3')).resolves.toBeNull();
    expect(mockedExtractId3Tags).not.toHaveBeenCalled();
  });
});

describe('readAudioTags: ID3', () => {
  it('entrega a extractId3Tags el tag completo (header + body)', async () => {
    __seedFile('file:///music/cancion.mp3', id3File(10 + 512));

    await expect(readAudioTags('file:///music/cancion.mp3')).resolves.toEqual(TAGS);

    expect(mockedExtractId3Tags).toHaveBeenCalledTimes(1);
    const tag = mockedExtractId3Tags.mock.calls[0][0];
    // La cabecera de 12 bytes se leyó para detectar la firma; se rebobina y se
    // vuelve a leer desde 0 para que el parser reciba el tag ID3 completo.
    expect(tag).toHaveLength(522);
  });

  it('recorta el tag al techo de 2 MiB aunque el archivo anuncie más', async () => {
    const maxBytes = 2 * 1024 * 1024;
    __seedFile('file:///music/enorme.mp3', id3File(maxBytes + 12));
    mockedParseId3TagSize.mockReturnValueOnce(3 * 1024 * 1024);

    await expect(readAudioTags('file:///music/enorme.mp3')).resolves.toEqual(TAGS);

    const tag = mockedExtractId3Tags.mock.calls[0][0];
    expect(tag).toHaveLength(maxBytes);
    expect(ascii(tag, 0, 3)).toBe('ID3');
  });
});

describe('readAudioTags: reader por offsets (MP4 y FLAC)', () => {
  it('pasa a extractMp4Tags un reader que respeta los offsets y el tamaño', async () => {
    __seedFile('file:///music/cancion.m4a', mp4Header());
    mockedExtractMp4Tags.mockImplementationOnce(async (reader, size) => {
      expect(size).toBe(64);
      const atom = await reader(40, 4);
      expect(atom).not.toBeNull();
      expect(ascii(atom as Uint8Array, 0, 4)).toBe('moov');
      return TAGS;
    });

    await expect(readAudioTags('file:///music/cancion.m4a')).resolves.toEqual(TAGS);
    expect(mockedExtractMp4Tags).toHaveBeenCalledTimes(1);
  });

  it('pasa a extractFlacTags un reader que respeta los offsets y el tamaño', async () => {
    __seedFile('file:///music/cancion.flac', flacHeader());
    mockedExtractFlacTags.mockImplementationOnce(async (reader, size) => {
      expect(size).toBe(48);
      const block = await reader(20, 4);
      expect(block).not.toBeNull();
      expect(ascii(block as Uint8Array, 0, 4)).toBe('vorb');
      return TAGS;
    });

    await expect(readAudioTags('file:///music/cancion.flac')).resolves.toEqual(TAGS);
    expect(mockedExtractFlacTags).toHaveBeenCalledTimes(1);
  });
});

describe('readAudioTags: degradación ante fallos', () => {
  it('devuelve null sin lanzar si falla la apertura del archivo', async () => {
    __seedFile('file:///music/bloqueado.mp3', id3Header());
    const open = jest.spyOn(FakeFile.prototype, 'open').mockImplementation(() => {
      throw new Error('archivo bloqueado');
    });

    await expect(readAudioTags('file:///music/bloqueado.mp3')).resolves.toBeNull();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('devuelve null sin lanzar si el parser lanza', async () => {
    __seedFile('file:///music/roto.mp3', id3Header());
    mockedExtractId3Tags.mockImplementationOnce(() => {
      throw new Error('tag corrupto');
    });

    await expect(readAudioTags('file:///music/roto.mp3')).resolves.toBeNull();
  });
});
