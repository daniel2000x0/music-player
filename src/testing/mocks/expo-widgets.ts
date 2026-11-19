/** Doble de `expo-widgets`: captura snapshots y permite emitir pulsaciones. */

import type { MediaWidgetProps } from '@/widgets/media-widget.contract';

export const widgetsDirectory = 'file:///widgets';

type Interaction = {
  source: string;
  target: string;
  [key: string]: unknown;
};

type Listener = (event: Interaction) => void;

const listeners = new Set<Listener>();
const snapshots: MediaWidgetProps[] = [];

export const addUserInteractionListener = jest.fn((listener: Listener) => {
  listeners.add(listener);
  return { remove: jest.fn(() => listeners.delete(listener)) };
});

/** Último snapshot publicado en el widget. */
export function __lastSnapshot(): MediaWidgetProps | undefined {
  return snapshots[snapshots.length - 1];
}

export function __snapshots(): MediaWidgetProps[] {
  return snapshots;
}

export function __recordSnapshot(props: MediaWidgetProps): void {
  snapshots.push(props);
}

export function __emitInteraction(event: Interaction): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function __reset(): void {
  listeners.clear();
  snapshots.length = 0;
  addUserInteractionListener.mockClear();
}
