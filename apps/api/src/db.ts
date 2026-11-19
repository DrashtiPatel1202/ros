import pg from "pg"

const url = process.env.DATABASE_URL ?? "postgres://localhost:5432/rea_pos"

export const pool = new pg.Pool({
  connectionString: url,
  max: 10,
  statement_timeout: 5_000,
  idleTimeoutMillis: 10_000,
})

export type Db = pg.Pool | pg.PoolClient
