export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Normaliza la inicial para reconocer letras con tildes (Á → A, É → E). */
export function normalizeLetter(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .charAt(0)
    .toUpperCase();
}

/** Letras iniciales presentes en una lista de títulos, en orden alfabético. */
export function collectInitials(titles: Iterable<string>): string[] {
  const available = new Set<string>();

  for (const title of titles) {
    const letter = normalizeLetter(title);

    if (ALPHABET.includes(letter)) {
      available.add(letter);
    }
  }

  return ALPHABET.filter((letter) => available.has(letter));
}

/** Token mínimo que necesita el índice para saber qué fila está arriba. */
export type ViewableLetterToken<T> = {
  isViewable: boolean;
  /** RN usa `undefined` (no `null`) para tokens sin índice. */
  index: number | undefined;
  item: T;
};

/**
 * Inicial de la primera fila visible, en orden de la lista.
 *
 * LÓGICA: `onViewableItemsChanged` entrega los tokens en orden de cambio, no
 * necesariamente en orden de fila. Al elegir el `index` menor nos aseguramos
 * de resaltar la letra que realmente encabeza la pantalla aunque el callback
 * llegue desordenado tras un salto alfabético o un filtrado.
 */
export function firstVisibleLetter<T extends { title: string }>(
  tokens: Iterable<ViewableLetterToken<T>>
): string | null {
  let first: ViewableLetterToken<T> | null = null;

  for (const token of tokens) {
    if (!token.isViewable || token.index === undefined) {
      continue;
    }

    if (first === null || token.index < (first.index ?? 0)) {
      first = token;
    }
  }

  return first === null ? null : normalizeLetter(first.item.title);
}
