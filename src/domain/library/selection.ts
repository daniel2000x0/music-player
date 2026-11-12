import type { Album, Song } from '@/types/song';

/**
 * Selecciones puras sobre la biblioteca ya cargada en memoria.
 *
 * LÓGICA: las pantallas y el store necesitan resolver ids, álbumes y
 * artistas sin volver a consultar SQLite. Tener estas funciones puras aquí
 * (en lugar de leer el store dentro de un `useMemo`) permite declarar
 * dependencias reales en React y evita arrays nuevos en los selectores de
 * Zustand.
 */

/** Resuelve ids en el orden pedido, descartando los que ya no existen. */
export function resolveSongsByIds(songs: readonly Song[], ids: readonly number[]): Song[] {
  const byId = new Map(songs.map((song) => [song.id, song]));
  return ids
    .map((id) => byId.get(id))
    .filter((song): song is Song => song !== undefined);
}

/**
 * Canciones de un álbum. La identidad coincide con la clave única de la
 * tabla `albums` (título + artista), así no hace falta transportar el id
 * del álbum en cada canción.
 */
export function songsOfAlbum(
  songs: readonly Song[],
  album: Pick<Album, 'title' | 'artist'>
): Song[] {
  return songs.filter(
    (song) => song.album === album.title && song.artist === album.artist
  );
}

/** Canciones de un artista, en el orden en que ya vienen del store. */
export function songsOfArtist(songs: readonly Song[], artist: string): Song[] {
  return songs.filter((song) => song.artist === artist);
}
