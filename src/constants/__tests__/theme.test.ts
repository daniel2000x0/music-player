import {
  BottomTabInset,
  Colors,
  IconSize,
  MaxContentWidth,
  MiniPlayerInset,
  MinTouchTarget,
  OnDanger,
  Radius,
  Scrim,
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
    expect(MaxContentWidth).toBeGreaterThan(0);
    expect(TabBarBaseHeight).toBeGreaterThan(0);
    expect(BottomTabInset).toBeGreaterThanOrEqual(0);
    // El mini-reproductor debe reservar más que su propio alto visible.
    expect(MiniPlayerInset).toBeGreaterThan(64);
  });
});
