export type ThemeMode = 'light' | 'dark';

export type AppSettings = {
  theme: ThemeMode;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
};
