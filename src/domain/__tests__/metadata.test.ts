import {
  decodeLatin1,
  decodeUtf16,
  decodeUtf8,
  looksLikeChapter,
  parseFilename,
  parseTrackNumber,
  resolveSongMetadata,
  UNKNOWN_ALBUM,
  UNKNOWN_ARTIST,
} from '@/domain/metadata';

describe('parseFilename', () => {
  it('separa el número de pista del título', () => {
    expect(parseFilename('01 - El Hobbit.mp3')).toEqual({
      title: 'El Hobbit',
      artist: null,
      track: 1,
    });
    expect(parseFilename('07. Capítulo final.m4b')).toEqual({
      title: 'Capítulo final',
      artist: null,
      track: 7,
    });
  });

  it('interpreta "Artista - Título"', () => {
    expect(parseFilename('Sabina - Y nos dieron las diez.mp3')).toEqual({
      title: 'Y nos dieron las diez',
      artist: 'Sabina',
      track: null,
    });
  });

  it('conserva los guiones internos del título', () => {
    expect(parseFilename('Banda - Canción - En vivo.mp3')).toEqual({
      title: 'Canción - En vivo',
      artist: 'Banda',
      track: null,
    });
  });

  it('limpia guiones bajos y no inventa artista sin separador', () => {
    expect(parseFilename('mi_cancion_favorita.mp3')).toEqual({
      title: 'mi cancion favorita',
      artist: null,
      track: null,
    });
    expect(parseFilename('Track 01.mp3')).toEqual({
      title: 'Track 01',
      artist: null,
      track: null,
    });
  });
});

describe('resolveSongMetadata', () => {
  const tags = {
    title: 'El Hobbit',
    artist: 'J. R. R. Tolkien',
    album: 'El Hobbit (Audiolibro)',
    albumArtist: null,
    track: 3,
  };

  it('prioriza las etiquetas sobre el nombre de archivo', () => {
    expect(
      resolveSongMetadata({ filename: '01 - pista.mp3', folder: 'Download', tags })
    ).toEqual({
      title: 'El Hobbit',
      artist: 'J. R. R. Tolkien',
      album: 'El Hobbit (Audiolibro)',
      track: 3,
    });
  });

  it('usa el prefijo como libro cuando el título parece capítulo', () => {
    expect(
      resolveSongMetadata({
        filename: 'El Hobbit - Capítulo 3.mp3',
        folder: 'Download',
        tags: null,
      })
    ).toEqual({
      title: 'Capítulo 3',
      artist: UNKNOWN_ARTIST,
      album: 'El Hobbit',
      track: null,
    });
  });

  it('usa la carpeta como álbum cuando no es genérica', () => {
    expect(
      resolveSongMetadata({ filename: 'canción.mp3', folder: 'Abbey Road', tags: null })
    ).toEqual({
      title: 'canción',
      artist: UNKNOWN_ARTIST,
      album: 'Abbey Road',
      track: null,
    });
  });

  it('ignora carpetas genéricas como Download o Music', () => {
    expect(
      resolveSongMetadata({ filename: 'canción.mp3', folder: 'Download', tags: null }).album
    ).toBe(UNKNOWN_ALBUM);
    expect(
      resolveSongMetadata({ filename: 'canción.mp3', folder: 'Music', tags: null }).album
    ).toBe(UNKNOWN_ALBUM);
  });

  it('usa el artista de álbum si falta el artista principal', () => {
    expect(
      resolveSongMetadata({
        filename: 'pista.mp3',
        folder: null,
        tags: { ...tags, artist: null, albumArtist: 'Tolkien' },
      }).artist
    ).toBe('Tolkien');
  });

  it('toma el número de pista del nombre si el tag no lo trae', () => {
    expect(
      resolveSongMetadata({
        filename: '05 - Título.mp3',
        folder: null,
        tags: { ...tags, track: null },
      }).track
    ).toBe(5);
  });
});

describe('looksLikeChapter', () => {
  it('reconoce capítulos y pistas numeradas', () => {
    expect(looksLikeChapter('Capítulo 4')).toBe(true);
    expect(looksLikeChapter('Chapter 12')).toBe(true);
    expect(looksLikeChapter('Parte 2')).toBe(true);
    expect(looksLikeChapter('07')).toBe(true);
    expect(looksLikeChapter('La huida')).toBe(false);
  });
});

describe('decodificación de texto', () => {
  it('decodifica UTF-8 con acentos', () => {
    const bytes = new Uint8Array([0x43, 0x61, 0x6e, 0x63, 0x69, 0xc3, 0xb3, 0x6e]);
    expect(decodeUtf8(bytes)).toBe('Canción');
  });

  it('decodifica UTF-16 little-endian con BOM', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x48, 0x00, 0x69, 0x00]);
    expect(decodeUtf16(bytes)).toBe('Hi');
  });

  it('decodifica UTF-16 big-endian sin BOM', () => {
    const bytes = new Uint8Array([0x00, 0x48, 0x00, 0x69]);
    expect(decodeUtf16(bytes, 0, bytes.length, true)).toBe('Hi');
  });

  it('decodifica latin-1', () => {
    expect(decodeLatin1(new Uint8Array([0x4a, 0x6f, 0x73, 0xe9]))).toBe('José');
  });

  it('extrae el número de pista de "3/12"', () => {
    expect(parseTrackNumber('3/12')).toBe(3);
    expect(parseTrackNumber('')).toBeNull();
  });
});
