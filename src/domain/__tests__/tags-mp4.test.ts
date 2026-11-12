import { extractMp4Tags } from '@/domain/artwork/mp4';
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

/** `data` de texto: type flags (1 = UTF-8) + locale + texto. */
function textAtom(type: string, value: string): Uint8Array {
  return atom(type, atom('data', concat(u32be(1), u32be(0), utf8(value))));
}

function trackAtom(track: number, total: number): Uint8Array {
  return atom(
    'trkn',
    atom(
      'data',
      concat(
        u32be(0),
        u32be(0),
        new Uint8Array([0, 0, (track >> 8) & 0xff, track & 0xff, (total >> 8) & 0xff, total & 0xff, 0, 0])
      )
    )
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

function mp4File(...atoms: Uint8Array[]): Uint8Array {
  return concat(
    atom('ftyp', str('M4B ')),
    atom('moov', atom('udta', atom('meta', concat(u32be(0), atom('ilst', concat(...atoms))))))
  );
}

describe('extractMp4Tags', () => {
  it('lee ©nam, ©ART, ©alb, aART y trkn', async () => {
    const file = mp4File(
      textAtom('\u00a9nam', 'El Hobbit'),
      textAtom('\u00a9ART', 'J. R. R. Tolkien'),
      textAtom('\u00a9alb', 'El Hobbit (Audiolibro)'),
      textAtom('aART', 'Tolkien'),
      trackAtom(3, 12)
    );

    expect(await extractMp4Tags(readerFor(file), file.length)).toEqual({
      title: 'El Hobbit',
      artist: 'J. R. R. Tolkien',
      album: 'El Hobbit (Audiolibro)',
      albumArtist: 'Tolkien',
      track: 3,
    });
  });

  it('decodifica acentos en UTF-8', async () => {
    const file = mp4File(textAtom('\u00a9nam', 'Canción de cuna'));
    expect((await extractMp4Tags(readerFor(file), file.length))?.title).toBe('Canción de cuna');
  });

  it('devuelve null sin ilst', async () => {
    const file = concat(atom('ftyp', str('M4A ')), atom('moov', atom('udta', new Uint8Array(0))));
    expect(await extractMp4Tags(readerFor(file), file.length)).toBeNull();
  });

  it('devuelve null si ilst no trae campos conocidos', async () => {
    const file = mp4File(atom('\u00a9too', atom('data', concat(u32be(1), u32be(0), str('x')))));
    expect(await extractMp4Tags(readerFor(file), file.length)).toBeNull();
  });

  it('no lee el mdat completo', async () => {
    let readBytes = 0;
    const file = concat(
      atom('ftyp', str('M4B ')),
      atom('mdat', new Uint8Array(10_000)),
      atom('moov', atom('udta', atom('meta', concat(u32be(0), atom('ilst', textAtom('\u00a9nam', 'Libro'))))))
    );
    const reader: AsyncByteReader = async (offset, length) => {
      readBytes += length;
      return file.slice(offset, offset + length);
    };
    expect((await extractMp4Tags(reader, file.length))?.title).toBe('Libro');
    expect(readBytes).toBeLessThan(200);
  });
});
