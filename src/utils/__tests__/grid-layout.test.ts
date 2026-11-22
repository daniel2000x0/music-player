import { MaxContentWidth, Spacing } from '@/constants/theme';
import { VIEW_MODES } from '@/types/view-mode';
import { getGridMetrics } from '@/utils/grid-layout';

// `constants/theme` importa el CSS global, que transforma Metro pero no Jest.
jest.mock('@/global.css', () => ({}));

describe('getGridMetrics', () => {
  it.each([
    ['list', 1, false, 'block'],
    ['smallIcons', 3, true, 'icon'],
  ] as const)('%s usa %i columnas', (mode, columns, isGrid, variant) => {
    const metrics = getGridMetrics(mode, 390);

    expect(metrics.columns).toBe(columns);
    expect(metrics.isGrid).toBe(isGrid);
    expect(metrics.variant).toBe(variant);
  });

  // Regresión del "sobran píxeles de un lado a otro": el ancho de celda se
  // redondea hacia abajo y el resto se reparte entre ambos lados.
  it('reparte el residuo con una diferencia máxima de 1 px', () => {
    const widths = [320, 360, 375, 390, 414, 768, 900, 1200];

    for (const width of widths) {
      for (const mode of VIEW_MODES) {
        const metrics = getGridMetrics(mode, width);
        const frame = Math.min(width, MaxContentWidth);
        const used =
          metrics.columns * metrics.tileWidth + metrics.gap * (metrics.columns - 1);

        expect(metrics.paddingLeft).toBeGreaterThanOrEqual(Spacing.xl);
        expect(metrics.paddingRight).toBeGreaterThanOrEqual(Spacing.xl);
        expect(Math.abs(metrics.paddingLeft - metrics.paddingRight)).toBeLessThanOrEqual(1);
        expect(metrics.paddingLeft + used + metrics.paddingRight).toBe(frame);
      }
    }
  });

  it('mantiene 3 columnas a 320 dp reduciendo el hueco', () => {
    const metrics = getGridMetrics('smallIcons', 320);

    expect(metrics.columns).toBe(3);
    expect(metrics.gap).toBe(Spacing.sm);
    expect(metrics.paddingLeft + metrics.columns * metrics.tileWidth + metrics.gap * 2 + metrics.paddingRight).toBe(320);
  });

  it('respeta el ancho máximo de contenido en pantallas anchas', () => {
    const metrics = getGridMetrics('list', 1200);

    expect(metrics.tileWidth).toBe(MaxContentWidth - Spacing.xl * 2);
  });
});
