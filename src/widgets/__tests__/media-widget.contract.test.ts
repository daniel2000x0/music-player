import { Colors } from '@/constants/theme';
import {
  MEDIA_WIDGET_INITIAL_PROPS,
  type MediaWidgetProps,
  type MediaWidgetTheme,
} from '@/widgets/media-widget.contract';
import { resolveWidgetTheme } from '@/widgets/media-widget-theme';

/**
 * `constants/theme` importa el CSS global, que transforma Metro y no Jest.
 * Se sustituye por un objeto vacío para poder probar la paleta en aislamiento.
 * `jest.mock` se eleva por encima de los `import` (babel-plugin-jest-hoist),
 * así que el orden aquí no afecta.
 */
jest.mock('@/global.css', () => ({}));

/**
 * Contrato del widget (`A-02`): la paleta debe salir del sistema de diseño y no
 * de literales sueltos. `MEDIA_WIDGET_INITIAL_PROPS` no puede importar
 * `Colors` (el widget se compila en un bundle aislado), así que replica la
 * paleta oscura a mano; esta prueba es la que impide que ambas diverjan.
 */
const DARK_THEME: MediaWidgetTheme = {
  background: Colors.dark.background,
  surface: Colors.dark.backgroundElement,
  text: Colors.dark.text,
  textSecondary: Colors.dark.textSecondary,
  accent: Colors.dark.accent,
  accentText: Colors.dark.accentText,
  progressTrack: Colors.dark.backgroundSelected,
};

const LIGHT_THEME: MediaWidgetTheme = {
  background: Colors.light.background,
  surface: Colors.light.backgroundElement,
  text: Colors.light.text,
  textSecondary: Colors.light.textSecondary,
  accent: Colors.light.accent,
  accentText: Colors.light.accentText,
  progressTrack: Colors.light.backgroundSelected,
};

describe('media-widget.contract', () => {
  it('publica props iniciales completas y honestas', () => {
    const props: MediaWidgetProps = MEDIA_WIDGET_INITIAL_PROPS;
    expect(props.hasSong).toBe(false);
    expect(props.artwork).toBeNull();
    // Sin pista no hay nada que saltar ni que reproducir: botones honestos.
    expect(props.canGoPrevious).toBe(false);
    expect(props.canGoNext).toBe(false);
    expect(props.statusLabel.length).toBeGreaterThan(0);
  });

  it('el tema inicial replica la paleta oscura por defecto', () => {
    expect(MEDIA_WIDGET_INITIAL_PROPS.theme).toEqual(DARK_THEME);
  });

  it('resuelve claro y oscuro a paletas distintas y completas', () => {
    expect(resolveWidgetTheme('dark')).toEqual(DARK_THEME);
    expect(resolveWidgetTheme('light')).toEqual(LIGHT_THEME);
    expect(resolveWidgetTheme('light')).not.toEqual(resolveWidgetTheme('dark'));
    for (const value of Object.values(resolveWidgetTheme('light'))) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
