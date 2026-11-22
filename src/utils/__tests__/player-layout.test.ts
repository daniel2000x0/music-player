import { Spacing } from '@/constants/theme';
import { MAX_ARTWORK_SIZE, playerArtworkSize, playerContentGap } from '@/utils/player-layout';

// `constants/theme` importa el CSS global, que transforma Metro pero no Jest.
jest.mock('@/global.css', () => ({}));

describe('playerArtworkSize', () => {
  it('limita la portada por el ancho disponible', () => {
    expect(playerArtworkSize(360, 1200)).toBe(312);
  });

  it('prioriza la carátula en pantallas cortas, con límite vertical seguro', () => {
    // 600 * 0.34 = 204
    expect(playerArtworkSize(390, 600)).toBeCloseTo(204, 5);
    // 667 * 0.34 = 226.78
    expect(playerArtworkSize(412, 667)).toBeCloseTo(226.78, 2);
  });

  it('nunca supera el tope ni devuelve negativos', () => {
    expect(playerArtworkSize(1200, 2000)).toBe(MAX_ARTWORK_SIZE);
    expect(playerArtworkSize(20, 100)).toBe(0);
  });
});

describe('playerContentGap', () => {
  it('reduce la separación en pantallas cortas para dar protagonismo a la carátula', () => {
    expect(playerContentGap(667)).toBe(Spacing.md);
    expect(playerContentGap(739)).toBe(Spacing.md);
  });

  it('usa separación cómoda en pantallas altas', () => {
    expect(playerContentGap(740)).toBe(Spacing.lg);
    expect(playerContentGap(915)).toBe(Spacing.lg);
  });
});
