import { useMemo } from 'react';
import type { ScrollViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type ScrollIndicatorProps = Pick<
  ScrollViewProps,
  'showsVerticalScrollIndicator' | 'persistentScrollbar' | 'indicatorStyle'
>;

export type ScrollIndicatorOptions = {
  /**
   * `false` cuando la lista ya monta `AlphabetBar`: la píldora hace las veces
   * de indicador de posición y un segundo carril solo provocaría solape.
   * Por defecto `true` para el resto de listas.
   */
  native?: boolean;
};

/**
 * Props del indicador vertical de scroll con el color del tema activo.
 *
 * LÓGICA:
 * - iOS dibuja el indicador con `indicatorStyle` ('black' | 'white'). Se
 *   usa el tema elegido dentro de la app (no el del sistema), porque pueden
 *   no coincidir y la barra quedaría invisible o fuera de paleta.
 * - Android ignora `indicatorStyle`; `persistentScrollbar` mantiene la barra
 *   visible al terminar el gesto para que todas las listas se vean igual.
 * - En web estas props se ignoran: el color lo resuelve `color-scheme`
 *   (ver `_layout.tsx`) y el grosor `global.css`.
 * - En `scrollIndicatorInsets` (iOS) no se puede apoyar la integración porque
 *   Android no tiene equivalente: cuando hay índice alfabético se desactiva
 *   directamente el indicador nativo.
 */
export function useScrollIndicator({
  native = true,
}: ScrollIndicatorOptions = {}): ScrollIndicatorProps {
  const theme = useTheme();

  return useMemo(
    () => ({
      showsVerticalScrollIndicator: native,
      persistentScrollbar: native,
      indicatorStyle: native ? theme.scrollbarIndicator : undefined,
    }),
    [native, theme.scrollbarIndicator]
  );
}
