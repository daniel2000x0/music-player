import { useCallback } from 'react';

import { useSettingsStore } from '@/stores/settings.store';
import { DEFAULT_VIEW_MODES, type ViewMode, type ViewModeTab } from '@/types/view-mode';

/** Lee y escribe el estilo de visualización de una pestaña concreta. */
export function useViewMode(tab: ViewModeTab) {
  const mode = useSettingsStore((state) => state.viewModes[tab]) ?? DEFAULT_VIEW_MODES[tab];
  const setViewMode = useSettingsStore((state) => state.setViewMode);

  const setMode = useCallback(
    (next: ViewMode) => {
      void setViewMode(tab, next);
    },
    [setViewMode, tab]
  );

  return { mode, setMode } as const;
}
