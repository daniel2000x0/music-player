import { type ReactNode } from 'react';
import { Image } from 'expo-image';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedScrim } from '@/components/animated-scrim';
import { EdgeFade } from '@/components/edge-fade';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, MiniPlayerInset, Spacing } from '@/constants/theme';
import { themeBackdrop } from '@/constants/theme-backdrops';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/stores/settings.store';
import { motionDuration } from '@/utils/motion';

export type ScreenShellProps = {
  title: string;
  subtitle?: string;
  /** Botón/acción a la derecha del título (ej. refrescar, ordenar). */
  action?: ReactNode;
  /** Elemento a la izquierda del título (ej. botón atrás). */
  leading?: ReactNode;
  /** Contenido fijo entre el título y el área desplazable. */
  header?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

/**
 * Contenedor común de pantallas: respeta el ancho máximo, el área segura y
 * deja espacio inferior para el tab bar y el mini-reproductor.
 */
export function ScreenShell({
  title,
  subtitle,
  action,
  leading,
  header,
  children,
  scroll = true,
  contentContainerStyle,
  refreshControl,
}: ScreenShellProps) {
  const palette = useTheme();
  const mode = useSettingsStore((state) => state.theme);
  const backdrop = themeBackdrop(mode);
  const reducedMotion = useReducedMotion();

  const content = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.titleBlock}>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.title}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>

      {header}

      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{children}</View>
      )}
    </SafeAreaView>
  );

  // Sin imagen: el contenedor de siempre con el color plano del tema.
  if (!backdrop) {
    return <ThemedView style={styles.container}>{content}</ThemedView>;
  }

  // Con imagen: veladura del tema encima y el contenido intacto. Las tarjetas
  // siguen opacas, así el fondo se ve en huecos, cabeceras y separadores.
  // `ImageBackground` de RN está deprecado en 0.88: se usa una Image absoluta
  // de expo-image, que además hace crossfade al cambiar de tema.
  const scrimColor = palette.backdropScrim ?? palette.background;

  return (
    <View style={styles.container}>
      <Image
        source={backdrop}
        style={styles.backdropImage}
        contentFit="cover"
        transition={motionDuration(reducedMotion, 400)}
        priority="high"
      />
      <AnimatedScrim color={scrimColor} duration={motionDuration(reducedMotion, 380)} />
      <EdgeFade color={palette.background} />
      <View style={styles.backdropContent}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  backdropImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdropContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  leading: {
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  action: {
    alignItems: 'flex-end',
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.sm,
    paddingBottom: BottomTabInset + MiniPlayerInset,
    gap: Spacing.lg,
  },
});
