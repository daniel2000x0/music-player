import { CONTENT_SAMPLE_BYTES, buildContentKey } from '@/domain/library/content-key';
import { computeContentKey } from '@/services/content-key.service';
import { FakeFileHandle, __reset, __seedFile } from '@/testing/mocks/expo-file-system';

jest.mock('expo-file-system', () => {
  const fake = jest.requireActual<typeof import('@/testing/mocks/expo-file-system')>(
    '@/testing/mocks/expo-file-system'
  );
  return { ...fake, File: fake.FakeFile };
});

beforeEach(() => {
  __reset();
});

describe('computeContentKey', () => {
  it('lee solo los extremos del archivo y cierra el handle', async () => {
    const head = new Uint8Array(CONTENT_SAMPLE_BYTES).fill(7);
    const tail = new Uint8Array(CONTENT_SAMPLE_BYTES).fill(3);
    const bytes = new Uint8Array(CONTENT_SAMPLE_BYTES * 2 + 32);
    bytes.set(head, 0);
    bytes.set(tail, CONTENT_SAMPLE_BYTES + 32);
    __seedFile('file:///music/pista.mp3', bytes);
    const close = jest.spyOn(FakeFileHandle.prototype, 'close');

    const key = await computeContentKey('file:///music/pista.mp3', 120);

    expect(key).toBe(
      buildContentKey({ size: bytes.length, durationMs: 120_000, head, tail })
    );
    expect(close).toHaveBeenCalledTimes(1);
    close.mockRestore();
  });

  it('devuelve null para URI que no se pueden abrir como File', async () => {
    await expect(computeContentKey('content://media/7', 120)).resolves.toBeNull();
    await expect(computeContentKey('file:///music/inexistente.mp3', 120)).resolves.toBeNull();
  });

  it('devuelve null si el archivo está vacío', async () => {
    __seedFile('file:///music/vacio.mp3', new Uint8Array(0));
    await expect(computeContentKey('file:///music/vacio.mp3', 1)).resolves.toBeNull();
  });
});
