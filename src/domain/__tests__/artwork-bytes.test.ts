import { EXTENSION_BY_MIME, sniffArtwork, sniffArtworkMime } from '@/domain/artwork/bytes';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function str(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    out[i] = value.charCodeAt(i) & 0xff;
  }
  return out;
}

function webp(): Uint8Array {
  return new Uint8Array([...str('RIFF'), 0, 0, 0, 0, ...str('WEBP')]);
}

describe('sniffArtworkMime', () => {
  it('reconoce JPEG, PNG, WebP y GIF por su firma', () => {
    expect(sniffArtworkMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffArtworkMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(
      'image/png'
    );
    expect(sniffArtworkMime(webp())).toBe('image/webp');
    expect(sniffArtworkMime(str('GIF87a'))).toBe('image/gif');
    expect(sniffArtworkMime(str('GIF89a'))).toBe('image/gif');
  });

  it('devuelve null para datos que no son una imagen conocida', () => {
    expect(sniffArtworkMime(str('basura'))).toBeNull();
    expect(sniffArtworkMime(new Uint8Array(0))).toBeNull();
  });

  it('envuelve la imagen validada como artwork', () => {
    expect(sniffArtwork(bytes(0xff, 0xd8, 0xff, 0xe0))?.mime).toBe('image/jpeg');
    expect(sniffArtwork(str('basura'))).toBeNull();
  });

  it('mapea cada MIME a su extensión de caché', () => {
    expect(EXTENSION_BY_MIME).toEqual({
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    });
  });
});
