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
