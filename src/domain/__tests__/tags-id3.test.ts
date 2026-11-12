import { extractId3Tags } from '@/domain/artwork/id3';
import { ascii, syncsafe } from '@/domain/artwork/bytes';

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function str(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    out[i] = value.charCodeAt(i) & 0xff;
  }
  return out;
}

function utf8(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

function utf16le(value: string): Uint8Array {
  const bytes: number[] = [0xff, 0xfe];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    bytes.push(code & 0xff, code >> 8);
  }
  return new Uint8Array(bytes);
}

function u32be(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function syncsafeBytes(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 21) & 0x7f,
    (value >>> 14) & 0x7f,
    (value >>> 7) & 0x7f,
    value & 0x7f,
  ]);
}

function id3Tag(version: 2 | 3 | 4, ...frames: Uint8Array[]): Uint8Array {
  const body = concat(...frames);
  const header = new Uint8Array(10);
  header.set(str('ID3'), 0);
  header[3] = version;
  header.set(syncsafeBytes(body.length), 6);
  return concat(header, body);
}

function id3Frame(version: 2 | 3 | 4, id: string, data: Uint8Array): Uint8Array {
  if (version === 2) {
    const header = new Uint8Array(6);
    header.set(str(id.slice(0, 3)), 0);
    header.set(u32be(data.length).slice(1), 3);
    return concat(header, data);
  }
  const header = new Uint8Array(10);
  header.set(str(id), 0);
  header.set(version === 4 ? syncsafeBytes(data.length) : u32be(data.length), 4);
  return concat(header, data);
}

/** Payload de un frame de texto: byte de encoding + bytes del texto. */
function textFrame(
  version: 2 | 3 | 4,
  id: string,
  encoding: 0 | 1 | 3,
  value: string
): Uint8Array {
  const encoded = encoding === 1 ? utf16le(value) : encoding === 3 ? utf8(value) : str(value);
  return id3Frame(version, id, concat(new Uint8Array([encoding]), encoded));
}

describe('extractId3Tags', () => {
  it('lee título, artista, álbum, artista de álbum y pista en v2.3', () => {
    const tag = id3Tag(
      3,
      textFrame(3, 'TIT2', 0, 'El Hobbit'),
      textFrame(3, 'TPE1', 0, 'J. R. R. Tolkien'),
      textFrame(3, 'TALB', 0, 'El Hobbit (Audiolibro)'),
      textFrame(3, 'TPE2', 0, 'Tolkien'),
      textFrame(3, 'TRCK', 0, '3/12')
    );

    expect(extractId3Tags(tag)).toEqual({
      title: 'El Hobbit',
      artist: 'J. R. R. Tolkien',
      album: 'El Hobbit (Audiolibro)',
      albumArtist: 'Tolkien',
      track: 3,
    });
  });

  it('decodifica UTF-8 en v2.4', () => {
    const tag = id3Tag(4, textFrame(4, 'TIT2', 3, 'Canción de cuna'));
    expect(extractId3Tags(tag)?.title).toBe('Canción de cuna');
  });

  it('decodifica UTF-16 con BOM', () => {
    const tag = id3Tag(3, textFrame(3, 'TPE1', 1, 'José Larralde'));
    expect(extractId3Tags(tag)?.artist).toBe('José Larralde');
  });

  it('lee los frames de v2.2 (TT2/TP1/TAL/TRK)', () => {
    const tag = id3Tag(
      2,
      textFrame(2, 'TT2', 0, 'Capítulo 1'),
      textFrame(2, 'TP1', 0, 'Autor'),
      textFrame(2, 'TAL', 0, 'Libro'),
      textFrame(2, 'TRK', 0, '1')
    );

    expect(extractId3Tags(tag)).toEqual({
      title: 'Capítulo 1',
      artist: 'Autor',
      album: 'Libro',
      albumArtist: null,
      track: 1,
    });
  });

  it('une varios artistas separados por NUL', () => {
    const payload = concat(new Uint8Array([0]), str('Ana'), new Uint8Array([0]), str('Luis'));
    const tag = id3Tag(3, id3Frame(3, 'TPE1', payload));
    expect(extractId3Tags(tag)?.artist).toBe('Ana, Luis');
  });

  it('devuelve null si no hay frames de texto', () => {
    const tag = id3Tag(3, id3Frame(3, 'APIC', new Uint8Array([0, 0, 0])));
    expect(extractId3Tags(tag)).toBeNull();
  });

  it('tolera un tag truncado sin lanzar', () => {
    const tag = id3Tag(3, textFrame(3, 'TIT2', 0, 'Título'));
    const truncated = tag.slice(0, tag.length - 3);
    expect(extractId3Tags(truncated)).toBeNull();
  });
});

describe('helpers de prueba', () => {
  it('syncsafe y ascii se comportan como el parser espera', () => {
    expect(ascii(str('ID3'), 0, 3)).toBe('ID3');
    expect(syncsafe(syncsafeBytes(300), 0)).toBe(300);
  });
});
