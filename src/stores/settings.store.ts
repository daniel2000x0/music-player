import { create } from 'zustand';

import { settingsRepository } from '@/data/repositories/settings.repository';
import type { ThemeMode } from '@/types/settings';

type SettingsState = {
  theme: ThemeMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  hydrated: false,

  hydrate: async () => {
    const settings = await settingsRepository.get();
    set({ theme: settings.theme, hydrated: true });
  },

  setTheme: async (theme) => {
    set({ theme });
    await settingsRepository.setTheme(theme);
  },
}));
