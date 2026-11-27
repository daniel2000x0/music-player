import { Spacing } from '@/constants/theme';
import {
  inlineLyricsBoxHeight,
  MAX_ARTWORK_SIZE,
  playerArtworkSize,
  playerContentGap,
} from '@/utils/player-layout';

// `constants/theme` importa el CSS global, que transforma Metro pero no Jest.
jest.mock('@/global.css', () => ({}));

describe('playerArtworkSize', () => {
  it('limita la portada por el ancho disponible', () => {
    expect(playerArtworkSize(360, 1200)).toBe(312);
  });

  it('prioriza caber sin scroll en pantallas cortas', () => {
    expect(playerArtworkSize(390, 600)).toBeCloseTo(168, 5);
    expect(playerArtworkSize(412, 667)).toBeCloseTo(186.76, 2);
  });

  it('nunca supera el tope y mantiene un mínimo usable', () => {
    expect(playerArtworkSize(1200, 2000)).toBe(MAX_ARTWORK_SIZE);
    expect(playerArtworkSize(20, 100)).toBe(140);
  });
});

describe('playerArtworkSize con letra incrustada', () => {
  it('descuenta el bloque de letra y su hueco para no mover el resto', () => {
    expect(playerArtworkSize(360, 1200, true)).toBe(
      playerArtworkSize(360, 1200) - inlineLyricsBoxHeight(1200) - Spacing.md
    );
    expect(playerArtworkSize(1200, 2000, true)).toBe(
      MAX_ARTWORK_SIZE - inlineLyricsBoxHeight(2000) - Spacing.md
    );
  });

  it('mantiene el mínimo usable en pantallas cortas', () => {
    expect(playerArtworkSize(390, 600, true)).toBe(140);
  });
});

describe('inlineLyricsBoxHeight', () => {
  it('reduce la vista previa en pantallas compactas', () => {
    expect(inlineLyricsBoxHeight(667)).toBe(26);
    expect(inlineLyricsBoxHeight(739)).toBe(38);
    expect(inlineLyricsBoxHeight(740)).toBe(46);
  });
});

describe('playerContentGap', () => {
  it('reduce la separación en pantallas cortas para evitar scroll', () => {
    expect(playerContentGap(667)).toBe(Spacing.xs);
    expect(playerContentGap(739)).toBe(Spacing.sm);
  });

  it('usa separación moderada en pantallas altas', () => {
    expect(playerContentGap(740)).toBe(Spacing.md);
    expect(playerContentGap(915)).toBe(Spacing.md);
  });
});
