import {
  ALPHABET,
  OTHER_KEY,
  collectInitials,
  initialKey,
  isLetterKey,
  isOtherKey,
  normalizeLetter,
} from '@/utils/alphabet';

describe('normalizeLetter', () => {
  it('normaliza tildes y minúsculas a la inicial mayúscula', () => {
    expect(normalizeLetter('Álbum')).toBe('A');
    expect(normalizeLetter('Éxito')).toBe('E');
    expect(normalizeLetter('ñandú')).toBe('N');
  });

  it('ignora espacios y signos de puntuación iniciales', () => {
    expect(normalizeLetter('  Beso')).toBe('B');
    expect(normalizeLetter('¿Qué tal?')).toBe('Q');
    expect(normalizeLetter('"123"')).toBe('1');
  });

  it('devuelve una cadena vacía para títulos sin inicial alfabética', () => {
    expect(normalizeLetter('123')).toBe('1');
    expect(normalizeLetter('')).toBe('');
    expect(normalizeLetter('!!!')).toBe('');
  });
});

describe('initialKey', () => {
  it('usa la letra base para el alfabeto latino', () => {
    expect(initialKey('Águila')).toBe('A');
    expect(initialKey('zorro')).toBe('Z');
  });

  it('conserva letras de otros sistemas de escritura', () => {
    expect(initialKey('Живой')).toBe('Ж');
    expect(initialKey('Ωμέγα')).toBe('Ω');
    expect(initialKey('日本語')).toBe('日');
    expect(initialKey('مرحبا')).toBe('م');
  });

  it('agrupa números, símbolos y vacíos bajo la clave de otros', () => {
    expect(initialKey('123')).toBe(OTHER_KEY);
    expect(initialKey('!!!')).toBe(OTHER_KEY);
    expect(initialKey('')).toBe(OTHER_KEY);
  });
});

describe('collectInitials', () => {
  it('devuelve solo las letras presentes y en orden alfabético', () => {
    expect(collectInitials(['Zorro', 'Águila', 'Beso', 'Zapato'])).toEqual(['A', 'B', 'Z']);
  });

  it('incluye letras no latinas y el grupo de otros al final', () => {
    const keys = collectInitials(['123', ' Águila', 'Живой', '日本', 'Omega']);

    expect(keys).toContain('A');
    expect(keys).toContain('O');
    expect(keys).toContain('Ж');
    expect(keys).toContain('日');
    expect(keys[keys.length - 1]).toBe(OTHER_KEY);
  });

  it('devuelve un array vacío si no hay títulos', () => {
    expect(collectInitials([])).toEqual([]);
  });

  it('cubre el alfabeto completo', () => {
    expect(ALPHABET).toHaveLength(26);
  });
});

describe('helpers de clave', () => {
  it('distingue letras del grupo de otros', () => {
    expect(isOtherKey(OTHER_KEY)).toBe(true);
    expect(isOtherKey('A')).toBe(false);
    expect(isLetterKey('日')).toBe(true);
    expect(isLetterKey(OTHER_KEY)).toBe(false);
  });
});
