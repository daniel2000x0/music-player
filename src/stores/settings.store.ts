import { create } from 'zustand';

import { settingsRepository } from '@/data/repositories/settings.repository';
import { DEFAULT_LANGUAGE, setCurrentLanguage, type AppLanguage } from '@/i18n/current-language';
import {
  DEFAULT_VIEW_MODES,
  type ViewMode,
  type ViewModeTab,
} from '@/types/view-mode';
import type { SongView } from '@/types/filters';
import { DEFAULT_SORT_MODES, type SortModes, type ThemeMode } from '@/types/settings';

type SettingsState = {
  theme: ThemeMode;
  language: AppLanguage;
  viewModes: Partial<Record<ViewModeTab, ViewMode>>;
  songView: SongView;
  sortModes: SortModes;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setViewMode: (tab: ViewModeTab, mode: ViewMode) => Promise<void>;
  setSongView: (view: SongView) => Promise<void>;
  setSortMode: <T extends keyof SortModes>(tab: T, sortKey: SortModes[T]) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  language: DEFAULT_LANGUAGE,
  viewModes: DEFAULT_VIEW_MODES,
  songView: 'all',
  sortModes: DEFAULT_SORT_MODES,
  hydrated: false,

  // Una sola lectura de SQLite llena tema, idioma y vistas. El splash de la
  // app se retiene hasta que termina (ver `src/app/_layout.tsx`), así que
  // nunca se ve un destello en el idioma o tema equivocados.
  hydrate: async () => {
    const settings = await settingsRepository.get();
    // El espejo permite que servicios no-React (avisos, formato) usen el mismo
    // idioma sin importar este store ni, por tanto, expo-sqlite.
    setCurrentLanguage(settings.language);
    set({
      theme: settings.theme,
      language: settings.language,
      viewModes: { ...DEFAULT_VIEW_MODES, ...settings.viewModes },
      songView: settings.songView,
      sortModes: { ...DEFAULT_SORT_MODES, ...settings.sortModes },
      hydrated: true,
    });
  },

  setTheme: async (theme) => {
    set({ theme });
    await settingsRepository.setTheme(theme);
  },

  setLanguage: async (language) => {
    // Optimista: la UI cambia al instante y SQLite se escribe detrás.
    setCurrentLanguage(language);
    set({ language });
    await settingsRepository.setLanguage(language);
  },

  setViewMode: async (tab, mode) => {
    set((state) => ({ viewModes: { ...state.viewModes, [tab]: mode } }));
    await settingsRepository.setViewMode(tab, mode);
  },

  // Persistencia de filtros/orden: update optimista + SQLite para reabrir igual.
  setSongView: async (songView) => {
    set({ songView });
    await settingsRepository.setSongView(songView);
  },

  setSortMode: async (tab, sortKey) => {
    set((state) => ({ sortModes: { ...state.sortModes, [tab]: sortKey } }));
    await settingsRepository.setSortMode(tab, sortKey);
  },
}));
