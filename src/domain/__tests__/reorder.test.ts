import { moveItem, moveItemBy } from '@/domain/playlists/reorder';

const list = ['a', 'b', 'c', 'd'];

describe('moveItem', () => {
  it('mueve un elemento hacia arriba y abajo', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('devuelve copia sin cambios ante índices inválidos o iguales', () => {
    expect(moveItem(list, 1, 1)).toEqual(list);
    expect(moveItem(list, -1, 2)).toEqual(list);
    expect(moveItem(list, 0, 9)).toEqual(list);
  });

  it('no muta la lista original', () => {
    const copy = [...list];
    moveItem(list, 0, 3);
    expect(list).toEqual(copy);
  });
});

describe('moveItemBy', () => {
  it('mueve una posición según la dirección', () => {
    expect(moveItemBy(list, 1, 'up')).toEqual(['b', 'a', 'c', 'd']);
    expect(moveItemBy(list, 1, 'down')).toEqual(['a', 'c', 'b', 'd']);
  });

  it('mantiene el orden en los extremos', () => {
    expect(moveItemBy(list, 0, 'up')).toEqual(list);
    expect(moveItemBy(list, 3, 'down')).toEqual(list);
  });
});
