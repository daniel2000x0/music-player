import { ALPHABET, collectInitials, normalizeLetter } from '@/utils/alphabet';

describe('normalizeLetter', () => {
  it('normaliza tildes y minúsculas a la inicial mayúscula', () => {
    expect(normalizeLetter('Álbum')).toBe('A');
    expect(normalizeLetter('Éxito')).toBe('E');
    expect(normalizeLetter('ñandú')).toBe('N');
  });

  it('devuelve una cadena vacía para títulos sin inicial alfabética', () => {
    expect(normalizeLetter('123')).toBe('1');
    expect(normalizeLetter('')).toBe('');
  });
});

describe('collectInitials', () => {
  it('devuelve solo las letras presentes y en orden alfabético', () => {
    expect(collectInitials(['Zorro', 'Águila', 'Beso', 'Zapato'])).toEqual(['A', 'B', 'Z']);
  });

  it('devuelve un array vacío si no hay iniciales del alfabeto', () => {
    expect(collectInitials(['123', '!!!'])).toEqual([]);
    expect(collectInitials([])).toEqual([]);
  });

  it('cubre el alfabeto completo', () => {
    expect(ALPHABET).toHaveLength(26);
  });
});
