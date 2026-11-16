export type ThemeMode = 'light' | 'dark';

export type AppSettings = {
  theme: ThemeMode;
  /** Volumen del reproductor (0–1). `M-02`. */
  volume: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  volume: 1,
};
