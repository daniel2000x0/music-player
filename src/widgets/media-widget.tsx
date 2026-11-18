import {
  Button,
  Column,
  Image,
  LinearProgressIndicator,
  Row,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxWidth,
  height,
  padding,
  size,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import {
  MEDIA_WIDGET_INITIAL_PROPS,
  MEDIA_WIDGET_NAME,
  type MediaWidgetProps,
  type MediaWidgetTheme,
} from './media-widget.contract';

/**
 * Widget de pantalla de inicio (Android) con los controles del reproductor.
 *
 * LÓGICA: la app actualiza el widget con `updateSnapshot` (ver
 * `services/media-widget.service`), así que este componente recibe TODOS los
 * datos por props. El runtime del widget es aislado (sin hooks ni estado
 * global) y el cuerpo de la función se serializa a texto, por lo que:
 * - No puede referenciar constantes ni ayudantes de módulo: textos y medidas
 *   literales van dentro de la función. Los COLORES llegan resueltos en
 *   `props.theme` (la app los deriva de `Colors`); aquí no hay ningún literal
 *   de paleta.
 * - Cada botón declara un `target` explícito; al pulsarlo, el lado nativo
 *   vuelve a evaluar esta función y fusiona el objeto devuelto por `onClick`
 *   con las props guardadas (respuesta optimista aunque la app esté cerrada).
 * - Las cadenas de `target` deben coincidir con `MEDIA_WIDGET_TARGETS`
 *   (`media-widget.contract`), que usa la app para reflejar la pulsación en el
 *   motor compartido.
 * - La barra usa `LinearProgressIndicator` porque el runtime Android de
 *   `expo-widgets` la traduce a Glance (`EmittableLinearProgressIndicator`).
 *   No hay animación ni timeline: cada posición llega en un snapshot nuevo.
 * - NO usar `horizontalArrangement`: el conversor Glance de `expo-widgets`
 *   (`ExpoWidgetEmittableTree.toPeekRow`) lo ignora y cae siempre en
 *   `Alignment.Start`. Por eso los tiempos van en una sola `Text` con
 *   separador, centrada con `horizontalAlignment="center"` (sí soportado).
 * - ACCESIBILIDAD: el conversor Glance solo aplica `contentDescription` a las
 *   imágenes (`ExpoWidgetEmittableTree.kt:253-257`); los botones lo ignoran
 *   (`toPeekButton`, `:295-310`) y el modificador `semantics` no está entre
 *   los soportados (`toPeekModifier`, `:402-425`). Por eso la portada lleva
 *   `statusLabel` y los botones conservan glifos como texto visible.
 * - Los botones laterales solo se pintan si `canGoPrevious`/`canGoNext`; con
 *   una sola pista no habría nada que hacer y un botón inerte engaña (`A-03`).
 * - El formato replica `formatClock` de `src/utils/format.ts` (no se puede
 *   importar: la función se serializa a texto): horas `h:mm:ss` y `--:--` solo
 *   cuando la duración aún no se conoce. La posición 0 se muestra como `0:00`.
 */
function MediaWidget(props: MediaWidgetProps) {
  'widget';

  // Props nuevas pueden faltar en snapshots escritos por una versión anterior
  // de la app (OTA sin abrir la app): se toleran y Glance aplica sus colores
  // por defecto cuando el valor es `undefined`.
  const theme: Partial<MediaWidgetTheme> = props.theme ?? {};

  const progress =
    props.duration > 0
      ? Math.min(1, Math.max(0, props.position / props.duration))
      : 0;

  const formatClock = (value: number) => {
    const safe = Number.isFinite(value) && value > 0 ? value : 0;
    const seconds = Math.floor(safe % 60);
    const minutes = Math.floor((safe / 60) % 60);
    const hours = Math.floor(safe / 3600);
    const pad = (part: number) => (part < 10 ? '0' : '') + part;
    return hours > 0
      ? hours + ':' + pad(minutes) + ':' + pad(seconds)
      : minutes + ':' + pad(seconds);
  };

  const durationLabel = props.duration > 0 ? formatClock(props.duration) : '--:--';
  const timeLabel = formatClock(props.position) + ' / ' + durationLabel;

  const containerModifiers = [cornerRadius(24), fillMaxWidth(), padding(16, 12, 16, 12)];
  if (theme.background) {
    containerModifiers.push(background(theme.background));
  }

  const coverModifiers = [size(52, 52), cornerRadius(12)];
  if (theme.surface) {
    coverModifiers.push(background(theme.surface));
  }

  const sideButtonColors = { containerColor: theme.surface, contentColor: theme.text };
  const toggleButtonColors = { containerColor: theme.accent, contentColor: theme.accentText };

  return (
    <Column modifiers={containerModifiers}>
      <Row modifiers={[fillMaxWidth()]} verticalAlignment="center">
        {props.artwork ? (
          <Image
            source={{ uri: props.artwork }}
            contentScale="crop"
            contentDescription={props.statusLabel}
            modifiers={[size(52, 52), cornerRadius(12)]}
          />
        ) : (
          <Column modifiers={coverModifiers} />
        )}
        <Column
          modifiers={[fillMaxWidth(), padding(12, 2, 0, 2)]}
          verticalArrangement="center">
          <Text
            color={theme.text}
            maxLines={1}
            overflow="ellipsis"
            style={{ fontSize: 15, fontWeight: 'bold' }}>
            {props.title}
          </Text>
          <Text
            color={theme.textSecondary}
            maxLines={1}
            overflow="ellipsis"
            style={{ fontSize: 12 }}>
            {props.artist}
          </Text>
        </Column>
      </Row>

      <Column modifiers={[fillMaxWidth(), padding(0, 10, 0, 0)]}>
        <LinearProgressIndicator
          progress={progress}
          color={theme.accent}
          trackColor={theme.progressTrack}
          modifiers={[fillMaxWidth(), height(4), cornerRadius(2)]}
        />
        <Row
          modifiers={[fillMaxWidth(), padding(0, 4, 0, 0)]}
          horizontalAlignment="center">
          <Text color={theme.textSecondary} style={{ fontSize: 10 }}>
            {timeLabel}
          </Text>
        </Row>
      </Column>

      <Row
        modifiers={[fillMaxWidth(), padding(0, 6, 0, 0)]}
        horizontalAlignment="center"
        verticalAlignment="center">
        {props.canGoPrevious ? (
          <Button
            {...{ target: 'previous' }}
            enabled={props.hasSong}
            onClick={() => undefined}
            contentPadding={{ start: 14, top: 5, end: 14, bottom: 5 }}
            colors={sideButtonColors}>
            <Text style={{ fontSize: 13 }}>◀◀</Text>
          </Button>
        ) : null}

        {props.hasSong ? (
          <Button
            {...{ target: 'toggle' }}
            enabled={props.hasSong}
            onClick={() => ({ isPlaying: !props.isPlaying })}
            contentPadding={{ start: 18, top: 5, end: 18, bottom: 5 }}
            colors={toggleButtonColors}
            modifiers={[padding(12, 0, 12, 0)]}>
            <Text style={{ fontSize: 15 }}>{props.isPlaying ? '▮▮' : '▶'}</Text>
          </Button>
        ) : null}

        {props.canGoNext ? (
          <Button
            {...{ target: 'next' }}
            enabled={props.hasSong}
            onClick={() => undefined}
            contentPadding={{ start: 14, top: 5, end: 14, bottom: 5 }}
            colors={sideButtonColors}>
            <Text style={{ fontSize: 13 }}>▶▶</Text>
          </Button>
        ) : null}
      </Row>
    </Column>
  );
}

export default createWidget<MediaWidgetProps>(
  MEDIA_WIDGET_NAME,
  MediaWidget,
  MEDIA_WIDGET_INITIAL_PROPS
);
