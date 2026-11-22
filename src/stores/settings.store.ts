import { create } from 'zustand';

import { settingsRepository } from '@/data/repositories/settings.repository';
import { DEFAULT_LANGUAGE, setCurrentLanguage, type AppLanguage } from '@/i18n/current-language';
import {
  DEFAULT_VIEW_MODES,
  type ViewMode,
  type ViewModeTab,
} from '@/types/view-mode';
import type { ThemeMode } from '@/types/settings';

type SettingsState = {
  theme: ThemeMode;
  language: AppLanguage;
  viewModes: Partial<Record<ViewModeTab, ViewMode>>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setViewMode: (tab: ViewModeTab, mode: ViewMode) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  language: DEFAULT_LANGUAGE,
  viewModes: DEFAULT_VIEW_MODES,
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
}));
