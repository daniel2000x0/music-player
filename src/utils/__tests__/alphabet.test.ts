import {
  ALPHABET,
  collectInitials,
  firstVisibleLetter,
  normalizeLetter,
  type ViewableLetterToken,
} from '@/utils/alphabet';

function token(
  title: string,
  index: number,
  isViewable = true
): ViewableLetterToken<{ title: string }> {
  return { isViewable, index, item: { title } };
}

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

describe('firstVisibleLetter', () => {
  it('elige la fila visible con el índice menor aunque lleguen desordenados', () => {
    const tokens = [token('Zorro', 42), token('Beso', 7), token('Águila', 19)];
    expect(firstVisibleLetter(tokens)).toBe('B');
  });

  it('ignora filas no visibles y tokens sin índice', () => {
    const tokens = [
      token('Águila', 2, false),
      { isViewable: true, index: undefined, item: { title: 'Beso' } },
      token('Zorro', 30),
    ];
    expect(firstVisibleLetter(tokens)).toBe('Z');
  });

  it('devuelve null cuando no hay ninguna fila visible', () => {
    expect(firstVisibleLetter([])).toBeNull();
    expect(firstVisibleLetter([token('Águila', 1, false)])).toBeNull();
  });
});
