import { DEFAULT_VIEW_MODES, normalizeViewMode, VIEW_MODE_COLUMNS } from '@/types/view-mode';

describe('normalizeViewMode', () => {
  it('respeta los valores actuales', () => {
    expect(normalizeViewMode('list')).toBe('list');
    expect(normalizeViewMode('compact')).toBe('compact');
    expect(normalizeViewMode('smallIcons')).toBe('smallIcons');
  });

  // Los modos antiguos/eliminados deben mapear a un modo válido.
  it('normaliza modos eliminados/antiguos a un modo válido', () => {
    expect(normalizeViewMode('icons')).toBe('compact');
    expect(normalizeViewMode('largeIcons')).toBe('smallIcons');
    expect(normalizeViewMode('blocks')).toBe('smallIcons');
    expect(normalizeViewMode('mediumIcons')).toBe('smallIcons');
  });

  it('descarta valores desconocidos', () => {
    expect(normalizeViewMode('carrusel')).toBeUndefined();
    expect(normalizeViewMode(null)).toBeUndefined();
  });

  it('asigna a cada estilo sus columnas', () => {
    expect(VIEW_MODE_COLUMNS).toEqual({
      list: 1,
      compact: 4,
      smallIcons: 3,
    });
  });

  it('usa defaults válidos por pestaña', () => {
    expect(DEFAULT_VIEW_MODES.albums).toBe('smallIcons');
    expect(DEFAULT_VIEW_MODES.songs).toBe('list');
  });
});
