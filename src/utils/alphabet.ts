export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Clave del grupo de fallback: títulos que empiezan por número, símbolo o
 * cualquier carácter que no sea una letra reconocible. Viaja en los chips y
 * en `scrollToLetter`, así que ambos usan exactamente la misma definición.
 */
export const OTHER_KEY = '#';

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const LETTER = /^\p{L}$/u;
const DIGIT = /^\p{N}$/u;
const SIGNIFICANT = /[\p{L}\p{N}]/u;

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza la inicial para reconocer letras con tildes (Á → A, É → E).
 * Se conserva la API original: devuelve el primer carácter significativo,
 * con mayúscula, sin quitar los signos de puntuación identificativos.
 */
export function normalizeLetter(value: string): string {
  const characters = Array.from(value.trimStart());
  const first = characters.find((character) => SIGNIFICANT.test(character)) ?? '';
  return stripDiacritics(first).toUpperCase();
}

/**
 * Grupo al que pertenece un título para el índice alfabético.
 *
 * LÓGICA:
 * - Latinas con tilde → su letra base (Á → A, Ñ → N).
 * - Cualquier otra letra (cirílica, griega, árabe, CJK, …) → la propia letra
 *   en mayúscula. Así `Живой` tiene chip `Ж` y `日本` tiene chip `日`.
 * - Números, símbolos y títulos vacíos → `OTHER_KEY`.
 *
 * Usa `Array.from` en vez de `charAt` para no partir pares sustitutos.
 */
export function initialKey(title: string): string {
  const letter = normalizeLetter(title);

  if (ALPHABET.includes(letter)) {
    return letter;
  }
  if (DIGIT.test(letter) || letter === '') {
    return OTHER_KEY;
  }
  return letter;
}

/**
 * Claves iniciales presentes en una lista, ordenadas: A–Z, otras letras por
 * colación española y, al final, el grupo de números/símbolos.
 */
export function collectInitials(titles: Iterable<string>): string[] {
  const available = new Set<string>();

  for (const title of titles) {
    available.add(initialKey(title));
  }

  const letters = ALPHABET.filter((letter) => available.has(letter));
  const otherLetters = [...available]
    .filter((key) => key !== OTHER_KEY && !ALPHABET.includes(key))
    .sort((a, b) => collator.compare(a, b));

  return [
    ...letters,
    ...otherLetters,
    ...(available.has(OTHER_KEY) ? [OTHER_KEY] : []),
  ];
}

/** True si la clave corresponde al grupo de números y símbolos. */
export function isOtherKey(key: string): boolean {
  return key === OTHER_KEY;
}

/** True si la clave es una letra (latina o de otro sistema de escritura). */
export function isLetterKey(key: string): boolean {
  return key !== OTHER_KEY && LETTER.test(Array.from(key)[0] ?? '');
}
