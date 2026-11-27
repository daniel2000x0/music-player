import { extractFlacArtwork } from '@/domain/artwork/flac';
import { extractId3Artwork, parseId3TagSize } from '@/domain/artwork/id3';
import { extractMp4Artwork } from '@/domain/artwork/mp4';
import { logError } from '@/services/error-log.service';
import {
  MAX_ATTEMPTS_PER_ALBUM,
  assignAlbumArtwork,
  isUsableArtworkUri,
  needsArtworkRepair,
  remapArtworkUri,
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
    fileFormat: 'mp3',
    bitDepth: null,
    sampleRate: null,
    bitrate: null,
hasLyrics: false,
lyrics: null,
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
    const cached = 'file:///documents/artwork/media-1.jpg';
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
    expect(uri).toBe('file:///documents/artwork/media_7.jpg');
    expect(__getFile('file:///documents/artwork/media_7.jpg')?.bytes).toEqual(JPEG);
    expect(mockedExtractId3Artwork).toHaveBeenCalledTimes(1);
  });

  it('intenta la extracción embebida en URI content:// aunque no tengan extensión', async () => {
    __seedFile('content://com.android.externalstorage.documents/document/abc', id3File());
    mockedExtractId3Artwork.mockReturnValue({ data: PNG, mime: 'image/png' });

    const uri = await resolveArtworkUri({
      mediaId: 'doc',
      uri: 'content://com.android.externalstorage.documents/document/abc',
    });

    expect(uri).toBe('file:///documents/artwork/doc.png');
    expect(mockedExtractId3Artwork).toHaveBeenCalledTimes(1);
  });

  it('promueve una portada del caché antiguo al almacenamiento persistente', async () => {
    __seedFile('file:///cache/artwork/media-antiguo.jpg', JPEG);

    await expect(
      resolveArtworkUri({
        mediaId: 'media-antiguo',
        uri: 'file:///music/cancion.mp3',
      })
    ).resolves.toBe('file:///documents/artwork/media-antiguo.jpg');
    expect(__getFile('file:///documents/artwork/media-antiguo.jpg')?.bytes).toEqual(JPEG);
    expect(mockedExtractId3Artwork).not.toHaveBeenCalled();
  });

  it('vuelve a extraer una portada cacheada corrupta en vez de servir un cuadro negro', async () => {
    __seedFile(
      'file:///documents/artwork/media-1.jpg',
      new TextEncoder().encode('archivo truncado')
    );
    __seedFile('file:///music/cancion.mp3', id3File());
    mockedExtractId3Artwork.mockReturnValue({ data: JPEG, mime: 'image/jpeg' });

    const uri = await resolveArtworkUri({
      mediaId: 'media-1',
      uri: 'file:///music/cancion.mp3',
    });

    expect(uri).toBe('file:///documents/artwork/media-1.jpg');
    expect(__getFile('file:///documents/artwork/media-1.jpg')?.bytes).toEqual(JPEG);
    expect(mockedExtractId3Artwork).toHaveBeenCalledTimes(1);
  });

  it('recupera una portada antigua guardada con mediaId aunque la fila ya tenga huella', async () => {
    __seedFile('file:///documents/artwork/media-antiguo.jpg', JPEG);

    await expect(
      resolveArtworkUri({
        mediaId: 'media-antiguo',
        uri: 'file:///music/cancion.mp3',
        contentKey: 'huella-v12',
      })
    ).resolves.toBe('file:///documents/artwork/media-antiguo.jpg');
    expect(mockedExtractId3Artwork).not.toHaveBeenCalled();
  });

  it('retira el duplicado vacío del caché al escribir una portada persistente', async () => {
    __seedFile('file:///music/cancion.mp3', id3File());
    __seedFile('file:///cache/artwork/media-1.jpg', new Uint8Array(0));
    mockedExtractId3Artwork.mockReturnValue({ data: JPEG, mime: 'image/jpeg' });

    await expect(
      resolveArtworkUri({ mediaId: 'media-1', uri: 'file:///music/cancion.mp3' })
    ).resolves.toBe('file:///documents/artwork/media-1.jpg');
    expect(__getFile('file:///cache/artwork/media-1.jpg')?.exists).toBeFalsy();
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
    expect(__getFile('file:///documents/artwork/media-1.jpg')?.exists).toBeFalsy();
  });

  it('no busca en carpetas para URI content://', async () => {
    __seedFile('content://media/external/audio/media/7', plainFile());

    await expect(
      resolveArtworkUri({ mediaId: 'media-7', uri: 'content://media/external/audio/media/7' })
    ).resolves.toBeNull();
  });
});

describe('needsArtworkRepair', () => {
  it('detecta URIs que aún apuntan al caché antiguo', () => {
    expect(needsArtworkRepair('file:///cache/artwork/media-1.jpg')).toBe(true);
  });

  it('detecta una URI persistente cuyo archivo desapareció', () => {
    expect(needsArtworkRepair('file:///documents/artwork/media-1.jpg')).toBe(true);
  });

  it('respeta portadas persistentes y de carpeta que siguen existiendo', () => {
    __seedFile('file:///documents/artwork/media-1.jpg', JPEG);
    __seedFile('file:///music/album/cover.jpg', JPEG);

    expect(needsArtworkRepair('file:///documents/artwork/media-1.jpg')).toBe(false);
    expect(needsArtworkRepair('file:///music/album/cover.jpg')).toBe(false);
  });

  it('detecta una portada de carpeta que se quedó en la ubicación antigua', () => {
    expect(needsArtworkRepair('file:///music/antiguo/cover.jpg')).toBe(true);
  });

  it('no marca los URI content:// aunque el archivo no sea visible como File', () => {
    expect(needsArtworkRepair('content://media/external/audio/media/7')).toBe(false);
  });
});

describe('isUsableArtworkUri', () => {
  it('rechaza una URI cuyo archivo no existe', async () => {
    await expect(isUsableArtworkUri('file:///documents/artwork/inexistente.jpg')).resolves.toBe(
      false
    );
  });

  it('rechaza un archivo con bytes que no son una imagen', async () => {
    __seedFile('file:///documents/artwork/corrupto.jpg', new TextEncoder().encode('no imagen'));

    await expect(isUsableArtworkUri('file:///documents/artwork/corrupto.jpg')).resolves.toBe(false);
  });

  it('acepta una imagen válida y deja pasar los content://', async () => {
    __seedFile('file:///music/album/cover.jpg', JPEG);

    await expect(isUsableArtworkUri('file:///music/album/cover.jpg')).resolves.toBe(true);
    await expect(isUsableArtworkUri('content://media/external/audio/media/7')).resolves.toBe(true);
  });
});

describe('resolveAlbumArtwork', () => {
  it('para en cuanto una pista resuelve portada', async () => {
    __seedFile('file:///music/album/1.mp3', plainFile());
    __seedFile('file:///documents/artwork/segunda.jpg', JPEG);

    const uri = await resolveAlbumArtwork([
      { mediaId: 'primera', uri: 'file:///music/album/1.mp3' },
      { mediaId: 'segunda', uri: 'file:///music/album/2.mp3' },
      { mediaId: 'tercera', uri: 'file:///music/album/3.mp3' },
    ]);

    expect(uri).toBe('file:///documents/artwork/segunda.jpg');
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
    __seedFile('file:///documents/artwork/buena.jpg', JPEG);
    mockedExtractId3Artwork.mockImplementationOnce(() => {
      throw new Error('tag ilegible');
    });

    const uri = await resolveAlbumArtwork([
      { mediaId: 'rota', uri: 'file:///music/album/rota.mp3' },
      { mediaId: 'buena', uri: 'file:///music/album/buena.mp3' },
    ]);

    expect(uri).toBe('file:///documents/artwork/buena.jpg');
    expect(mockedLogError).toHaveBeenCalledWith(
      'artwork-service',
      'readEmbeddedArtwork',
      expect.any(Error)
    );
  });
});

describe('assignAlbumArtwork', () => {
  it('propaga un arte por álbum y artista a todas las pistas del grupo', async () => {
    __seedFile('file:///documents/artwork/con-arte.jpg', JPEG);
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
      'file:///documents/artwork/con-arte.jpg',
      'file:///documents/artwork/con-arte.jpg',
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
    ).resolves.toBe('file:///documents/artwork/mp4-1.jpg');
    expect(mockedExtractMp4Artwork).toHaveBeenCalledTimes(1);
  });

  it('usa el extractor FLAC cuando el archivo empieza por fLaC', async () => {
    __seedFile('file:///music/cancion.flac', new TextEncoder().encode('fLaCxxxx'));
    mockedExtractFlacArtwork.mockResolvedValueOnce({ data: PNG, mime: 'image/png' });

    await expect(
      resolveArtworkUri({ mediaId: 'flac-1', uri: 'file:///music/cancion.flac' })
    ).resolves.toBe('file:///documents/artwork/flac-1.png');
    expect(mockedExtractFlacArtwork).toHaveBeenCalledTimes(1);
  });
});

describe('remapArtworkUri', () => {
  const params = {
    oldUri: 'file:///documents/artwork/media-viejo.jpg',
    nextMediaId: 'media-nuevo',
    nextUri: 'file:///music/nuevo/cancion.mp3',
    nextContentKey: 'huella-nueva',
  };

  it('renombra el arte persistido a la huella nueva y borra el original', async () => {
    __seedFile(params.oldUri, JPEG);

    await expect(remapArtworkUri(params)).resolves.toBe(
      'file:///documents/artwork/huella-nueva.jpg'
    );
    expect(__getFile('file:///documents/artwork/huella-nueva.jpg')?.bytes).toEqual(JPEG);
    expect(__getFile(params.oldUri)?.exists).toBe(false);
  });

  it('usa el mediaId como clave si la pista aún no tiene huella', async () => {
    __seedFile(params.oldUri, PNG);

    await expect(remapArtworkUri({ ...params, nextContentKey: null })).resolves.toBe(
      'file:///documents/artwork/media-nuevo.jpg'
    );
  });

  it('no hace nada si la portada ya está en la clave destino', async () => {
    const target = 'file:///documents/artwork/huella-nueva.jpg';
    __seedFile(target, JPEG);

    await expect(remapArtworkUri({ ...params, oldUri: target })).resolves.toBe(target);
  });

  it('devuelve null si el archivo gestionado ya no existe', async () => {
    await expect(remapArtworkUri(params)).resolves.toBeNull();
  });

  it('devuelve null si no había portada', async () => {
    await expect(remapArtworkUri({ ...params, oldUri: null })).resolves.toBeNull();
  });

  it('busca de nuevo el cover.jpg junto a la nueva ruta', async () => {
    __seedFile('file:///music/nuevo/cover.jpg', JPEG);

    await expect(
      remapArtworkUri({
        ...params,
        oldUri: 'file:///music/antiguo/cover.jpg',
      })
    ).resolves.toBe('file:///music/nuevo/cover.jpg');
  });

  it('devuelve null si la portada de carpeta ya no se puede buscar', async () => {
    await expect(
      remapArtworkUri({ ...params, oldUri: 'file:///music/antiguo/cover.jpg' })
    ).resolves.toBeNull();
  });

  it('devuelve null si la extensión gestionada no es de imagen', async () => {
    __seedFile('file:///documents/artwork/media-viejo.txt', JPEG);

    await expect(
      remapArtworkUri({ ...params, oldUri: 'file:///documents/artwork/media-viejo.txt' })
    ).resolves.toBeNull();
  });

  it('devuelve null si falla la copia del archivo gestionado', async () => {
    __seedFile(params.oldUri, JPEG);
    const copy = jest
      .spyOn(FakeFile.prototype, 'copy')
      .mockRejectedValueOnce(new Error('sin espacio'));

    await expect(remapArtworkUri(params)).resolves.toBeNull();
    expect(mockedLogError).toHaveBeenCalledWith(
      'artwork-service',
      'remap-cache',
      expect.any(Error)
    );
    copy.mockRestore();
  });
});
