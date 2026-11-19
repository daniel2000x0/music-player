/** Doble de `expo-modules-core`: decide si el módulo nativo del widget existe. */

let widgetModuleAvailable = true;

export function requireOptionalNativeModule(name: string): object | null {
  return name === 'ExpoWidgets' && widgetModuleAvailable ? {} : null;
}

export function __setWidgetModuleAvailable(available: boolean): void {
  widgetModuleAvailable = available;
}
