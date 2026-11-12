import type { SqlDatabase } from './sql-database';

/**
 * Migrations versionnées : l'entrée d'index `i` fait passer la base de la version `i` à `i + 1`.
 * Ne jamais modifier une migration publiée : en ajouter une nouvelle. Schéma décrit dans
 * docs/ARCHITECTURE.md.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE pieces (
    id TEXT PRIMARY KEY NOT NULL,
    owner_spotify_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    prompt TEXT NOT NULL,
    settings TEXT NOT NULL,
    spotify_playlist_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sent_at TEXT
  );
  CREATE INDEX pieces_by_owner ON pieces (owner_spotify_id, created_at);

  CREATE TABLE piece_tracks (
    piece_id TEXT NOT NULL REFERENCES pieces (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    spotify_uri TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    year INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    reason TEXT NOT NULL,
    slot REAL NOT NULL,
    known INTEGER NOT NULL CHECK (known IN (0, 1)),
    quenched INTEGER NOT NULL CHECK (quenched IN (0, 1)),
    PRIMARY KEY (piece_id, position)
  );

  CREATE TABLE rejected_tracks (
    piece_id TEXT NOT NULL REFERENCES pieces (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    spotify_uri TEXT NOT NULL,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    PRIMARY KEY (piece_id, position)
  );

  CREATE TABLE molds (
    id TEXT PRIMARY KEY NOT NULL,
    owner_spotify_id TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    settings TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX molds_by_owner ON molds (owner_spotify_id, created_at);

  CREATE TABLE track_cache (
    query_key TEXT PRIMARY KEY NOT NULL,
    spotify_uri TEXT,
    title TEXT,
    artists TEXT,
    year INTEGER,
    duration_ms INTEGER,
    resolved_at TEXT NOT NULL
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Applique les migrations manquantes, chacune dans une transaction, et note la version atteinte. */
export async function migrate(db: SqlDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const current = row?.user_version ?? 0;
  if (current > SCHEMA_VERSION) {
    throw new Error(`Database schema v${current} is newer than this app (v${SCHEMA_VERSION})`);
  }
  for (let version = current; version < SCHEMA_VERSION; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version] ?? '');
      // PRAGMA ne prend pas de paramètre lié ; `version` est un entier calculé ici.
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
