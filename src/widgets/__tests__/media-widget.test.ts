import { formatClock } from '@/utils/format';

/**
 * El componente del widget se serializa a texto y se evalúa en un runtime
 * aislado, así que su `formatClock` no puede importarse. Esta prueba extrae la
 * copia inline del archivo fuente y la compara con la versión canónica de
 * `src/utils/format.ts` para que no diverjan.
 *
 * LÓGICA: los tipos de Node no están en el `tsconfig` del proyecto (el código
 * de la app no usa APIs de Node), así que se declaran aquí lo mínimo para leer
 * el archivo fuente en el entorno de Jest.
 */
declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const WIDGET_SOURCE = readFileSync(join(__dirname, '..', 'media-widget.tsx'), 'utf8');

/** Extrae la expresión de flecha de `const formatClock = ...` contando llaves. */
function extractInlineFormatClock(source: string): string {
  const marker = 'const formatClock = ';
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error('No se encontró `formatClock` en media-widget.tsx');
  }
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(source.indexOf('=', start) + 1, i + 1).trim();
      }
    }
  }
  throw new Error('`formatClock` del widget no cierra correctamente');
}

/** Quita las anotaciones de tipo mínimas para poder evaluar el TS como JS. */
function toJavaScript(expression: string): string {
  return expression.replace(/:\s*number/g, '');
}

const inlineFormatClock = new Function(
  `return (${toJavaScript(extractInlineFormatClock(WIDGET_SOURCE))});`
)() as (value: number) => string;

describe('media-widget.tsx', () => {
  it('la copia inline de formatClock coincide con la canónica', () => {
    const cases = [0, 1, 5, 59, 60, 125, 125.9, 3599, 3600, 3725, 36000, -10, Number.NaN];
    for (const value of cases) {
      expect(inlineFormatClock(value)).toBe(formatClock(value));
    }
  });

  it('no usa horizontalArrangement (el runtime Glance lo ignora)', () => {
    expect(WIDGET_SOURCE).not.toContain('horizontalArrangement=');
  });

  it('muestra posición y duración en una sola etiqueta separada', () => {
    expect(WIDGET_SOURCE).toContain("formatClock(props.position) + ' / ' + durationLabel");
    expect(WIDGET_SOURCE).toContain("props.duration > 0 ? formatClock(props.duration) : '--:--'");
  });

  it('no contiene literales de paleta: los colores llegan por props (A-02)', () => {
    expect(WIDGET_SOURCE).not.toMatch(/#[0-9A-Fa-f]{3}/);
    expect(WIDGET_SOURCE).toContain('props.theme');
  });

  it('no pinta botones inertes: saltos sin cola y toggle sin pista (A-03)', () => {
    expect(WIDGET_SOURCE).toContain('props.canGoPrevious ?');
    expect(WIDGET_SOURCE).toContain('props.canGoNext ?');
    expect(WIDGET_SOURCE).toContain('props.hasSong ?');
  });

  it('describe la portada con statusLabel para lectores de pantalla', () => {
    expect(WIDGET_SOURCE).toContain('contentDescription={props.statusLabel}');
  });
});
