import { extractId3Artwork, parseId3TagSize } from '@/domain/artwork/id3';
import { ascii, syncsafe, u32 } from '@/domain/artwork/bytes';

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
    out[i] = value.charCodeAt(i);
  }
  return out;
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

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

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

function apicData(
  version: 2 | 3 | 4,
  pictureType: number,
  image: Uint8Array,
  mime = 'image/jpeg'
): Uint8Array {
  if (version === 2) {
    const format = mime === 'image/png' ? 'PNG' : 'JPG';
    return concat(
      new Uint8Array([0]),
      str(format),
      new Uint8Array([pictureType]),
      new Uint8Array([0]),
      image
    );
  }
  return concat(
    new Uint8Array([0]),
    str(mime),
    new Uint8Array([0]),
    new Uint8Array([pictureType]),
    new Uint8Array([0]),
    image
  );
}

describe('parseId3TagSize', () => {
  it('lee el tamaño del body desde el header', () => {
    const tag = id3Tag(3, id3Frame(3, 'TIT2', str('Hola')));
    expect(parseId3TagSize(tag)).toBe(14);
  });

  it('devuelve null si no es ID3', () => {
    expect(parseId3TagSize(new Uint8Array(10))).toBeNull();
  });
});

describe('extractId3Artwork', () => {
  it('extrae el APIC frontal de un tag v2.3', () => {
    const tag = id3Tag(3, id3Frame(3, 'APIC', apicData(3, 3, JPEG)));
    const artwork = extractId3Artwork(tag);
    expect(artwork?.mime).toBe('image/jpeg');
    expect(Array.from(artwork?.data ?? [])).toEqual(Array.from(JPEG));
  });

  it('prefiere la portada frontal cuando hay varios APIC', () => {
    const tag = id3Tag(
      3,
      id3Frame(3, 'APIC', apicData(3, 4, PNG)),
      id3Frame(3, 'APIC', apicData(3, 3, JPEG))
    );
    const artwork = extractId3Artwork(tag);
    expect(artwork?.mime).toBe('image/jpeg');
  });

  it('acepta cualquier picture type si no hay frontal', () => {
    const tag = id3Tag(3, id3Frame(3, 'APIC', apicData(3, 0, PNG)));
    expect(extractId3Artwork(tag)?.mime).toBe('image/png');
  });

  it('parsea tamaños syncsafe de frames en v2.4', () => {
    const tag = id3Tag(4, id3Frame(4, 'APIC', apicData(4, 3, JPEG)));
    expect(extractId3Artwork(tag)?.mime).toBe('image/jpeg');
  });

  it('parsea el frame PIC de v2.2 con formato PNG', () => {
    const tag = id3Tag(2, id3Frame(2, 'PIC', apicData(2, 3, PNG)));
    const artwork = extractId3Artwork(tag);
    expect(artwork?.mime).toBe('image/png');
    expect(Array.from(artwork?.data ?? [])).toEqual(Array.from(PNG));
  });

  it('devuelve null sin frame de arte', () => {
    const tag = id3Tag(3, id3Frame(3, 'TIT2', str('Título')));
    expect(extractId3Artwork(tag)).toBeNull();
  });

  it('tolera descripciones UTF-16 antes de la imagen', () => {
    const description = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x00, 0x00]);
    const frame = concat(
      new Uint8Array([1]),
      str('image/jpeg'),
      new Uint8Array([0]),
      new Uint8Array([3]),
      description,
      JPEG
    );
    const tag = id3Tag(3, id3Frame(3, 'APIC', frame));
    expect(Array.from(extractId3Artwork(tag)?.data ?? [])).toEqual(Array.from(JPEG));
  });

  it('ignora arte con firma de imagen inválida', () => {
    const bogus = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const tag = id3Tag(3, id3Frame(3, 'APIC', apicData(3, 3, bogus)));
    expect(extractId3Artwork(tag)).toBeNull();
  });

  it('se detiene ante frames truncados', () => {
    const tag = id3Tag(3, id3Frame(3, 'APIC', apicData(3, 3, JPEG)));
    const truncated = tag.slice(0, tag.length - 4);
    expect(extractId3Artwork(truncated)).toBeNull();
  });
});

describe('helpers binarios', () => {
  it('u32 y ascii leen big-endian y texto', () => {
    const buffer = concat(str('ABCD'), u32be(0x01020304));
    expect(ascii(buffer, 0, 4)).toBe('ABCD');
    expect(u32(buffer, 4)).toBe(0x01020304);
    // syncsafe: 7 bits por byte → 0x01<<21 | 0x02<<14 | 0x03<<7 | 0x04.
    expect(syncsafe(buffer, 4)).toBe(0x00208184);
  });
});
