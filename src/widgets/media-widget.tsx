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
} from './media-widget.contract';

/**
 * Widget de pantalla de inicio (Android) con los controles del reproductor.
 *
 * LÓGICA: la app actualiza el widget con `updateSnapshot` (ver
 * `services/media-widget.service`), así que este componente recibe TODOS los
 * datos por props. El runtime del widget es aislado (sin hooks ni estado
 * global) y el cuerpo de la función se serializa a texto, por lo que:
 * - No puede referenciar constantes ni ayudantes de módulo: colores, tamaños
 *   y textos literales van dentro de la función.
 * - Cada botón declara un `target` explícito; al pulsarlo, el lado nativo
 *   vuelve a evaluar esta función y fusiona el objeto devuelto por `onClick`
 *   con las props guardadas (respuesta optimista aunque la app esté cerrada).
 * - Las cadenas de `target` deben coincidir con `MEDIA_WIDGET_TARGETS`
 *   (`media-widget.contract`), que usa la app para reflejar la pulsación en el
 *   motor compartido.
 * - La barra usa `LinearProgressIndicator` porque el runtime Android de
 *   `expo-widgets` la traduce a Glance (`EmittableLinearProgressIndicator`).
 *   No hay animación ni timeline: cada posición llega en un snapshot nuevo.
 */
function MediaWidget(props: MediaWidgetProps) {
  'widget';

  const progress =
    props.duration > 0
      ? Math.min(1, Math.max(0, props.position / props.duration))
      : 0;

  const formatTime = (value: number) => {
    const total = Math.max(0, Math.floor(value));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  };

  return (
    <Column
      modifiers={[
        background('#0B0B0F'),
        cornerRadius(24),
        fillMaxWidth(),
        padding(16, 12, 16, 12),
      ]}>
      <Row modifiers={[fillMaxWidth()]} verticalAlignment="center">
        {props.artwork ? (
          <Image
            source={{ uri: props.artwork }}
            contentScale="crop"
            contentDescription={props.title}
            modifiers={[size(52, 52), cornerRadius(12)]}
          />
        ) : (
          <Column modifiers={[size(52, 52), cornerRadius(12), background('#1C1C26')]} />
        )}
        <Column
          modifiers={[fillMaxWidth(), padding(12, 2, 0, 2)]}
          verticalArrangement="center">
          <Text
            color="#FFFFFF"
            maxLines={1}
            overflow="ellipsis"
            style={{ fontSize: 15, fontWeight: 'bold' }}>
            {props.title}
          </Text>
          <Text color="#9A9AA8" maxLines={1} overflow="ellipsis" style={{ fontSize: 12 }}>
            {props.artist}
          </Text>
        </Column>
      </Row>

      <Column modifiers={[fillMaxWidth(), padding(0, 10, 0, 0)]}>
        <LinearProgressIndicator
          progress={progress}
          color="#7C5CFF"
          trackColor="#2A2A38"
          modifiers={[fillMaxWidth(), height(4), cornerRadius(2)]}
        />
        <Row
          modifiers={[fillMaxWidth(), padding(0, 4, 0, 0)]}
          horizontalArrangement="spaceBetween">
          <Text color="#9A9AA8" style={{ fontSize: 10 }}>
            {formatTime(props.position)}
          </Text>
          <Text color="#9A9AA8" style={{ fontSize: 10 }}>
            {formatTime(props.duration)}
          </Text>
        </Row>
      </Column>

      <Row
        modifiers={[fillMaxWidth(), padding(0, 6, 0, 0)]}
        horizontalAlignment="center"
        verticalAlignment="center">
        <Button
          {...{ target: 'previous' }}
          enabled={props.hasSong}
          onClick={() => undefined}
          contentPadding={{ start: 14, top: 5, end: 14, bottom: 5 }}
          colors={{ containerColor: '#1C1C26', contentColor: '#FFFFFF' }}>
          <Text style={{ fontSize: 13 }}>◀◀</Text>
        </Button>

        <Button
          {...{ target: 'toggle' }}
          enabled={props.hasSong}
          onClick={() => ({ isPlaying: !props.isPlaying })}
          contentPadding={{ start: 18, top: 5, end: 18, bottom: 5 }}
          colors={{ containerColor: '#7C5CFF', contentColor: '#FFFFFF' }}
          modifiers={[padding(12, 0, 12, 0)]}>
          <Text style={{ fontSize: 15 }}>{props.isPlaying ? '▮▮' : '▶'}</Text>
        </Button>

        <Button
          {...{ target: 'next' }}
          enabled={props.hasSong}
          onClick={() => undefined}
          contentPadding={{ start: 14, top: 5, end: 14, bottom: 5 }}
          colors={{ containerColor: '#1C1C26', contentColor: '#FFFFFF' }}>
          <Text style={{ fontSize: 13 }}>▶▶</Text>
        </Button>
      </Row>
    </Column>
  );
}

export default createWidget<MediaWidgetProps>(
  MEDIA_WIDGET_NAME,
  MediaWidget,
  MEDIA_WIDGET_INITIAL_PROPS
);
