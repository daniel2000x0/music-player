/** Mueve un elemento de `from` a `to` sin mutar la lista original. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return [...list];
  }
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function moveItemBy<T>(list: readonly T[], index: number, direction: 'up' | 'down'): T[] {
  return moveItem(list, index, direction === 'up' ? index - 1 : index + 1);
}
