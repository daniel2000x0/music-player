import {
  diffScan,
  supportsIncrementalScan,
  type DeviceTrack,
  type StoredTrack,
} from '@/domain/library/scan-diff';

const track = (mediaId: string, modificationTime: number | null): DeviceTrack => ({
  mediaId,
  modificationTime,
});

const stored = (mediaId: string, modificationTime: number | null, isAvailable = true): StoredTrack => ({
  mediaId,
  modificationTime,
  isAvailable,
});

describe('supportsIncrementalScan', () => {
  it('exige fecha utilizable en todas las pistas', () => {
    expect(supportsIncrementalScan([track('a', 1), track('b', 2)])).toBe(true);
    expect(supportsIncrementalScan([])).toBe(true);
    expect(supportsIncrementalScan([track('a', 1), track('b', null)])).toBe(false);
    expect(supportsIncrementalScan([track('a', 0)])).toBe(false);
  });
});

describe('diffScan', () => {
  it('clasifica nuevas, modificadas, sin cambios y ausentes', () => {
    const device = [track('igual', 100), track('cambiada', 200), track('reaparece', 300)];
    const storedTracks = [
      stored('igual', 100),
      stored('cambiada', 150),
      stored('reaparece', 300, false),
      stored('ausente', 400),
    ];

    const diff = diffScan(device, storedTracks);

    expect(diff.mode).toBe('incremental');
    expect(diff.added).toEqual(['reaparece']);
    expect(diff.updated).toEqual(['cambiada']);
    expect(diff.unchanged).toEqual(['igual']);
    expect(diff.missing).toEqual(['ausente']);
  });

  it('cae a escaneo completo cuando falta modificationTime', () => {
    const device = [track('a', 100), track('b', null)];
    const storedTracks = [stored('a', 100), stored('b', 200)];

    const diff = diffScan(device, storedTracks);

    expect(diff.mode).toBe('full');
    expect(diff.added).toEqual([]);
    expect(diff.updated).toEqual(['a', 'b']);
    expect(diff.unchanged).toEqual([]);
  });

  it('relee una vez las filas migradas sin fecha guardada', () => {
    const diff = diffScan([track('a', 100)], [stored('a', null)]);

    expect(diff.mode).toBe('incremental');
    expect(diff.updated).toEqual(['a']);
  });

  it('deduplica la mediateca conservando el primer orden', () => {
    const diff = diffScan([track('a', 1), track('a', 1)], []);

    expect(diff.added).toEqual(['a']);
  });

  it('no reporta como ausente una pista ya marcada como no disponible', () => {
    const diff = diffScan([], [stored('podada', 10, false)]);

    expect(diff.missing).toEqual([]);
  });

  it('marca ausentes todas las disponibles si el dispositivo queda vacío', () => {
    const diff = diffScan([], [stored('a', 1), stored('b', 2), stored('c', 3, false)]);

    expect(diff.missing).toEqual(['a', 'b']);
  });

  it('reproduce el primer escaneo: todo es nuevo', () => {
    const diff = diffScan([track('a', 1), track('b', 2)], []);

    expect(diff).toMatchObject({
      mode: 'incremental',
      added: ['a', 'b'],
      updated: [],
      unchanged: [],
      missing: [],
    });
  });
});
