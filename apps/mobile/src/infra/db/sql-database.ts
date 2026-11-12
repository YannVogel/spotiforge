export type SqlValue = string | number | null;

/**
 * Le sous-ensemble de `SQLiteDatabase` (expo-sqlite) dont les dépôts ont besoin. Les dépôts ne
 * dépendent que de cette interface : en test, une base SQLite en mémoire de Node la remplace.
 */
export interface SqlDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
