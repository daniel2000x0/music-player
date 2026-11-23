import {
  BottomTabInset,
  Colors,
  IconSize,
  MaxContentWidth,
  MiniPlayerInset,
  MinTouchTarget,
  OnDanger,
  Radius,
  resolvePalette,
  resolveScheme,
  Scrim,
  ScrollbarEdgeMargin,
  ScrollbarGutter,
  Shadow,
  Spacing,
  TabBarBaseHeight,
} from '@/constants/theme';

/**
 * `constants/theme` importa el CSS global, que transforma Metro y no Jest.
 * Se sustituye por un objeto vacío para poder probar los tokens en aislamiento.
 * `jest.mock` se eleva por encima de los `import` (babel-plugin-jest-hoist),
 * así que el orden aquí no afecta.
 */
jest.mock('@/global.css', () => ({}));

/**
 * Pruebas de los tokens del sistema de diseño (`FASE 6`).
 *
 * LÓGICA: el resto de la UI confía en que exista una única fuente de verdad
 * para colores, espaciado y medidas. Si alguien añade una clave solo a un tema
 * o rompe la escala, estas pruebas lo detectan antes de llegar a la pantalla.
 */
describe('Spacing', () => {
  it('define la escala completa y de paso 4', () => {
    expect(Spacing).toEqual({
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    });
  });

  it('crece de forma estrictamente monótona', () => {
    const valores = [Spacing.xs, Spacing.sm, Spacing.md, Spacing.lg, Spacing.xl, Spacing.xxl];
    for (let i = 1; i < valores.length; i += 1) {
      expect(valores[i]).toBeGreaterThan(valores[i - 1]);
    }
  });
});

describe('Colors', () => {
  it('expone exactamente las mismas claves en claro y oscuro', () => {
    expect(Object.keys(Colors.light).sort()).toEqual(Object.keys(Colors.dark).sort());
  });

  it('incluye los colores semánticos que usa la app', () => {
    for (const tema of [Colors.light, Colors.dark]) {
      expect(tema.text).toMatch(/^#/);
      expect(tema.background).toMatch(/^#/);
      expect(tema.backgroundElement).toMatch(/^#/);
      expect(tema.backgroundSelected).toMatch(/^#/);
      expect(tema.textSecondary).toMatch(/^#/);
      expect(tema.border).toMatch(/^#/);
      expect(tema.accent).toMatch(/^#/);
      expect(tema.accentText).toMatch(/^#/);
      expect(tema.danger).toMatch(/^#/);
      expect(tema.link).toMatch(/^#/);
    }
  });

  it('da a cada tema un fondo y un texto distintos', () => {
    expect(Colors.light.background).not.toBe(Colors.dark.background);
    expect(Colors.light.text).not.toBe(Colors.dark.text);
  });

  it('expone las familias de superhéroe con variante clara y oscura', () => {
    const heroes = [
      'ironman',
      'avengers',
      'capitanAmerica',
      'spiderman',
      'superman',
      'greenLantern',
      'hungergames',
    ] as const;

    for (const hero of heroes) {
      const family = Colors[hero];
      expect(Object.keys(family.light).sort()).toEqual(Object.keys(family.dark).sort());

      for (const palette of [family.light, family.dark]) {
        expect('backdropScrim' in palette).toBe(true);
        expect(Object.keys(palette).length).toBeGreaterThanOrEqual(16);

        for (const key of [
          'text', 'background', 'backgroundElement', 'backgroundSelected',
          'textSecondary', 'border', 'accent', 'accentText', 'danger', 'link',
        ] as const) {
          expect(palette[key]).toMatch(/^#/);
        }
      }
    }
  });

  it('deriva Iron Man de los colores de su imagen de fondo', () => {
    // Rojos #C50600 / #8B0305 y oro #ECD078 muestreados de ironman.jpg.
    expect(Colors.ironman.light.accent).toBe('#C50600');
    expect(Colors.ironman.light.background).toBe('#FFF3DE');
    expect(Colors.ironman.light.armorGold).toBe('#ECD078');
    expect(Colors.ironman.dark.accent).toBe('#ECD078');
    expect(Colors.ironman.dark.background).toBe('#1A0506');
    expect(Colors.ironman.dark.armorGold).toBe('#ECD078');
    expect(Colors.ironman.dark.backdropScrim).toContain('26, 5, 6');
  });
});

describe('resolución de tema', () => {
  it('los temas base fijan su esquema y los héroes siguen el del sistema', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('ironman', 'light')).toBe('light');
    expect(resolveScheme('ironman', 'dark')).toBe('dark');
  });

  it('devuelve la paleta plana correcta para cada combinación', () => {
    expect(resolvePalette('light', 'dark')).toBe(Colors.light);
    expect(resolvePalette('dark', 'light')).toBe(Colors.dark);
    expect(resolvePalette('ironman', 'light')).toBe(Colors.ironman.light);
    expect(resolvePalette('ironman', 'dark')).toBe(Colors.ironman.dark);
    expect(resolvePalette('greenLantern', 'dark').accent).toBe('#50C878');
    expect(resolvePalette('superman', 'dark').background).toBe('#001E42');
  });
});

describe('tokens de medida', () => {
  it('reserva el área táctil mínima de accesibilidad', () => {
    expect(MinTouchTarget).toBe(44);
  });

  it('mantiene los tamaños de icono ordenados', () => {
    expect(IconSize.sm).toBeLessThan(IconSize.md);
    expect(IconSize.md).toBeLessThan(IconSize.lg);
    expect(IconSize.lg).toBeLessThan(IconSize.xl);
  });

  it('mantiene los radios ordenados y termina en píldora', () => {
    expect(Radius.small).toBeLessThan(Radius.medium);
    expect(Radius.medium).toBeLessThan(Radius.large);
    expect(Radius.pill).toBeGreaterThanOrEqual(Radius.large);
  });

  it('expone los valores sueltos compartidos', () => {
    expect(Scrim).toBe('rgba(0,0,0,0.5)');
    expect(Shadow).toBe('#000');
    expect(OnDanger).toBe('#FFFFFF');
    expect(ScrollbarGutter).toBeGreaterThan(0);
    expect(ScrollbarEdgeMargin).toBe(-Spacing.xl);
    expect(MaxContentWidth).toBeGreaterThan(0);
    expect(TabBarBaseHeight).toBeGreaterThan(0);
    expect(BottomTabInset).toBeGreaterThanOrEqual(0);
    // El mini-reproductor debe reservar más que su propio alto visible.
    expect(MiniPlayerInset).toBeGreaterThan(64);
  });
});
