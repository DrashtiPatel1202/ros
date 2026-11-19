import { createHash } from "node:crypto"
import type pg from "pg"
import { summarize } from "@rea/pricing"
import type { Db } from "./db.ts"

export class OrderError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export type OrderLineInput = { menuItemId: number; qty: number; note?: string }

export type OrderDraft = {
  orderType: "dine_in" | "pickup" | "delivery"
  tableLabel?: string
  customerName?: string
  note?: string
  lines: OrderLineInput[]
}

type SavedOrder = {
  id: number
  orderNo: number
  status: string
  version: number
  itemCount: number
  subtotalPaise: number
  taxPaise: number
  totalPaise: number
  createdAt: string
}

const savedColumns = `id, order_no, status, version, item_count, subtotal_paise, tax_paise, total_paise, created_at`

export async function createOrder(
  pool: pg.Pool,
  outletId: number,
  idempotencyKey: string,
  draft: OrderDraft,
): Promise<{ status: number; body: SavedOrder }> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const scopedKey = `${outletId}:${idempotencyKey}`
    const requestHash = hashDraft(draft)
    const existing = await client.query<{
      request_hash: string
      response_status: number
      response_body: SavedOrder
    }>("SELECT request_hash, response_status, response_body FROM idempotency_keys WHERE key = $1 FOR UPDATE", [
      scopedKey,
    ])
    if (existing.rowCount) {
      const prior = existing.rows[0]
      if (!prior) throw new OrderError(500, "INTERNAL", "Could not read the saved response")
      if (prior.request_hash !== requestHash) {
        throw new OrderError(409, "IDEMPOTENCY_CONFLICT", "This save was already used for a different order")
      }
      await client.query("COMMIT")
      return { status: prior.response_status, body: prior.response_body }
    }

    const saved = await insertOrder(client, outletId, draft)
    await client.query(
      `INSERT INTO idempotency_keys (key, outlet_id, request_hash, response_status, response_body)
       VALUES ($1, $2, $3, 201, $4::jsonb)`,
      [scopedKey, outletId, requestHash, JSON.stringify(saved)],
    )
    await client.query("COMMIT")
    return { status: 201, body: saved }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function updateOrder(
  pool: pg.Pool,
  outletId: number,
  orderId: number,
  version: number,
  draft: OrderDraft,
): Promise<SavedOrder> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const current = await client.query<{ status: string; version: number }>(
      "SELECT status, version FROM orders WHERE id = $1 AND outlet_id = $2 FOR UPDATE",
      [orderId, outletId],
    )
    const row = current.rows[0]
    if (!row) throw new OrderError(404, "NOT_FOUND", "That order is not on today's book")
    if (row.status !== "open") throw new OrderError(409, "ORDER_CLOSED", "Cancelled orders can't be changed")
    if (row.version !== version) {
      throw new OrderError(409, "VERSION_CONFLICT", "This order was updated on another screen. Open it again.")
    }
    const priced = await priceDraft(client, outletId, draft)
    await client.query("DELETE FROM order_items WHERE order_id = $1", [orderId])
    await insertLines(client, outletId, orderId, priced.lines)
    const updated = await client.query(
      `UPDATE orders
       SET order_type = $3, table_label = $4, customer_name = $5, note = $6,
           item_count = $7, subtotal_paise = $8, tax_paise = $9, total_paise = $10,
           version = version + 1, updated_at = now()
       WHERE id = $1 AND outlet_id = $2
       RETURNING ${savedColumns}`,
      [
        orderId,
        outletId,
        draft.orderType,
        blankToNull(draft.tableLabel),
        blankToNull(draft.customerName),
        blankToNull(draft.note),
        priced.summary.itemCount,
        priced.summary.subtotalPaise,
        priced.summary.taxPaise,
        priced.summary.totalPaise,
      ],
    )
    await client.query("COMMIT")
    return mapSaved(updated.rows[0])
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function cancelOrder(pool: pg.Pool, outletId: number, orderId: number, version: number) {
  const result = await pool.query(
    `UPDATE orders
     SET status = 'cancelled', version = version + 1, updated_at = now()
     WHERE id = $1 AND outlet_id = $2 AND status = 'open' AND version = $3
     RETURNING id`,
    [orderId, outletId, version],
  )
  if (result.rowCount) return
  const existing = await pool.query<{ status: string; version: number }>(
    "SELECT status, version FROM orders WHERE id = $1 AND outlet_id = $2",
    [orderId, outletId],
  )
  const row = existing.rows[0]
  if (!row) throw new OrderError(404, "NOT_FOUND", "That order is not on today's book")
  if (row.status !== "open") throw new OrderError(409, "ORDER_CLOSED", "This order is already cancelled")
  throw new OrderError(409, "VERSION_CONFLICT", "This order was updated on another screen. Open it again.")
}

export async function listOrders(
  db: Db,
  outletId: number,
  businessDate: string,
  status: string | null,
  cursor: { createdAt: string; id: number } | null,
  limit: number,
) {
  const result = await db.query<{
    id: string
    order_no: number
    status: string
    order_type: string
    table_label: string | null
    customer_name: string | null
    item_count: number
    total_paise: number
    created_at: Date
  }>(
    `SELECT id, order_no, status, order_type, table_label, customer_name, item_count, total_paise, created_at
     FROM orders
     WHERE outlet_id = $1 AND business_date = $2
       AND ($3::text IS NULL OR status = $3)
       AND ($4::timestamptz IS NULL OR (created_at, id) < ($4::timestamptz, $5::bigint))
     ORDER BY created_at DESC, id DESC
     LIMIT $6`,
    [outletId, businessDate, status, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
  )
  const page = result.rows.slice(0, limit)
  const extra = result.rows[limit]
  const nextCursor = extra
    ? encodeCursor(page[page.length - 1]!.created_at.toISOString(), Number(page[page.length - 1]!.id))
    : null
  return {
    orders: page.map((row) => ({
      id: Number(row.id),
      orderNo: row.order_no,
      status: row.status,
      orderType: row.order_type,
      tableLabel: row.table_label,
      customerName: row.customer_name,
      itemCount: row.item_count,
      totalPaise: row.total_paise,
      createdAt: row.created_at.toISOString(),
    })),
    nextCursor,
  }
}

export async function getOrder(db: Db, outletId: number, orderId: number) {
  const order = await db.query(
    `SELECT id, order_no, status, order_type, table_label, customer_name, note, version,
            item_count, subtotal_paise, tax_paise, total_paise, created_at
     FROM orders WHERE id = $1 AND outlet_id = $2`,
    [orderId, outletId],
  )
  const row = order.rows[0] as
    | {
        id: string
        order_no: number
        status: string
        order_type: string
        table_label: string | null
        customer_name: string | null
        note: string | null
        version: number
        item_count: number
        subtotal_paise: number
        tax_paise: number
        total_paise: number
        created_at: Date
      }
    | undefined
  if (!row) return null
  const lines = await db.query<{
    menu_item_id: string
    item_name: string
    unit_price_paise: number
    qty: number
    line_total_paise: number
    note: string | null
  }>(
    `SELECT menu_item_id, item_name, unit_price_paise, qty, line_total_paise, note
     FROM order_items WHERE order_id = $1 ORDER BY sort_rank, id`,
    [orderId],
  )
  return {
    id: Number(row.id),
    orderNo: row.order_no,
    status: row.status,
    orderType: row.order_type,
    tableLabel: row.table_label,
    customerName: row.customer_name,
    note: row.note,
    version: row.version,
    itemCount: row.item_count,
    subtotalPaise: row.subtotal_paise,
    taxPaise: row.tax_paise,
    totalPaise: row.total_paise,
    createdAt: row.created_at.toISOString(),
    lines: lines.rows.map((line) => ({
      menuItemId: Number(line.menu_item_id),
      name: line.item_name,
      unitPricePaise: line.unit_price_paise,
      qty: line.qty,
      lineTotalPaise: line.line_total_paise,
      note: line.note,
    })),
  }
}

async function insertOrder(client: pg.PoolClient, outletId: number, draft: OrderDraft): Promise<SavedOrder> {
  const outlet = await client.query<{ timezone: string }>("SELECT timezone FROM outlets WHERE id = $1", [outletId])
  const timezone = outlet.rows[0]?.timezone ?? "Asia/Kolkata"
  const businessDate = businessDateIn(timezone)
  const counter = await client.query<{ last_no: number }>(
    `INSERT INTO order_counters (outlet_id, business_date, last_no)
     VALUES ($1, $2, 1)
     ON CONFLICT (outlet_id, business_date)
     DO UPDATE SET last_no = order_counters.last_no + 1
     RETURNING last_no`,
    [outletId, businessDate],
  )
  const orderNo = counter.rows[0]?.last_no
  if (!orderNo) throw new OrderError(500, "INTERNAL", "Could not number the order")
  const priced = await priceDraft(client, outletId, draft)
  const inserted = await client.query(
    `INSERT INTO orders (
       outlet_id, order_no, business_date, order_type, status, table_label, customer_name, note,
       item_count, subtotal_paise, tax_paise, total_paise
     ) VALUES ($1,$2,$3,$4,'open',$5,$6,$7,$8,$9,$10,$11)
     RETURNING ${savedColumns}`,
    [
      outletId,
      orderNo,
      businessDate,
      draft.orderType,
      blankToNull(draft.tableLabel),
      blankToNull(draft.customerName),
      blankToNull(draft.note),
      priced.summary.itemCount,
      priced.summary.subtotalPaise,
      priced.summary.taxPaise,
      priced.summary.totalPaise,
    ],
  )
  const saved = mapSaved(inserted.rows[0])
  await insertLines(client, outletId, saved.id, priced.lines)
  return saved
}

async function priceDraft(client: pg.PoolClient, outletId: number, draft: OrderDraft) {
  const merged = mergeLines(draft.lines)
  const ids = merged.map((line) => line.menuItemId)
  const found = await client.query<{
    id: string
    name: string
    price_paise: number
    is_available: boolean
  }>(
    `SELECT id, name, price_paise, is_available
     FROM menu_items
     WHERE outlet_id = $1 AND id = ANY($2::bigint[])`,
    [outletId, ids],
  )
  const byId = new Map(found.rows.map((row) => [Number(row.id), row]))
  const unavailable: number[] = []
  const lines = merged.map((line) => {
    const item = byId.get(line.menuItemId)
    if (!item || !item.is_available) {
      unavailable.push(line.menuItemId)
      return null
    }
    return {
      menuItemId: line.menuItemId,
      name: item.name,
      unitPricePaise: item.price_paise,
      qty: line.qty,
      note: blankToNull(line.note),
    }
  })
  if (unavailable.length) {
    throw new OrderError(409, "ITEM_UNAVAILABLE", "One of those dishes is no longer available", {
      itemIds: unavailable,
    })
  }
  const ready = lines.filter((line): line is NonNullable<typeof line> => line !== null)
  const outlet = await client.query<{ tax_rate_bps: number }>(
    "SELECT tax_rate_bps FROM outlets WHERE id = $1",
    [outletId],
  )
  const taxRateBps = outlet.rows[0]?.tax_rate_bps ?? 0
  const summary = summarize(
    ready.map((line) => ({ unitPricePaise: line.unitPricePaise, qty: line.qty })),
    taxRateBps,
  )
  return { lines: ready, summary }
}

async function insertLines(
  client: pg.PoolClient,
  outletId: number,
  orderId: number,
  lines: { menuItemId: number; name: string; unitPricePaise: number; qty: number; note: string | null }[],
) {
  for (const [index, line] of lines.entries()) {
    await client.query(
      `INSERT INTO order_items (
         order_id, outlet_id, menu_item_id, item_name, unit_price_paise, qty, line_total_paise, note, sort_rank
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        orderId,
        outletId,
        line.menuItemId,
        line.name,
        line.unitPricePaise,
        line.qty,
        line.unitPricePaise * line.qty,
        line.note,
        index,
      ],
    )
  }
}

function mergeLines(lines: OrderLineInput[]): OrderLineInput[] {
  const merged = new Map<string, OrderLineInput>()
  for (const line of lines) {
    const note = line.note?.trim() ?? ""
    const key = `${line.menuItemId}:${note}`
    const current = merged.get(key)
    if (current) current.qty += line.qty
    else merged.set(key, { menuItemId: line.menuItemId, qty: line.qty, note })
  }
  for (const line of merged.values()) {
    if (line.qty > 99) throw new OrderError(400, "VALIDATION", "One dish is over 99. Split it into two lines.")
  }
  return [...merged.values()]
}

function mapSaved(row: {
  id: string | number
  order_no: number
  status: string
  version: number
  item_count: number
  subtotal_paise: number
  tax_paise: number
  total_paise: number
  created_at: Date | string
}): SavedOrder {
  return {
    id: Number(row.id),
    orderNo: row.order_no,
    status: row.status,
    version: row.version,
    itemCount: row.item_count,
    subtotalPaise: row.subtotal_paise,
    taxPaise: row.tax_paise,
    totalPaise: row.total_paise,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  }
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function hashDraft(draft: OrderDraft): string {
  return createHash("sha256").update(JSON.stringify(draft)).digest("hex")
}

export function businessDateIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  }).format(now)
}

export function encodeCursor(createdAt: string, id: number): string {
  return Buffer.from(`${createdAt}|${id}`).toString("base64url")
}

export function decodeCursor(cursor: string): { createdAt: string; id: number } | null {
  try {
    const [createdAt, idRaw] = Buffer.from(cursor, "base64url").toString("utf8").split("|")
    const id = Number(idRaw)
    if (!createdAt || !Number.isInteger(id)) return null
    return { createdAt, id }
  } catch {
    return null
  }
}
