import pg from 'pg';
import { env } from './env.js';

// Keep Postgres `date` (OID 1082) as the raw 'YYYY-MM-DD' string. Default node-pg
// parses it into a local-midnight JS Date, which drifts across timezones —
// work_date must stay an exact PHT calendar date (CLAUDE.md, SPEC §0.5).
pg.types.setTypeParser(1082, (v) => v);

// Single pg pool over the Supabase session pooler (DATABASE_URL). The API uses
// pg directly (not supabase-js) for DB access so we get real BEGIN/COMMIT
// transactions — supabase-js has no transaction support (SPEC §6 requires the
// data write + audit log to share one transaction).
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase pooler requires TLS
  max: 10,
});

export type Sql = pg.PoolClient;

/** Run a query on the shared pool. */
export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never);
}

/**
 * Run `fn` inside a single transaction. Commits on success, rolls back on any
 * throw (so a failed audit-log write rolls back the data write — SPEC §6).
 */
export async function withTransaction<T>(fn: (client: Sql) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
