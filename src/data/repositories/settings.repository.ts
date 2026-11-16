import { getDatabase } from '@/data/db/database';
import { DEFAULT_SETTINGS, type AppSettings, type ThemeMode } from '@/types/settings';

function toVolume(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : DEFAULT_SETTINGS.volume;
}

function parseSettings(value: string | null): AppSettings {
  if (!value) {
    return DEFAULT_SETTINGS;
  }
  try {
    const parsed = JSON.parse(value) as Partial<AppSettings>;
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      volume: toVolume(parsed.volume),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function getSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'app'"
  );
  return parseSettings(row?.value ?? null);
}

async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES ('app', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    JSON.stringify(settings)
  );
}

export const settingsRepository = {
  get: getSettings,

  async setTheme(theme: ThemeMode): Promise<void> {
    await saveSettings({ ...(await getSettings()), theme });
  },

  /** Volumen del reproductor (`M-02`); vive en ajustes, no en la sesión. */
  async setVolume(volume: number): Promise<void> {
    await saveSettings({ ...(await getSettings()), volume: toVolume(volume) });
  },
};
