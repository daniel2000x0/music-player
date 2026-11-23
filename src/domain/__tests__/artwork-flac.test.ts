import { extractFlacArtwork, extractFlacTags } from '@/domain/artwork/flac';
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

function u32le(value: number): Uint8Array {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

/** Header de bloque FLAC: flag de último (bit 7) + tipo + longitud (24 bits BE). */
function block(type: number, payload: Uint8Array, last = false): Uint8Array {
  const out = new Uint8Array(4 + payload.length);
  out[0] = (last ? 0x80 : 0) | (type & 0x7f);
  out[1] = (payload.length >>> 16) & 0xff;
  out[2] = (payload.length >>> 8) & 0xff;
  out[3] = payload.length & 0xff;
  out.set(payload, 4);
  return out;
}

/** Bloque VORBIS_COMMENT: vendor (LE) + nº de comentarios (LE) + entradas (LE). */
function vorbisComment(entries: string[]): Uint8Array {
  const vendor = utf8('test');
  const parts: Uint8Array[] = [u32le(vendor.length), vendor, u32le(entries.length)];
  for (const entry of entries) {
    const bytes = utf8(entry);
    parts.push(u32le(bytes.length), bytes);
  }
  return concat(...parts);
}

/** Bloque PICTURE: tipo + MIME + descripción + dimensiones + datos. */
function pictureBlock(pictureType: number, mime: string, image: Uint8Array): Uint8Array {
  const mimeBytes = str(mime);
  return concat(
    u32be(pictureType),
    u32be(mimeBytes.length),
    mimeBytes,
    u32be(0),
    u32be(0), // ancho
    u32be(0), // alto
    u32be(0), // profundidad
    u32be(0), // colores
    u32be(image.length),
    image
  );
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += BASE64[b0 >> 2];
    out += BASE64[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : BASE64[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : BASE64[b2 & 0x3f];
  }
  return out;
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);

function readerFor(buffer: Uint8Array): AsyncByteReader {
  return async (offset, length) => {
    if (offset < 0 || offset >= buffer.length) {
      return null;
    }
    return buffer.slice(offset, offset + length);
  };
}

function flacFile(...blocks: Uint8Array[]): Uint8Array {
  return concat(str('fLaC'), ...blocks);
}

describe('extractFlacArtwork', () => {
  it('extrae la portada del bloque PICTURE', async () => {
    const file = flacFile(
      block(0, new Uint8Array(34)),
      block(6, pictureBlock(3, 'image/jpeg', JPEG), true)
    );

    const artwork = await extractFlacArtwork(readerFor(file), file.length);

    expect(artwork?.mime).toBe('image/jpeg');
    expect(Array.from(artwork?.data ?? [])).toEqual(Array.from(JPEG));
  });

  it('prefiere la portada frontal sobre otras imágenes', async () => {
    const file = flacFile(
      block(6, pictureBlock(4, 'image/png', PNG)), // contraportada
      block(6, pictureBlock(3, 'image/jpeg', JPEG), true) // frontal
    );

    const artwork = await extractFlacArtwork(readerFor(file), file.length);

    expect(artwork?.mime).toBe('image/jpeg');
  });

  it('cae a cualquier imagen válida si no hay frontal', async () => {
    const file = flacFile(block(6, pictureBlock(4, 'image/png', PNG), true));

    expect((await extractFlacArtwork(readerFor(file), file.length))?.mime).toBe('image/png');
  });

  it('lee la portada METADATA_BLOCK_PICTURE en base64 del VORBIS_COMMENT', async () => {
    const encoded = base64(pictureBlock(3, 'image/jpeg', JPEG));
    const file = flacFile(
      block(4, vorbisComment([`TITLE=Canción`, `METADATA_BLOCK_PICTURE=${encoded}`]), true)
    );

    const artwork = await extractFlacArtwork(readerFor(file), file.length);

    expect(artwork?.mime).toBe('image/jpeg');
    expect(Array.from(artwork?.data ?? [])).toEqual(Array.from(JPEG));
  });

  it('devuelve null sin portada', async () => {
    const file = flacFile(block(0, new Uint8Array(34)), block(4, vorbisComment(['TITLE=x']), true));

    expect(await extractFlacArtwork(readerFor(file), file.length)).toBeNull();
  });

  it('devuelve null si el archivo no es FLAC', async () => {
    const file = concat(str('ID3'), new Uint8Array(32));

    expect(await extractFlacArtwork(readerFor(file), file.length)).toBeNull();
  });

  it('no lee los bloques grandes que no interesan', async () => {
    let readBytes = 0;
    const file = flacFile(
      block(0, new Uint8Array(34)),
      block(1, new Uint8Array(10_000)), // PADDING
      block(6, pictureBlock(3, 'image/jpeg', JPEG), true)
    );
    const reader: AsyncByteReader = async (offset, length) => {
      readBytes += length;
      return file.slice(offset, offset + length);
    };

    expect((await extractFlacArtwork(reader, file.length))?.mime).toBe('image/jpeg');
    // Solo headers y el payload de la portada, nunca los 10 KB de PADDING.
    expect(readBytes).toBeLessThan(200);
  });
});

describe('extractFlacTags', () => {
  it('lee TITLE, ARTIST, ALBUM, ALBUMARTIST y TRACKNUMBER', async () => {
    const file = flacFile(
      block(0, new Uint8Array(34)),
      block(
        4,
        vorbisComment([
          'TITLE=Canción de cuna',
          'ARTIST=Ana',
          'ARTIST=Luis',
          'ALBUM=Arrullos',
          'ALBUMARTIST=Varios',
          'TRACKNUMBER=3/12',
        ]),
        true
      )
    );

    expect(await extractFlacTags(readerFor(file), file.length)).toEqual({
      title: 'Canción de cuna',
      artist: 'Ana, Luis',
      album: 'Arrullos',
      albumArtist: 'Varios',
      track: 3,
      bitDepth: null,
      sampleRate: null,
      bitrate: null,
        hasLyrics: false,
      });
  });

  it('devuelve null si no hay campos conocidos', async () => {
    const file = flacFile(block(4, vorbisComment(['COMMENT=hola']), true));

    expect(await extractFlacTags(readerFor(file), file.length)).toBeNull();
  });

  it('devuelve null si el archivo no es FLAC', async () => {
    const file = concat(str('OggS'), new Uint8Array(32));

    expect(await extractFlacTags(readerFor(file), file.length)).toBeNull();
  });
});

  it('detecta letras en comentario Vorbis LYRICS', async () => {
    const file = flacFile(block(4, vorbisComment(['TITLE=Song', 'LYRICS=Hello']), true));
    expect((await extractFlacTags(readerFor(file), file.length))?.hasLyrics).toBe(true);
  });
