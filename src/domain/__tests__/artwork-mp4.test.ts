import { extractMp4Artwork } from '@/domain/artwork/mp4';
import type { AsyncByteReader } from '@/domain/artwork/bytes';

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

function atom(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  out.set(u32be(out.length), 0);
  out.set(str(type), 4);
  out.set(payload, 8);
  return out;
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);

/** covr/data: 8 bytes de type flags + locale antes de la imagen. */
function coverAtom(image: Uint8Array): Uint8Array {
  return atom(
    'covr',
    atom('data', concat(u32be(13), u32be(0), image))
  );
}

function readerFor(buffer: Uint8Array): AsyncByteReader {
  return async (offset, length) => {
    if (offset < 0 || offset >= buffer.length) {
      return null;
    }
    return buffer.slice(offset, offset + length);
  };
}

describe('extractMp4Artwork', () => {
  it('extrae la portada de la ruta moov/udta/meta/ilst/covr', async () => {
    const file = concat(
      atom('ftyp', str('M4A ')),
      atom('mdat', new Uint8Array(64)),
      atom('moov', atom('udta', atom('meta', concat(u32be(0), atom('ilst', coverAtom(JPEG))))))
    );
    const artwork = await extractMp4Artwork(readerFor(file), file.length);
    expect(artwork?.mime).toBe('image/jpeg');
    expect(Array.from(artwork?.data ?? [])).toEqual(Array.from(JPEG));
  });

  it('salta un mdat grande sin leerlo y encuentra moov al final', async () => {
    let readBytes = 0;
    const file = concat(
      atom('ftyp', str('isom')),
      atom('mdat', new Uint8Array(10_000)),
      atom('moov', atom('udta', atom('meta', concat(u32be(0), atom('ilst', coverAtom(PNG))))))
    );
    const reader: AsyncByteReader = async (offset, length) => {
      readBytes += length;
      return file.slice(offset, offset + length);
    };
    const artwork = await extractMp4Artwork(reader, file.length);
    expect(artwork?.mime).toBe('image/png');
    // Solo se leen headers y el payload final, nunca los 10 KB de mdat.
    expect(readBytes).toBeLessThan(200);
  });

  it('devuelve null sin átomo moov', async () => {
    const file = concat(atom('ftyp', str('isom')), atom('mdat', new Uint8Array(16)));
    expect(await extractMp4Artwork(readerFor(file), file.length)).toBeNull();
  });

  it('devuelve null sin covr', async () => {
    const file = concat(
      atom('moov', atom('udta', atom('meta', concat(u32be(0), atom('ilst', atom('nam', str('Título')))))))
    );
    expect(await extractMp4Artwork(readerFor(file), file.length)).toBeNull();
  });

  it('devuelve null con payload que no es imagen', async () => {
    const file = concat(
      atom('moov', atom('udta', atom('meta', concat(u32be(0), atom('ilst', coverAtom(str('basura')))))))
    );
    expect(await extractMp4Artwork(readerFor(file), file.length)).toBeNull();
  });

  it('devuelve null con tamaño de átomo corrupto', async () => {
    const corrupt = new Uint8Array(24);
    corrupt.set(u32be(0xffff_ffff), 0); // tamaño imposible
    expect(await extractMp4Artwork(readerFor(corrupt), corrupt.length)).toBeNull();
  });
});
