import type { FastifyReply } from "fastify"
import type { Db } from "./db.ts"
import { cacheGet, cacheSet } from "./redis.ts"

type OutletScope = { outletId: number }

export async function menuVersion(db: Db, outletId: number): Promise<number> {
  const cached = await cacheGet(`menu:${outletId}:version`)
  if (cached) return Number(cached)
  const result = await db.query<{ menu_version: string }>(
    "SELECT menu_version FROM outlets WHERE id = $1",
    [outletId],
  )
  const version = Number(result.rows[0]?.menu_version ?? 1)
  await cacheSet(`menu:${outletId}:version`, String(version), 30)
  return version
}

export async function sendCategories(db: Db, scope: OutletScope, reply: FastifyReply, ifNoneMatch?: string) {
  const version = await menuVersion(db, scope.outletId)
  const etag = `"cat-${scope.outletId}-${version}"`
  reply.header("etag", etag)
  reply.header("cache-control", "private, max-age=60")
  if (ifNoneMatch === etag) return reply.status(304).send()

  const key = `menu:${scope.outletId}:v${version}:categories`
  const hit = await cacheGet(key)
  if (hit) return reply.type("application/json").send(hit)

  const result = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM menu_categories
     WHERE outlet_id = $1 AND is_active
     ORDER BY sort_rank, id`,
    [scope.outletId],
  )
  const body = JSON.stringify({
    version,
    categories: result.rows.map((row) => ({ id: Number(row.id), name: row.name })),
  })
  await cacheSet(key, body, 300)
  return reply.type("application/json").send(body)
}

export async function sendCategoryItems(
  db: Db,
  scope: OutletScope,
  categoryId: number,
  reply: FastifyReply,
  ifNoneMatch?: string,
) {
  const version = await menuVersion(db, scope.outletId)
  const etag = `"items-${scope.outletId}-${version}-${categoryId}"`
  reply.header("etag", etag)
  reply.header("cache-control", "private, max-age=60")
  if (ifNoneMatch === etag) return reply.status(304).send()

  const key = `menu:${scope.outletId}:v${version}:cat:${categoryId}`
  const hit = await cacheGet(key)
  if (hit) return reply.type("application/json").send(hit)

  const result = await db.query<{
    id: string
    name: string
    short_code: string | null
    price_paise: number
    dietary: string
  }>(
    `SELECT id, name, short_code, price_paise, dietary
     FROM menu_items
     WHERE outlet_id = $1 AND category_id = $2 AND is_available
     ORDER BY sort_rank, id
     LIMIT 200`,
    [scope.outletId, categoryId],
  )
  const body = JSON.stringify({
    version,
    items: result.rows.map(toItem),
  })
  await cacheSet(key, body, 300)
  return reply.type("application/json").send(body)
}

export async function searchItems(db: Db, scope: OutletScope, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40)
  if (query.length < 1) return { items: [] }
  const version = await menuVersion(db, scope.outletId)
  const key = `menu:${scope.outletId}:v${version}:q:${query}`
  const hit = await cacheGet(key)
  if (hit) return JSON.parse(hit) as { items: ReturnType<typeof toItem>[] }

  const contains = `%${escapeLike(query)}%`
  const prefix = `${escapeLike(query)}%`
  const result = await db.query<{
    id: string
    category_id: string
    name: string
    short_code: string | null
    price_paise: number
    dietary: string
  }>(
    `SELECT id, category_id, name, short_code, price_paise, dietary
     FROM menu_items
     WHERE outlet_id = $1 AND is_available
       AND (name ILIKE $2 ESCAPE '\\' OR COALESCE(short_code, '') ILIKE $3 ESCAPE '\\')
     ORDER BY (COALESCE(short_code, '') ILIKE $3 ESCAPE '\\') DESC, name
     LIMIT 20`,
    [scope.outletId, contains, prefix],
  )
  const body = {
    items: result.rows.map((row) => ({ ...toItem(row), categoryId: Number(row.category_id) })),
  }
  await cacheSet(key, JSON.stringify(body), 30)
  return body
}

function toItem(row: {
  id: string
  name: string
  short_code: string | null
  price_paise: number
  dietary: string
}) {
  return {
    id: Number(row.id),
    name: row.name,
    shortCode: row.short_code,
    pricePaise: row.price_paise,
    dietary: row.dietary,
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}
