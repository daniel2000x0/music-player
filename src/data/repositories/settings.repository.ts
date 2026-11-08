import { getDatabase } from '@/data/db/database';
import { DEFAULT_SETTINGS, type AppSettings, type ThemeMode } from '@/types/settings';

function parseSettings(value: string | null): AppSettings {
  if (!value) {
    return DEFAULT_SETTINGS;
  }
  try {
    const parsed = JSON.parse(value) as Partial<AppSettings>;
    return { theme: parsed.theme === 'light' ? 'light' : 'dark' };
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

export const settingsRepository = {
  get: getSettings,

  async setTheme(theme: ThemeMode): Promise<void> {
    const db = await getDatabase();
    const current = await getSettings();
    const next: AppSettings = { ...current, theme };
    await db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES ('app', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      JSON.stringify(next)
    );
  },
};
