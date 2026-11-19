import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNoticeStore } from '@/stores/notice.store';

/**
 * Banner único de avisos.
 *
 * LÓGICA: pinta el aviso más reciente del canal tipado sobre la navegación.
 * Si la app no sabe algo (escaneo fallido, permiso denegado, sesión degradada),
 * lo dice aquí en vez de fallar en silencio.
 */
export function NoticeBanner() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const notice = useNoticeStore((state) => state.notices[0]);
  const dismiss = useNoticeStore((state) => state.dismiss);

  if (!notice) {
    return null;
  }

  const color = notice.severity === 'error' ? theme.danger : theme.accent;
  const icon =
    notice.severity === 'error'
      ? 'alert-circle'
      : notice.severity === 'warning'
        ? 'warning'
        : 'information-circle';

  return (
    <View
      style={[styles.container, { top: insets.top + Spacing.sm }]}
      pointerEvents="box-none">
      <View
        style={[
          styles.banner,
          { backgroundColor: theme.backgroundElement, borderColor: color },
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite">
        <Ionicons name={icon} size={20} color={color} />

        <View style={styles.content}>
          <ThemedText type="smallBold">{notice.title}</ThemedText>
          {notice.message ? (
            <ThemedText type="small" themeColor="textSecondary">
              {notice.message}
            </ThemedText>
          ) : null}
          {notice.action ? (
            <Pressable
              onPress={() => {
                notice.action?.onPress();
                dismiss(notice.code);
              }}
              style={styles.action}
              accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color }}>
                {notice.action.label}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          hitSlop={8}
          onPress={() => dismiss(notice.code)}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Descartar aviso">
          <Ionicons name="close" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 100,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    // Se eleva sobre las pantallas para que el aviso no quede oculto.
    elevation: 6,
    shadowColor: Shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  action: {
    paddingTop: Spacing.xs,
  },
  close: {
    padding: Spacing.xs,
  },
});
