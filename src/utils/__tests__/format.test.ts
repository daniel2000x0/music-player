import { formatClock, formatDuration, formatSongCount } from '@/utils/format';

describe('formatClock', () => {
  it('muestra la posición inicial como 0:00', () => {
    expect(formatClock(0)).toBe('0:00');
  });

  it('usa m:ss con segundos a dos dígitos', () => {
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(59)).toBe('0:59');
    expect(formatClock(60)).toBe('1:00');
    expect(formatClock(125)).toBe('2:05');
  });

  it('trunca las fracciones de segundo', () => {
    expect(formatClock(125.9)).toBe('2:05');
  });

  it('usa h:mm:ss a partir de una hora', () => {
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(36000)).toBe('10:00:00');
  });

  it('trata valores no finitos o negativos como 0:00', () => {
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(-10)).toBe('0:00');
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('formatDuration', () => {
  it('devuelve --:-- mientras no se conoce la duración', () => {
    expect(formatDuration(0)).toBe('--:--');
    expect(formatDuration(-1)).toBe('--:--');
    expect(formatDuration(Number.NaN)).toBe('--:--');
  });

  it('coincide con formatClock cuando la duración es válida', () => {
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});

describe('formatSongCount', () => {
  it('pluraliza de forma simple', () => {
    expect(formatSongCount(1)).toBe('1 canción');
    expect(formatSongCount(0)).toBe('0 canciones');
    expect(formatSongCount(3)).toBe('3 canciones');
  });
});
