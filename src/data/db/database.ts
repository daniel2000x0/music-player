import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/data/db/migrations';

/**
 * Acceso singleton a la base de datos local.
 *
 * LÓGICA: abre `mi-musica.db`, activa WAL y claves foráneas y ejecuta las
 * migraciones una sola vez. Los repositorios consumen `getDatabase()`.
 */

const DATABASE_NAME = 'mi-musica.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await migrateDatabase(db);
  return db;
}

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openAndMigrate();
  }
  return databasePromise;
}

/** Solo para pruebas: permite reabrir la base de datos. */
export function resetDatabaseConnection(): void {
  databasePromise = null;
}
