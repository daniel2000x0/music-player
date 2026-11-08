import { getPlayThreshold, isValidPlay, MIN_PLAY_SECONDS } from '@/domain/playback/valid-play';

describe('getPlayThreshold', () => {
  it('usa 30 s para canciones normales', () => {
    expect(getPlayThreshold(180)).toBe(MIN_PLAY_SECONDS);
    expect(getPlayThreshold(60)).toBe(30);
  });

  it('usa la mitad para canciones cortas, con mínimo de 5 s', () => {
    expect(getPlayThreshold(40)).toBe(20);
    expect(getPlayThreshold(12)).toBe(6);
    expect(getPlayThreshold(4)).toBe(5);
  });

  it('usa 30 s ante duraciones inválidas', () => {
    expect(getPlayThreshold(0)).toBe(MIN_PLAY_SECONDS);
    expect(getPlayThreshold(Number.NaN)).toBe(MIN_PLAY_SECONDS);
    expect(getPlayThreshold(-10)).toBe(MIN_PLAY_SECONDS);
  });
});

describe('isValidPlay', () => {
  it('valida justo en el umbral', () => {
    expect(isValidPlay(29.9, 180)).toBe(false);
    expect(isValidPlay(30, 180)).toBe(true);
    expect(isValidPlay(20, 40)).toBe(true);
  });
});
