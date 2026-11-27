import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { MinTouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';

export type BackButtonProps = {
  /** Acción al pulsar. Las pantallas pasan `router.back` para no acoplar este botón al router. */
  onPress: () => void;
};

/**
 * Botón «atrás» compartido por las pantallas de detalle.
 *
 * LÓGICA: el icono mide 26 dp; el contenedor garantiza 44 dp reales de área
 * táctil (no solo `hitSlop`, que no siempre se refleja en el marco expuesto a
 * TalkBack). Un único componente evita que cada pantalla repita la misma
 * combinación de icono, label y medidas.
 */
export function BackButton({ onPress }: BackButtonProps) {
  const theme = useTheme();
  const { tr } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('Volver')}
      style={styles.target}>
      <Ionicons name="chevron-back" size={26} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
