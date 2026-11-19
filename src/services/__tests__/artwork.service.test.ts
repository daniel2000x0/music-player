import { extractFlacArtwork } from '@/domain/artwork/flac';
import { extractId3Artwork, parseId3TagSize } from '@/domain/artwork/id3';
import { extractMp4Artwork } from '@/domain/artwork/mp4';
import { logError } from '@/services/error-log.service';
import {
  MAX_ATTEMPTS_PER_ALBUM,
  assignAlbumArtwork,
  resolveAlbumArtwork,
  resolveArtworkUri,
} from '@/services/artwork.service';
import { FakeFile, __getFile, __reset, __seedFile } from '@/testing/mocks/expo-file-system';
import type { ScannedSong } from '@/types/song';

/**
 * Carátulas de álbum (`FASE 7`).
 *
 * El sistema de archivos es el doble en memoria: permite sembrar ejercicios con
 * firmas JPEG reales y comprobar que la caché se escribe con el nombre esperado.
 * Los extractores de dominio se mockean para aislar la decisión del servicio
 * (caché → embebido → carpeta) de la decodificación binaria.
 */

jest.mock('expo-file-system', () => {
  const fake = jest.requireActual<typeof import('@/testing/mocks/expo-file-system')>(
    '@/testing/mocks/expo-file-system'
  );
  // El doble exporta FakeFile/FakeDirectory; el servicio importa File/Directory.
  return { ...fake, File: fake.FakeFile, Directory: fake.FakeDirectory };
});

jest.mock('@/domain/artwork/id3', () => ({
  extractId3Artwork: jest.fn(),
  parseId3TagSize: jest.fn(),
}));

jest.mock('@/domain/artwork/mp4', () => ({
  extractMp4Artwork: jest.fn(),
}));

jest.mock('@/domain/artwork/flac', () => ({
  extractFlacArtwork: jest.fn(),
}));

jest.mock('@/services/error-log.service', () => ({
  logError: jest.fn(),
}));

const mockedExtractId3Artwork = jest.mocked(extractId3Artwork);
const mockedParseId3TagSize = jest.mocked(parseId3TagSize);
const mockedExtractMp4Artwork = jest.mocked(extractMp4Artwork);
const mockedExtractFlacArtwork = jest.mocked(extractFlacArtwork);
const mockedLogError = jest.mocked(logError);

/** Firma JPEG mínima; `sniffArtworkMime` solo necesita FF D8 FF. */
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** ID3 con 512 bytes de body; el tamaño lo fija el doble del parser. */
function id3File(): Uint8Array {
  const data = new Uint8Array(10 + 512);
  data.set([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 2, 0]);
  return data;
}

/** Pista sin firma reconocible: no dispara ningún extractor embebido. */
function plainFile(): Uint8Array {
  return new TextEncoder().encode('contenido sin etiquetas ID3');
}

function scanned(
  mediaId: string,
  album: string,
  artist: string,
  uri = `file:///music/${mediaId}.mp3`
): ScannedSong {
  return {
    mediaId,
    uri,
    title: mediaId,
    artist,
    album,
    track: null,
    folder: null,
    duration: 120,
    artwork: null,
    modificationTime: 1_000,
  };
}

beforeEach(() => {
  __reset();
  jest.clearAllMocks();
  mockedParseId3TagSize.mockReturnValue(512);
  mockedExtractId3Artwork.mockReturnValue(null);
  mockedExtractMp4Artwork.mockResolvedValue(null);
  mockedExtractFlacArtwork.mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('resolveArtworkUri: caché y arte embebido', () => {
  it('reutiliza una portada ya cacheada sin volver a leer el audio', async () => {
    const cached = 'file:///cache/artwork/media-1.jpg';
    __seedFile(cached, JPEG);
    __seedFile('file:///music/cancion.mp3', id3File());

    await expect(
      resolveArtworkUri({ mediaId: 'media-1', uri: 'file:///music/cancion.mp3' })
    ).resolves.toBe(cached);
    expect(mockedExtractId3Artwork).not.toHaveBeenCalled();
  });

  it('extrae el arte embebido y lo escribe en la caché con la extensión del MIME', async () => {
    __seedFile('file:///music/cancion.mp3', id3File());
    mockedExtractId3Artwork.mockReturnValue({ data: JPEG, mime: 'image/jpeg' });

    const uri = await resolveArtworkUri({
      mediaId: 'media/7',
      uri: 'file:///music/cancion.mp3',
    });

    // El identificador se sanea antes de usarse como nombre de archivo.
    expect(uri).toBe('file:///cache/artwork/media_7.jpg');
    expect(__getFile('file:///cache/artwork/media_7.jpg')?.bytes).toEqual(JPEG);
    expect(mockedExtractId3Artwork).toHaveBeenCalledTimes(1);
  });

  it('intenta la extracción embebida en URI content:// aunque no tengan extensión', async () => {
    __seedFile('content://com.android.externalstorage.documents/document/abc', id3File());
    mockedExtractId3Artwork.mockReturnValue({ data: PNG, mime: 'image/png' });

    const uri = await resolveArtworkUri({
      mediaId: 'doc',
      uri: 'content://com.android.externalstorage.documents/document/abc',
    });

    expect(uri).toBe('file:///cache/artwork/doc.png');
    expect(mockedExtractId3Artwork).toHaveBeenCalledTimes(1);
  });

  it('degrada a logError y al respaldo de carpeta si falla la escritura en caché', async () => {
    __seedFile('file:///music/cancion.mp3', id3File());
    __seedFile('file:///music/cover.jpg', JPEG);
    mockedExtractId3Artwork.mockReturnValue({ data: JPEG, mime: 'image/jpeg' });
    jest.spyOn(FakeFile.prototype, 'write').mockRejectedValueOnce(new Error('disco lleno'));

    const uri = await resolveArtworkUri({
      mediaId: 'media-1',
      uri: 'file:///music/cancion.mp3',
    });

    expect(uri).toBe('file:///music/cover.jpg');
    expect(mockedLogError).toHaveBeenCalledWith(
      'artwork-service',
      'write-cache',
      expect.any(Error)
    );
  });
});

describe('resolveArtworkUri: respaldo de carpeta', () => {
  it('devuelve cover.jpg junto al archivo cuando tiene firma de imagen válida', async () => {
    __seedFile('file:///music/album/cancion.mp3', plainFile());
    __seedFile('file:///music/album/cover.jpg', JPEG);

    await expect(
      resolveArtworkUri({
        mediaId: 'media-1',
        uri: 'file:///music/album/cancion.mp3',
      })
    ).resolves.toBe('file:///music/album/cover.jpg');
  });

  it('descarta un cover.jpg con firma inválida', async () => {
    __seedFile('file:///music/album/cancion.mp3', plainFile());
    __seedFile('file:///music/album/cover.jpg', new TextEncoder().encode('no soy una imagen'));

    await expect(
      resolveArtworkUri({
        mediaId: 'media-1',
        uri: 'file:///music/album/cancion.mp3',
      })
    ).resolves.toBeNull();
    expect(__getFile('file:///cache/artwork/media-1.jpg')?.exists).toBeFalsy();
  });

  it('no busca en carpetas para URI content://', async () => {
    __seedFile('content://media/external/audio/media/7', plainFile());

    await expect(
      resolveArtworkUri({ mediaId: 'media-7', uri: 'content://media/external/audio/media/7' })
    ).resolves.toBeNull();
  });
});

describe('resolveAlbumArtwork', () => {
  it('para en cuanto una pista resuelve portada', async () => {
    __seedFile('file:///music/album/1.mp3', plainFile());
    __seedFile('file:///cache/artwork/segunda.jpg', JPEG);

    const uri = await resolveAlbumArtwork([
      { mediaId: 'primera', uri: 'file:///music/album/1.mp3' },
      { mediaId: 'segunda', uri: 'file:///music/album/2.mp3' },
      { mediaId: 'tercera', uri: 'file:///music/album/3.mp3' },
    ]);

    expect(uri).toBe('file:///cache/artwork/segunda.jpg');
    expect(mockedExtractId3Artwork).not.toHaveBeenCalled();
  });

  it('prueba como máximo MAX_ATTEMPTS_PER_ALBUM pistas', async () => {
    const songs = Array.from({ length: MAX_ATTEMPTS_PER_ALBUM + 2 }, (_, index) => ({
      mediaId: `media-${index}`,
      uri: `file:///music/album/${index}.mp3`,
    }));
    songs.forEach((song) => __seedFile(song.uri, id3File()));

    await expect(resolveAlbumArtwork(songs)).resolves.toBeNull();
    expect(mockedExtractId3Artwork).toHaveBeenCalledTimes(MAX_ATTEMPTS_PER_ALBUM);
  });

  it('sigue con la pista siguiente si una pista falla al extraer', async () => {
    __seedFile('file:///music/album/rota.mp3', id3File());
    __seedFile('file:///cache/artwork/buena.jpg', JPEG);
    mockedExtractId3Artwork.mockImplementationOnce(() => {
      throw new Error('tag ilegible');
    });

    const uri = await resolveAlbumArtwork([
      { mediaId: 'rota', uri: 'file:///music/album/rota.mp3' },
      { mediaId: 'buena', uri: 'file:///music/album/buena.mp3' },
    ]);

    expect(uri).toBe('file:///cache/artwork/buena.jpg');
    expect(mockedLogError).toHaveBeenCalledWith(
      'artwork-service',
      'readEmbeddedArtwork',
      expect.any(Error)
    );
  });
});

describe('assignAlbumArtwork', () => {
  it('propaga un arte por álbum y artista a todas las pistas del grupo', async () => {
    __seedFile('file:///cache/artwork/con-arte.jpg', JPEG);
    __seedFile('file:///music/sin-arte.mp3', plainFile());
    // Los grupos sin caché sí tienen firma ID3: se extrae una sola vez por grupo.
    __seedFile('file:///music/otro-artista.mp3', id3File());
    __seedFile('file:///music/otro-album.mp3', id3File());

    const songs = [
      scanned('con-arte', 'Disco', 'Banda'),
      scanned('sin-arte', 'Disco', 'Banda'),
      scanned('otro-artista', 'Disco', 'Otra banda'),
      scanned('otro-album', 'Otro disco', 'Banda'),
    ];

    await assignAlbumArtwork(songs);

    expect(songs.map((song) => song.artwork)).toEqual([
      'file:///cache/artwork/con-arte.jpg',
      'file:///cache/artwork/con-arte.jpg',
      null,
      null,
    ]);
    // Solo se extrajo una vez por grupo: los grupos sin caché no tienen arte.
    expect(mockedExtractId3Artwork).toHaveBeenCalledTimes(2);
  });

  it('no hace nada con una lista vacía', async () => {
    await expect(assignAlbumArtwork([])).resolves.toBeUndefined();
    expect(mockedExtractId3Artwork).not.toHaveBeenCalled();
  });
});

describe('extractores de otros contenedores', () => {
  it('usa el extractor MP4 cuando el archivo trae el átomo ftyp', async () => {
    const data = new Uint8Array(64);
    data.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    __seedFile('file:///music/cancion.m4a', data);
    mockedExtractMp4Artwork.mockResolvedValueOnce({ data: JPEG, mime: 'image/jpeg' });

    await expect(
      resolveArtworkUri({ mediaId: 'mp4-1', uri: 'file:///music/cancion.m4a' })
    ).resolves.toBe('file:///cache/artwork/mp4-1.jpg');
    expect(mockedExtractMp4Artwork).toHaveBeenCalledTimes(1);
  });

  it('usa el extractor FLAC cuando el archivo empieza por fLaC', async () => {
    __seedFile('file:///music/cancion.flac', new TextEncoder().encode('fLaCxxxx'));
    mockedExtractFlacArtwork.mockResolvedValueOnce({ data: PNG, mime: 'image/png' });

    await expect(
      resolveArtworkUri({ mediaId: 'flac-1', uri: 'file:///music/cancion.flac' })
    ).resolves.toBe('file:///cache/artwork/flac-1.png');
    expect(mockedExtractFlacArtwork).toHaveBeenCalledTimes(1);
  });
});
