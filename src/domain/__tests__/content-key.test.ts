import { buildContentKey, filenameFromUri } from '@/domain/library/content-key';

/** Huella estable: solo importan tamaño, duración y las dos muestras. */
describe('buildContentKey', () => {
  const sample = {
    size: 1_024,
    durationMs: 180_000,
    head: new Uint8Array([1, 2, 3]),
    tail: new Uint8Array([9, 8, 7]),
  };

  it('es determinista y distingue tamaño, duración y contenido', () => {
    const key = buildContentKey(sample);
    expect(key).toBe(buildContentKey({ ...sample }));
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{16}$/);
    expect(buildContentKey({ ...sample, size: 1_025 })).not.toBe(key);
    expect(buildContentKey({ ...sample, durationMs: 181_000 })).not.toBe(key);
    expect(buildContentKey({ ...sample, tail: new Uint8Array([9, 8, 6]) })).not.toBe(key);
  });

  it('acepta muestras vacías y recorta tamaños negativos', () => {
    expect(buildContentKey({ size: 0, durationMs: 0, head: new Uint8Array(), tail: new Uint8Array() })).toBe(
      '00000000-00000000-811c9dc5811c9dc5'
    );
    expect(buildContentKey({ ...sample, size: -5, durationMs: -1 })).toBe(
      buildContentKey({ ...sample, size: 0, durationMs: 0 })
    );
  });
});

describe('filenameFromUri', () => {
  it('lee el último segmento de file:// y de documentos SAF', () => {
    expect(filenameFromUri('file:///music/Album/Cancion.MP3')).toBe('cancion.mp3');
    expect(filenameFromUri('content://com.android.documents/document/primary%3AMusic%2Fpista.flac')).toBe(
      'pista.flac'
    );
  });

  it('devuelve null para URI que no exponen ruta y para URI mal formados', () => {
    expect(filenameFromUri('content://media/external/audio/media/7')).toBeNull();
    expect(filenameFromUri('ph://abc')).toBeNull();
    expect(filenameFromUri('')).toBeNull();
    expect(filenameFromUri('content://doc/document/%E0%A4%A')).toBeNull();
  });
});
