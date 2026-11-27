/**
 * Doble de `expo-sqlite` para pruebas de repositorios.
 *
 * Los repositorios no importan `expo-sqlite` directamente: pasan por
 * `@/data/db/database`. Este doble registra cada sentencia y permite fijar
 * respuestas de lectura, de modo que cada prueba comprueba el SQL y los
 * parámetros que realmente se envían sin abrir una base de datos nativa.
 *
 * ```ts
 * const fake = createFakeDatabase();
 * jest.mock('@/data/db/database', () => ({ getDatabase: jest.fn(async () => fake.db) }));
 * ```
 *
 * La variable capturada debe empezar por `mock` para satisfacer el hoisting
 * de `jest.mock` (p. ej. `const mockFake = createFakeDatabase();`).
 */

export type SqlCall = { sql: string; params: unknown[] };

export type Row = Record<string, unknown>;

export type ReadHandler = (sql: string, params: unknown[]) => Row | null;
export type AllHandler = (sql: string, params: unknown[]) => Row[];

export type FakeDatabase = ReturnType<typeof createFakeDatabase>;

export function createFakeDatabase() {
  const runs: SqlCall[] = [];
  const transactions: number[] = [];
  let firstHandler: ReadHandler | null = null;
  let allHandler: AllHandler = () => [];
  let strictTransactions = false;
  let inTransaction = false;

  const defaultWithTransaction = async (fn: () => Promise<void>) => {
    transactions.push(runs.length);
    if (strictTransactions) {
      // Reproduce la restricción real de SQLite: una sola transacción por conexión.
      if (inTransaction) {
        throw new Error('cannot start a transaction within a transaction');
      }
      inTransaction = true;
    }
    try {
      await fn();
    } finally {
      inTransaction = false;
    }
  };

  const db = {
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      runs.push({ sql, params });
      return { lastInsertRowId: runs.length, changes: 1 };
    }),
    getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) =>
      firstHandler ? firstHandler(sql, params) : null
    ),
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => allHandler(sql, params)),
    withTransactionAsync: jest.fn(defaultWithTransaction),
    execAsync: jest.fn(async () => undefined),
  };

  return {
    db,
    runs,
    transactions,
    setFirst: (handler: ReadHandler | null) => {
      firstHandler = handler;
    },
    setAll: (handler: AllHandler) => {
      allHandler = handler;
    },
    /** Activa la comprobación estricta de transacciones anidadas de SQLite. */
    setStrictTransactions: (enabled: boolean) => {
      strictTransactions = enabled;
    },
    clear: () => {
      runs.length = 0;
      transactions.length = 0;
      firstHandler = null;
      allHandler = () => [];
      strictTransactions = false;
      inTransaction = false;
      db.withTransactionAsync.mockImplementation(defaultWithTransaction);
      jest.clearAllMocks();
    },
    /** Última sentencia registrada, para aserciones rápidas. */
    last: (): SqlCall | undefined => runs[runs.length - 1],
    /** Sentencias que contienen un fragmento de SQL. */
    callsMatching: (fragment: string): SqlCall[] =>
      runs.filter((call) => call.sql.includes(fragment)),
  };
}
