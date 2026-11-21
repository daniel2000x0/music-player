type Rgba = { r: number; g: number; b: number; a: number };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Parsea los formatos de color que usan las paletas del proyecto:
 * `#RGB`, `#RRGGBB`, `rgb(...)` y `rgba(...)`.
 *
 * Devuelve `null` para cualquier otro formato para que el interpolador pueda
 * degradar a "sin animación" en lugar de pintar un color inválido.
 */
export function parseColor(input: string): Rgba | null {
  const value = input.trim().toLowerCase();

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex?.[1]) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((digit) => digit + digit)
            .join('')
        : hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: 1,
    };
  }

  const fn = value.match(/^rgba?\(([^)]+)\)$/);
  if (!fn?.[1]) {
    return null;
  }

  const parts = fn[1].split(',').map((part) => part.trim());
  if (parts.length !== 3 && parts.length !== 4) {
    return null;
  }

  const channels = parts.map(Number);
  if (channels.some((channel) => !Number.isFinite(channel))) {
    return null;
  }

  const [r, g, b, alpha] = channels;
  return {
    r: clamp(r, 0, 255),
    g: clamp(g, 0, 255),
    b: clamp(b, 0, 255),
    a: alpha === undefined ? 1 : clamp(alpha, 0, 1),
  };
}

/** Serializa un color interpolado de vuelta a `rgba(...)`. */
export function toRgbaString({ r, g, b, a }: Rgba): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`;
}

/** Interpola linealmente entre dos colores. Si alguno no se entiende, devuelve `to`. */
export function lerpColor(from: string, to: string, t: number): string {
  const start = parseColor(from);
  const end = parseColor(to);
  if (!start || !end) {
    return to;
  }

  const progress = clamp(t, 0, 1);
  return toRgbaString({
    r: start.r + (end.r - start.r) * progress,
    g: start.g + (end.g - start.g) * progress,
    b: start.b + (end.b - start.b) * progress,
    a: start.a + (end.a - start.a) * progress,
  });
}
