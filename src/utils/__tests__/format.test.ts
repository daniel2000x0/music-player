import {
  describeAudioQuality,
  formatAudioQualityLabel,
  formatClock,
  formatDuration,
  formatSongCount,
  normalizeAudioFormat,
} from '@/utils/format';

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

describe('etiqueta de formato/calidad', () => {
  it('normaliza extensiones conocidas desde URI o nombre', () => {
    expect(normalizeAudioFormat('file:///music/tema.FLAC')).toBe('flac');
    expect(normalizeAudioFormat('song.MP3?x=1')).toBe('mp3');
    expect(normalizeAudioFormat('m4a')).toBe('m4a');
    expect(normalizeAudioFormat('desconocido.xyz')).toBeNull();
  });

  it('muestra FLAC con detalle técnico y bitrate cuando está disponible', () => {
    expect(
      formatAudioQualityLabel({ format: 'flac', bitDepth: 16, sampleRate: 44100, bitrate: 1411 }, 'es')
    ).toBe('FLAC 16/44.1 kHz · 1411 kbps');
    expect(
      describeAudioQuality({ format: 'flac', bitDepth: 16, sampleRate: 44100, bitrate: 1411 }, 'es')
    ).toBe('Formato FLAC, 16 bits, 44.1 kHz, 1411 kbps');
  });

  it('muestra bitrate en formatos con pérdida', () => {
    expect(formatAudioQualityLabel({ format: 'mp3', bitrate: 320 }, 'es')).toBe('MP3 · 320 kbps');
  });

  it('usa el fallback de FLAC sin datos técnicos', () => {
    expect(formatAudioQualityLabel('flac', 'es')).toBe('FLAC · Alta calidad');
    expect(formatAudioQualityLabel('flac', 'en')).toBe('FLAC · High quality');
  });

  it('muestra otros formatos como neutros, sin mensaje negativo', () => {
    expect(formatAudioQualityLabel('mp3', 'es')).toBe('MP3');
    expect(formatAudioQualityLabel('wav', 'en')).toBe('WAV');
    expect(describeAudioQuality('mp3', 'es')).toBe('Formato MP3');
    expect(describeAudioQuality('mp3', 'en')).toBe('MP3 format');
  });

  it('oculta formatos desconocidos', () => {
    expect(formatAudioQualityLabel(null, 'es')).toBeNull();
    expect(describeAudioQuality('pdf', 'es')).toBeNull();
  });
});
