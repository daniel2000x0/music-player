import { useMemo } from 'react';
import type { ScrollViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type ScrollIndicatorProps = Pick<
  ScrollViewProps,
  'showsVerticalScrollIndicator' | 'persistentScrollbar' | 'indicatorStyle'
>;

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
 */
export function useScrollIndicator(): ScrollIndicatorProps {
  const theme = useTheme();

  return useMemo(
    () => ({
      showsVerticalScrollIndicator: true,
      persistentScrollbar: true,
      indicatorStyle: theme.scrollbarIndicator,
    }),
    [theme.scrollbarIndicator]
  );
}
