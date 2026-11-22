import { getDatabase } from '@/data/db/database';
import { isAppLanguage, DEFAULT_LANGUAGE, type AppLanguage } from '@/i18n';
import {
  DEFAULT_SETTINGS,
  isThemeMode,
  type AppSettings,
  type ThemeMode,
} from '@/types/settings';
import {
  DEFAULT_VIEW_MODES,
  isViewModeTab,
  normalizeViewMode,
  type ViewMode,
  type ViewModeTab,
} from '@/types/view-mode';

function toVolume(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : DEFAULT_SETTINGS.volume;
}

/**
 * Migración tolerante: el JSON guardado por versiones anteriores solo tenía
 * `theme` y `volume`. Los campos nuevos se rellenan con sus valores por
 * defecto sin borrar lo que ya había, así que no hace falta ALTER TABLE.
 */
function parseSettings(value: string | null): AppSettings {
  if (!value) {
    return DEFAULT_SETTINGS;
  }
  try {
    const parsed = JSON.parse(value) as Partial<AppSettings>;
    // Distinguimos «campo ausente» (JSON de una versión anterior → se rellena
    // con los defaults) de «campo presente pero vacío» (el usuario aún no ha
    // elegido estilos → se respeta vacío). Si no hiciéramos esta distinción,
    // la primera escritura parcial (p. ej. cambiar el volumen) convertiría los
    // defaults en `{}` y las pestañas perderían su estilo inicial.
    const hasStoredViews = parsed.viewModes !== undefined && parsed.viewModes !== null;
    const storedViews = (parsed.viewModes ?? {}) as Record<string, unknown>;
    const viewModes: Partial<Record<ViewModeTab, ViewMode>> = hasStoredViews
      ? {}
      : { ...DEFAULT_VIEW_MODES };

    for (const tab of Object.keys(DEFAULT_VIEW_MODES) as ViewModeTab[]) {
      if (!isViewModeTab(tab)) {
        continue;
      }
      // Migración: modos antiguos de rejilla/Bloques se normalizan al set
      // actual. La próxima escritura de ajustes guarda el valor normalizado.
      const normalized = normalizeViewMode(storedViews[tab]);
      if (normalized) {
        viewModes[tab] = normalized;
      }
    }

    return {
      theme: isThemeMode(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
      volume: toVolume(parsed.volume),
      language: isAppLanguage(parsed.language) ? parsed.language : DEFAULT_LANGUAGE,
      viewModes,
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

  /** Idioma global. Se guarda junto al tema para hidratarse en el mismo arranque. */
  async setLanguage(language: AppLanguage): Promise<void> {
    await saveSettings({ ...(await getSettings()), language });
  },

  /** Preferencia de vista de una pestaña. `merge` para no perder las demás. */
  async setViewMode(tab: ViewModeTab, mode: ViewMode): Promise<void> {
    const current = await getSettings();
    await saveSettings({
      ...current,
      viewModes: { ...current.viewModes, [tab]: mode },
    });
  },
};
