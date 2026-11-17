import {
  computeQueueWindow,
  needsWindowRecenter,
  QUEUE_WINDOW_BACK,
  QUEUE_WINDOW_EDGE,
  QUEUE_WINDOW_FORWARD,
} from '@/domain/playback/queue-window';

/**
 * Ventana de cola (`ANR`): el motor nativo solo recibe un tramo del orden de
 * reproducción para que `MediaSession` no publique miles de pistas en una
 * transacción binder del hilo principal.
 */
describe('queue window: tramo que recibe el motor', () => {
  const WINDOW = QUEUE_WINDOW_BACK + QUEUE_WINDOW_FORWARD + 1;

  it('devuelve el orden completo cuando la cola cabe en la ventana', () => {
    expect(computeQueueWindow(5, 2, false)).toEqual([0, 1, 2, 3, 4]);
    expect(computeQueueWindow(WINDOW, 0, false)).toHaveLength(WINDOW);
  });

  it('recorta alrededor de la pista actual en una cola grande', () => {
    const indices = computeQueueWindow(1000, 500, false);

    expect(indices).toHaveLength(WINDOW);
    expect(indices[0]).toBe(500 - QUEUE_WINDOW_BACK);
    expect(indices[indices.length - 1]).toBe(500 + QUEUE_WINDOW_FORWARD);
    expect(indices).toContain(500);
  });

  it('recorta contra los bordes sin dar la vuelta', () => {
    const start = computeQueueWindow(1000, 0, false);
    expect(start[0]).toBe(0);
    expect(start).toHaveLength(QUEUE_WINDOW_FORWARD + 1);

    const end = computeQueueWindow(1000, 999, false);
    expect(end[end.length - 1]).toBe(999);
    expect(end).toHaveLength(QUEUE_WINDOW_BACK + 1);
  });

  it('da la vuelta con repetición total para no cortar la reproducción', () => {
    const start = computeQueueWindow(1000, 0, true);
    expect(start).toHaveLength(WINDOW);
    expect(start[0]).toBe(1000 - QUEUE_WINDOW_BACK);
    expect(start[start.length - 1]).toBe(QUEUE_WINDOW_FORWARD);

    const end = computeQueueWindow(1000, 999, true);
    expect(end).toHaveLength(WINDOW);
    expect(end[0]).toBe(999 - QUEUE_WINDOW_BACK);
    expect(end[end.length - 1]).toBe(QUEUE_WINDOW_FORWARD - 1);
  });

  it('no repite índices al dar la vuelta', () => {
    const indices = computeQueueWindow(1000, 0, true);
    expect(new Set(indices).size).toBe(indices.length);
  });
});

describe('queue window: cuándo recentrar', () => {
  const base = {
    windowLength: QUEUE_WINDOW_BACK + QUEUE_WINDOW_FORWARD + 1,
    orderLength: 1000,
    cyclic: false,
  };

  it('no recentra en el centro de la ventana', () => {
    expect(
      needsWindowRecenter({ ...base, nativeIndex: QUEUE_WINDOW_BACK, fullIndex: 500 })
    ).toBe(false);
  });

  it('recentra al acercarse al borde por delante', () => {
    const nativeIndex = base.windowLength - 1 - (QUEUE_WINDOW_EDGE - 1);
    expect(
      needsWindowRecenter({
        ...base,
        nativeIndex,
        fullIndex: 500 + nativeIndex,
      })
    ).toBe(true);
  });

  it('no recentra en el extremo real de la cola', () => {
    expect(
      needsWindowRecenter({
        windowLength: QUEUE_WINDOW_BACK + 1,
        orderLength: 1000,
        cyclic: false,
        nativeIndex: QUEUE_WINDOW_BACK,
        fullIndex: 999,
      })
    ).toBe(false);
  });

  it('no recentra en el principio real de la cola', () => {
    expect(
      needsWindowRecenter({
        windowLength: QUEUE_WINDOW_FORWARD + 1,
        orderLength: 1000,
        cyclic: false,
        nativeIndex: 0,
        fullIndex: 0,
      })
    ).toBe(false);
  });

  it('recentra siempre cerca de los bordes con repetición total', () => {
    expect(
      needsWindowRecenter({
        ...base,
        cyclic: true,
        nativeIndex: base.windowLength - 1,
        fullIndex: 999,
      })
    ).toBe(true);
  });

  it('no recentra cuando la ventana cubre toda la cola', () => {
    expect(
      needsWindowRecenter({
        nativeIndex: 2,
        windowLength: 5,
        fullIndex: 2,
        orderLength: 5,
        cyclic: false,
      })
    ).toBe(false);
  });

  it('no recentra una cola pequeña con repetición total', () => {
    expect(
      needsWindowRecenter({
        nativeIndex: 0,
        windowLength: 3,
        fullIndex: 0,
        orderLength: 3,
        cyclic: true,
      })
    ).toBe(false);
  });
});
