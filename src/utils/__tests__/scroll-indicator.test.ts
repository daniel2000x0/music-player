import {
  MinScrollThumbHeight,
  scrollThumbMetrics,
} from '@/utils/scroll-indicator';

describe('scrollThumbMetrics', () => {
  it('no dibuja pulgar si no hay desplazamiento', () => {
    expect(scrollThumbMetrics(500, 500)).toBeNull();
    expect(scrollThumbMetrics(400, 500)).toBeNull();
    expect(scrollThumbMetrics(500, 0)).toBeNull();
    expect(scrollThumbMetrics(Number.NaN, 500)).toBeNull();
  });

  it('calcula altura proporcional y recorrido restante', () => {
    expect(scrollThumbMetrics(1000, 500)).toEqual({ height: 250, travel: 250 });
    expect(scrollThumbMetrics(2000, 500)).toEqual({ height: 125, travel: 375 });
  });

  it('impone una altura mínima sin recorrido negativo', () => {
    const metrics = scrollThumbMetrics(100_000, 500);
    expect(metrics?.height).toBe(MinScrollThumbHeight);
    expect(metrics?.travel).toBe(500 - MinScrollThumbHeight);
  });
});
