/**
 * Modelos de la biblioteca musical.
 *
 * LÓGICA: `Song` es la entidad que fluye por toda la app. Los campos
 * administrativos (`playCount`, `lastPlayedAt`, `addedAt`, `isAvailable`)
 * viven en SQLite y se hidratan junto con los metadatos del archivo.
 */

export type Song = {
  /** Id interno en SQLite. */
  id: number;
  /** Id estable del asset en la mediateca del dispositivo. */
  mediaId: string;
  /** URI reproducible (file:// o content://). */
  uri: string;
  title: string;
  artist: string;
  album: string;
  /** Número de pista del tag (`TRCK`/`trkn`); `null` si no existe. */
  track: number | null;
  /** Carpeta contenedora del archivo; `null` si el URI no la expone. */
  folder: string | null;
  /** Duración en segundos. */
  duration: number;
  artwork: string | null;
  /** Fecha de incorporación a la biblioteca (ms). */
  addedAt: number;
  /** `false` si el archivo ya no está en el dispositivo. */
  isAvailable: boolean;
  /** `true` → se oculta de Canciones y se agrupa en Audiolibros. */
  isAudiobook: boolean;
  playCount: number;
  lastPlayedAt: number | null;
};

/** Álbum derivado, con agregados calculados en SQLite. */
export type Album = {
  id: number;
  title: string;
  artist: string;
  artwork: string | null;
  songCount: number;
  totalDuration: number;
  createdAt: number;
};

/** Artista derivado, con agregados calculados en SQLite. */
export type Artist = {
  id: number;
  name: string;
  songCount: number;
  albumCount: number;
  lastPlayedAt: number | null;
};

/** Resultado del escaneo de la mediateca antes de persistirse. */
export type ScannedSong = {
  mediaId: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  track: number | null;
  folder: string | null;
  duration: number;
  artwork: string | null;
};
