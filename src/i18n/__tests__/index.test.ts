import { t } from '@/i18n';

describe('t (plurales)', () => {
  const pluralDescriptor = Object.getOwnPropertyDescriptor(Intl, 'PluralRules');

  afterEach(() => {
    if (pluralDescriptor) {
      Object.defineProperty(Intl, 'PluralRules', pluralDescriptor);
    } else {
      delete (Intl as unknown as Record<string, unknown>).PluralRules;
    }
  });

  it('usa Intl.PluralRules cuando el motor lo trae', () => {
    expect(t('es', 'songsCount', { count: 1 })).toBe('1 canción');
    expect(t('es', 'songsCount', { count: 3 })).toBe('3 canciones');
    expect(t('en', 'songsCount', { count: 1 })).toBe('1 song');
    expect(t('en', 'songsCount', { count: 0 })).toBe('0 songs');
  });

  // Regresión del error visto en Expo Go: Hermes no trae PluralRules y
  // `new Intl.PluralRules(...)` lanzaba "undefined cannot be used as a
  // constructor", tumbando HomeScreen y el stack de <Tabs>.
  it('no se cae si Hermes/Expo Go no trae Intl.PluralRules', () => {
    Object.defineProperty(Intl, 'PluralRules', {
      value: undefined,
      configurable: true,
    });

    expect(t('es', 'songsCount', { count: 1 })).toBe('1 canción');
    expect(t('es', 'songsCount', { count: 3 })).toBe('3 canciones');
    expect(t('en', 'songsCount', { count: 1 })).toBe('1 song');
    expect(t('en', 'songsCount', { count: 3 })).toBe('3 songs');
  });

  it('cae al fallback si el constructor lanza', () => {
    class BrokenPluralRules {
      constructor() {
        throw new Error('ICU no disponible');
      }
    }
    Object.defineProperty(Intl, 'PluralRules', {
      value: BrokenPluralRules,
      configurable: true,
    });

    expect(t('es', 'songsCount', { count: 2 })).toBe('2 canciones');
  });

  it('normaliza conteos no finitos', () => {
    expect(t('es', 'songsCount', { count: Number.NaN })).toBe('0 canciones');
  });
});
