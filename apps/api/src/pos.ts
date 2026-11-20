import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { summarize } from "@rea/pricing"
import { pool } from "./db.ts"
import { redis } from "./redis.ts"
import { sendError } from "./http.ts"
import { loadOutletSettings } from "./config.ts"
import { defaultTaxBps } from "./catalog.ts"
import { consumeSettledOrder } from "./inventory.ts"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const COOKIE = "rea_billing_session"

type BillingSession = {
  adminId: number
  adminName: string
  email: string
  outletId: number
  outletName: string
  timezone: string
}

async function readBillingSession(request: FastifyRequest): Promise<BillingSession | null> {
  const header = request.headers.cookie
  if (!header) return null
  let token: string | null = null
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === COOKIE) token = decodeURIComponent(rest.join("="))
  }
  if (!token) return null
  const raw = await redis.get(`billing-session:${token}`)
  if (!raw) return null
  return JSON.parse(raw) as BillingSession
}

async function requirePos(request: FastifyRequest, reply: FastifyReply) {
  const session = await readBillingSession(request)
  if (!session) {
    await sendError(reply, 401, "UNAUTHENTICATED", "Sign in to continue.")
    return null
  }
  return session
}

function businessDateIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  }).format(now)
}

function pgDateToIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  const raw = String(value)
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]!
  throw new Error(`Invalid business date: ${raw}`)
}

const lineSchema = z.object({
  menuItemId: z.number().int().positive(),
  qty: z.number().int().min(1).max(99),
  note: z.string().trim().max(200).optional(),
  variantId: z.number().int().positive().optional(),
  addonIds: z.array(z.number().int().positive()).max(12).optional(),
})

const draftSchema = z.object({
  orderType: z.enum(["dine_in", "pickup", "delivery"]),
  tableLabel: z.string().trim().max(20).optional(),
  customerName: z.string().trim().max(80).optional(),
  customerPhone: z.string().trim().max(20).optional(),
  pax: z.number().int().min(1).max(99).optional(),
  note: z.string().trim().max(300).optional(),
  discountPaise: z.number().int().min(0).optional(),
  lines: z.array(lineSchema).min(1).max(40),
})

function coverLetter(tableNo: string, label: string) {
  if (!label.startsWith(tableNo) || label.length !== tableNo.length + 1) return null
  const letter = label.slice(tableNo.length)
  return /^[A-Z]$/.test(letter) ? letter : null
}

type SqlClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }

/** One physical table holds many open bills, named 1A, 1B, 1C. A bare table number takes the next free letter. */
async function claimGuestLabel(
  client: SqlClient,
  outletId: number,
  requested: string | undefined,
  exceptOrderId?: number,
): Promise<string | null> {
  const label = requested?.trim()
  if (!label) return null
  const tables = await client.query<{ table_no: string }>(
    "SELECT table_no FROM pos_tables WHERE outlet_id = $1 AND is_active",
    [outletId],
  )
  const tableNo = tables.rows
    .map((row) => row.table_no)
    .sort((a, b) => b.length - a.length)
    .find((no) => label === no || coverLetter(no, label))
  if (!tableNo) return label

  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${outletId}:table:${tableNo}`])
  const open = await client.query<{ id: string; table_label: string }>(
    `SELECT id, table_label FROM orders
     WHERE outlet_id = $1 AND status IN ('saved', 'printed') AND table_label IS NOT NULL`,
    [outletId],
  )
  const used = new Set(
    open.rows
      .filter((row) => Number(row.id) !== exceptOrderId)
      .map((row) => coverLetter(tableNo, row.table_label))
      .filter((letter): letter is string => Boolean(letter)),
  )
  const requestedLetter = coverLetter(tableNo, label)
  if (requestedLetter) {
    if (used.has(requestedLetter)) {
      throw Object.assign(new Error(`Guest ${requestedLetter} already has an open order on table ${tableNo}`), {
        code: "SEAT_TAKEN",
      })
    }
    return `${tableNo}${requestedLetter}`
  }
  for (let index = 0; index < 26; index += 1) {
    const letter = String.fromCharCode(65 + index)
    if (!used.has(letter)) return `${tableNo}${letter}`
  }
  throw Object.assign(new Error("This table already has a guest for every letter"), { code: "TABLE_FULL" })
}

export async function ensurePosSchema() {
  const base = dirname(fileURLToPath(import.meta.url))
  await pool.query(readFileSync(join(base, "../sql/002_pos.sql"), "utf8"))
  await pool.query(readFileSync(join(base, "../sql/004_floor_plans.sql"), "utf8"))
  const tables = await pool.query("SELECT 1 FROM pos_tables LIMIT 1")
  if (!tables.rowCount) {
    const outlet = await pool.query<{ id: string }>("SELECT id FROM outlets ORDER BY id LIMIT 1")
    if (outlet.rowCount) {
      const outletId = Number(outlet.rows[0]!.id)
      const { ensureOutletFloorPlan } = await import("./config.ts")
      const floorPlanId = await ensureOutletFloorPlan(outletId)
      for (const [area, nos] of [
        ["AC", ["1", "2", "3", "4"]],
        ["Non AC", ["5", "6", "7", "8"]],
        ["Family", ["9", "10"]],
      ] as const) {
        for (const tableNo of nos) {
          await pool.query(
            `INSERT INTO pos_tables (outlet_id, floor_plan_id, area_name, table_no, seats)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
            [outletId, floorPlanId, area, tableNo, area === "Family" ? 6 : 4],
          )
        }
      }
    }
  }
}

type Draft = z.infer<typeof draftSchema>

async function priceLines(outletId: number, lines: Draft["lines"], discountPaise: number, taxRateBps: number) {
  const merged = new Map<string, { menuItemId: number; qty: number; note?: string; variantId?: number; addonIds: number[] }>()
  for (const line of lines) {
    const note = line.note?.trim() ?? ""
    const addonIds = [...(line.addonIds ?? [])].sort((a, b) => a - b)
    const key = `${line.menuItemId}:${line.variantId ?? 0}:${addonIds.join(",")}:${note}`
    const cur = merged.get(key)
    if (cur) cur.qty += line.qty
    else merged.set(key, { menuItemId: line.menuItemId, qty: line.qty, note: note || undefined, variantId: line.variantId, addonIds })
  }
  const mergedLines = [...merged.values()]
  const ids = mergedLines.map((l) => l.menuItemId)
  const found = await pool.query<{ id: string; name: string; price_paise: number; is_available: boolean }>(
    `SELECT id, name, price_paise, is_available FROM menu_items
     WHERE outlet_id = $1 AND id = ANY($2::bigint[])`,
    [outletId, ids],
  )
  const byId = new Map(found.rows.map((r) => [Number(r.id), r]))
  const priced = []
  for (const line of mergedLines) {
    const item = byId.get(line.menuItemId)
    if (!item || !item.is_available) {
      throw Object.assign(new Error("ITEM_UNAVAILABLE"), { code: "ITEM_UNAVAILABLE", itemId: line.menuItemId })
    }
    let unitPrice = item.price_paise
    let label = item.name
    if (line.variantId) {
      const variant = await pool.query<{ name: string; price: number }>(
        `SELECT v.name, COALESCE(iv.price_paise, v.price_paise) AS price
         FROM item_variants iv
         JOIN menu_variants v ON v.id = iv.variant_id
         WHERE iv.item_id = $1 AND iv.variant_id = $2 AND v.outlet_id = $3 AND v.is_active`,
        [line.menuItemId, line.variantId, outletId],
      )
      if (!variant.rowCount) {
        throw Object.assign(new Error("ITEM_UNAVAILABLE"), { code: "ITEM_UNAVAILABLE", itemId: line.menuItemId })
      }
      unitPrice = variant.rows[0]!.price
      label = `${item.name} (${variant.rows[0]!.name})`
    }
    if (line.addonIds.length) {
      const addons = await pool.query<{ name: string; price_paise: number }>(
        `SELECT a.name, a.price_paise
         FROM addon_items a
         JOIN addon_groups g ON g.id = a.group_id
         JOIN item_addon_groups ig ON ig.group_id = g.id
         WHERE ig.item_id = $1 AND a.id = ANY($2::bigint[]) AND g.outlet_id = $3 AND a.is_active AND g.is_active`,
        [line.menuItemId, line.addonIds, outletId],
      )
      if (addons.rowCount !== line.addonIds.length) {
        throw Object.assign(new Error("ITEM_UNAVAILABLE"), { code: "ITEM_UNAVAILABLE", itemId: line.menuItemId })
      }
      unitPrice += addons.rows.reduce((sum, row) => sum + row.price_paise, 0)
      label = `${label} + ${addons.rows.map((row) => row.name).join(", ")}`
    }
    priced.push({
      menuItemId: line.menuItemId,
      name: label,
      unitPricePaise: unitPrice,
      qty: line.qty,
      note: line.note ?? null,
      lineTotalPaise: unitPrice * line.qty,
    })
  }
  const summary = summarize(
    priced.map((l) => ({ unitPricePaise: l.unitPricePaise, qty: l.qty })),
    taxRateBps,
  )
  const discount = Math.min(discountPaise, summary.subtotalPaise)
  const taxable = Math.max(0, summary.subtotalPaise - discount)
  const taxPaise = Math.round((taxable * taxRateBps) / 10_000)
  return {
    priced,
    summary: {
      itemCount: summary.itemCount,
      subtotalPaise: summary.subtotalPaise,
      discountPaise: discount,
      taxPaise,
      totalPaise: taxable + taxPaise,
    },
  }
}

async function nextOrderNo(client: typeof pool, outletId: number, businessDate: string) {
  const result = await client.query<{ last_no: number }>(
    `INSERT INTO order_counters (outlet_id, business_date, last_no)
     VALUES ($1, $2, 1)
     ON CONFLICT (outlet_id, business_date)
     DO UPDATE SET last_no = order_counters.last_no + 1
     RETURNING last_no`,
    [outletId, businessDate],
  )
  return result.rows[0]!.last_no
}

async function nextKotNo(client: typeof pool, outletId: number, businessDate: string) {
  const result = await client.query<{ last_no: number }>(
    `INSERT INTO kot_counters (outlet_id, business_date, last_no)
     VALUES ($1, $2, 1)
     ON CONFLICT (outlet_id, business_date)
     DO UPDATE SET last_no = GREATEST(
       kot_counters.last_no + 1,
       COALESCE((SELECT MAX(kot_no) FROM kots WHERE outlet_id = kot_counters.outlet_id), 0) + 1
     )
     RETURNING last_no`,
    [outletId, businessDate],
  )
  return result.rows[0]!.last_no
}

async function insertLines(
  client: { query: typeof pool.query },
  outletId: number,
  orderId: number,
  lines: { menuItemId: number; name: string; unitPricePaise: number; qty: number; note: string | null; lineTotalPaise: number }[],
) {
  const inserted: { id: number; name: string; qty: number; note: string | null }[] = []
  for (const [index, line] of lines.entries()) {
    const row = await client.query<{ id: string }>(
      `INSERT INTO order_items (
         order_id, outlet_id, menu_item_id, item_name, unit_price_paise, qty, line_total_paise, note, sort_rank
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        orderId,
        outletId,
        line.menuItemId,
        line.name,
        line.unitPricePaise,
        line.qty,
        line.lineTotalPaise,
        line.note,
        index,
      ],
    )
    inserted.push({ id: Number(row.rows[0]!.id), name: line.name, qty: line.qty, note: line.note })
  }
  return inserted
}

async function createKot(
  client: { query: typeof pool.query },
  outletId: number,
  orderId: number,
  businessDate: string,
  items: { id: number; name: string; qty: number; note: string | null }[],
) {
  const punched = await client.query<{ item_name: string; note: string | null; qty: number }>(
    `SELECT ki.item_name, ki.note, SUM(ki.qty)::int AS qty
     FROM kot_items ki JOIN kots k ON k.id = ki.kot_id
     WHERE k.order_id = $1 AND k.status <> 'cancelled'
     GROUP BY ki.item_name, ki.note`,
    [orderId],
  )
  const already = new Map(punched.rows.map((row) => [`${row.item_name}\0${row.note ?? ""}`, Number(row.qty)]))
  const deltas = items.flatMap((item) => {
    const extra = item.qty - (already.get(`${item.name}\0${item.note ?? ""}`) ?? 0)
    return extra > 0 ? [{ ...item, qty: extra }] : []
  })
  if (deltas.length === 0) {
    const last = await client.query<{ kot_no: number }>(
      `SELECT kot_no FROM kots WHERE order_id = $1 AND status <> 'cancelled' ORDER BY id DESC LIMIT 1`,
      [orderId],
    )
    return last.rowCount ? Number(last.rows[0]!.kot_no) : null
  }
  let kotNo = 0
  let kotId = 0
  for (let attempt = 0; attempt < 8; attempt++) {
    kotNo = await nextKotNo(client, outletId, businessDate)
    const prior = await client.query("SELECT 1 FROM kots WHERE order_id = $1 LIMIT 1", [orderId])
    const kot = await client.query<{ id: string }>(
      `INSERT INTO kots (outlet_id, order_id, kot_no, status, is_modified)
       VALUES ($1,$2,$3,'active',$4)
       ON CONFLICT (outlet_id, order_id, kot_no) DO NOTHING
       RETURNING id`,
      [outletId, orderId, kotNo, Boolean(prior.rowCount)],
    )
    if (kot.rowCount) {
      kotId = Number(kot.rows[0]!.id)
      break
    }
  }
  if (!kotId) throw Object.assign(new Error("Could not issue a KOT number"), { code: "KOT_NUMBER" })
  for (const item of deltas) {
    await client.query(
      `INSERT INTO kot_items (kot_id, order_item_id, item_name, qty, note) VALUES ($1,$2,$3,$4,$5)`,
      [kotId, item.id, item.name, item.qty, item.note],
    )
  }
  await client.query(`UPDATE orders SET kot_no = $2 WHERE id = $1`, [orderId, kotNo])
  return kotNo
}

async function markKotsUsed(client: { query: typeof pool.query }, orderId: number) {
  await client.query(
    `UPDATE kots SET status = 'used_in_bill' WHERE order_id = $1 AND status = 'active'`,
    [orderId],
  )
}

function mapOrder(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    orderNo: Number(row.order_no),
    status: String(row.status),
    orderType: String(row.order_type),
    tableLabel: (row.table_label as string | null) ?? null,
    customerName: (row.customer_name as string | null) ?? null,
    customerPhone: (row.customer_phone as string | null) ?? null,
    pax: Number(row.pax ?? 1),
    note: (row.note as string | null) ?? null,
    paymentType: String(row.payment_type ?? "not_paid"),
    paidPaise: Number(row.paid_paise ?? 0),
    changePaise: Number(row.change_paise ?? 0),
    itemCount: Number(row.item_count),
    subtotalPaise: Number(row.subtotal_paise),
    discountPaise: Number(row.discount_paise ?? 0),
    taxPaise: Number(row.tax_paise),
    totalPaise: Number(row.total_paise),
    kotNo: row.kot_no == null ? null : Number(row.kot_no),
    version: Number(row.version),
    billerName: (row.biller_name as string | null) ?? null,
    cancelReason: (row.cancel_reason as string | null) ?? null,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
    printedAt: row.printed_at ? new Date(row.printed_at as string | Date).toISOString() : null,
    settledAt: row.settled_at ? new Date(row.settled_at as string | Date).toISOString() : null,
  }
}

export async function registerPosRoutes(app: FastifyInstance) {
  await ensurePosSchema()

  app.get("/api/v1/billing/pos/bootstrap", async (request, reply) => {
    const session = await requirePos(request, reply)
    if (!session) return
    const outlet = await pool.query<{ name: string; tax_rate_bps: number; timezone: string }>(
      "SELECT name, tax_rate_bps, timezone FROM outlets WHERE id = $1",
      [session.outletId],
    )
    const cfg = await loadOutletSettings(session.outletId)
    const categories = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM menu_categories WHERE outlet_id = $1 AND is_active ORDER BY sort_rank, id`,
      [session.outletId],
    )
    const items = await pool.query<{
      id: string
      category_id: string
      name: string
      short_code: string | null
      price_paise: number
      dietary: string
    }>(
      `SELECT id, category_id, name, short_code, price_paise, dietary
       FROM menu_items WHERE outlet_id = $1 AND is_available
       ORDER BY sort_rank, id`,
      [session.outletId],
    )
    const variantRows = await pool.query<{ item_id: string; variant_id: string; name: string; price: number }>(
      `SELECT iv.item_id, iv.variant_id, v.name, COALESCE(iv.price_paise, v.price_paise) AS price
       FROM item_variants iv
       JOIN menu_variants v ON v.id = iv.variant_id
       JOIN menu_items i ON i.id = iv.item_id
       WHERE i.outlet_id = $1 AND v.is_active`,
      [session.outletId],
    )
    const addonRows = await pool.query<{
      item_id: string
      group_id: string
      group_name: string
      min_select: number
      max_select: number
      addon_id: string
      addon_name: string
      price_paise: number
    }>(
      `SELECT ig.item_id, g.id AS group_id, g.name AS group_name, g.min_select, g.max_select,
              a.id AS addon_id, a.name AS addon_name, a.price_paise
       FROM item_addon_groups ig
       JOIN addon_groups g ON g.id = ig.group_id
       JOIN addon_items a ON a.group_id = g.id
       JOIN menu_items i ON i.id = ig.item_id
       WHERE i.outlet_id = $1 AND g.is_active AND a.is_active
       ORDER BY g.name, a.name`,
      [session.outletId],
    )
    const tables = await pool.query<{
      id: string
      area_name: string
      table_no: string
      seats: number
      pos_x: number
      pos_y: number
      width: number
      height: number
      shape: string
      text_size: number
      placed: boolean
    }>(
      `SELECT t.id, t.area_name, t.table_no, t.seats, t.pos_x, t.pos_y, t.width, t.height, t.shape, t.text_size, t.placed,
              fp.name AS floor_plan_name
       FROM pos_tables t
       JOIN floor_plans fp ON fp.id = t.floor_plan_id AND fp.is_active
       WHERE t.outlet_id = $1 AND t.is_active ORDER BY fp.name, t.area_name, t.table_no`,
      [session.outletId],
    )
    const occupied = await pool.query<{
      table_label: string
      id: string
      order_no: number
      status: string
      total_paise: number
      customer_name: string | null
    }>(
      `SELECT DISTINCT ON (table_label) table_label, id, order_no, status, total_paise, customer_name
       FROM orders
       WHERE outlet_id = $1 AND status IN ('saved','printed') AND table_label IS NOT NULL
       ORDER BY table_label, updated_at DESC`,
      [session.outletId],
    )
    const busy = new Map(occupied.rows.map((r) => [r.table_label, r]))
    const barriers = await pool.query<{ id: string; pos_x: number; pos_y: number; width: number; height: number }>(
      `SELECT b.id, b.pos_x, b.pos_y, b.width, b.height
       FROM floor_barriers b
       JOIN floor_plans fp ON fp.id = b.floor_plan_id AND fp.is_active
       WHERE b.outlet_id = $1 ORDER BY b.id`,
      [session.outletId],
    )
    const discounts = await pool.query<{
      id: string
      title: string
      kind: "percentage" | "fixed"
      rate_bps: number | null
      amount_paise: number | null
    }>(
      `SELECT id, title, kind, rate_bps, amount_paise FROM menu_discounts
       WHERE outlet_id = $1 AND is_active AND kind IN ('percentage', 'fixed')
       ORDER BY title`,
      [session.outletId],
    )
    return {
      outlet: {
        id: session.outletId,
        name: outlet.rows[0]?.name ?? session.outletName,
        taxRateBps: await defaultTaxBps(session.outletId, outlet.rows[0]?.tax_rate_bps ?? 500),
        timezone: outlet.rows[0]?.timezone ?? session.timezone,
        billerName: session.adminName,
      },
      settings: {
        orderTypeLabels: {
          dine_in: cfg.display.dineInLabel,
          pickup: cfg.display.pickupLabel,
          delivery: cfg.display.deliveryLabel,
        },
        showOrderTypes: {
          dine_in: cfg.display.showDineIn,
          pickup: cfg.display.showPickup,
          delivery: cfg.display.showDelivery,
        },
        paymentButtons: cfg.display.paymentButtons,
        defaultOrderType: cfg.display.defaultOrderType as "dine_in" | "pickup" | "delivery",
        defaultQty: cfg.display.defaultQty,
        mergeDuplicateItems: cfg.display.mergeDuplicateItems,
        saveKotOnSaveBill: cfg.display.saveKotOnSaveBill,
        defaultScreen: cfg.display.defaultScreen as "tables" | "billing",
        showItemPrice: cfg.display.showItemPrice,
        personsMandatory: cfg.display.personsMandatory,
        orderInfoLabel: cfg.display.orderInfoLabel,
        discountLabel: cfg.display.discountLabel,
      },
      categories: categories.rows.map((c) => ({ id: Number(c.id), name: c.name })),
      items: items.rows.map((i) => ({
        id: Number(i.id),
        categoryId: Number(i.category_id),
        name: i.name,
        shortCode: i.short_code,
        pricePaise: i.price_paise,
        dietary: i.dietary,
        variants: variantRows.rows
          .filter((row) => Number(row.item_id) === Number(i.id))
          .map((row) => ({ id: Number(row.variant_id), name: row.name, pricePaise: row.price })),
        addonGroups: [...new Set(addonRows.rows.filter((row) => Number(row.item_id) === Number(i.id)).map((row) => Number(row.group_id)))].map(
          (groupId) => {
            const rows = addonRows.rows.filter((row) => Number(row.item_id) === Number(i.id) && Number(row.group_id) === groupId)
            const head = rows[0]!
            return {
              id: groupId,
              name: head.group_name,
              minSelect: head.min_select,
              maxSelect: head.max_select,
              items: rows.map((row) => ({ id: Number(row.addon_id), name: row.addon_name, pricePaise: row.price_paise })),
            }
          },
        ),
      })),
      tables: tables.rows.map((t) => {
        const running = busy.get(t.table_no)
        const covers = [...busy.entries()]
          .map(([label, order]) => {
            const letter = coverLetter(t.table_no, label)
            if (!letter) return null
            return {
              letter,
              label,
              orderId: Number(order.id),
              orderNo: Number(order.order_no),
              status: order.status,
              totalPaise: Number(order.total_paise),
              customerName: order.customer_name,
            }
          })
          .filter((cover): cover is NonNullable<typeof cover> => cover !== null)
          .sort((a, b) => a.letter.localeCompare(b.letter))
        const guestRunning = covers.some((cover) => cover.status !== "printed")
        return {
          id: Number(t.id),
          area: t.area_name,
          tableNo: t.table_no,
          seats: t.seats,
          occupied: covers.length > 0 || Boolean(running),
          orderId: running ? Number(running.id) : null,
          orderNo: running ? Number(running.order_no) : null,
          status: covers.length === 0 ? (running ? running.status : null) : guestRunning ? "saved" : "printed",
          totalPaise: covers.length
            ? covers.reduce((sum, cover) => sum + cover.totalPaise, 0)
            : running
              ? Number(running.total_paise)
              : null,
          x: t.pos_x,
          y: t.pos_y,
          width: t.width,
          height: t.height,
          shape: t.shape,
          textSize: t.text_size,
          placed: t.placed,
          covers,
        }
      }),
      barriers: barriers.rows.map((row) => ({
        id: Number(row.id),
        x: row.pos_x,
        y: row.pos_y,
        width: row.width,
        height: row.height,
      })),
      discounts: discounts.rows.map((row) => ({
        id: Number(row.id),
        title: row.title,
        kind: row.kind,
        rateBps: row.rate_bps,
        amountPaise: row.amount_paise,
      })),
    }
  })

  app.post("/api/v1/billing/pos/orders", async (request, reply) => {
    const session = await requirePos(request, reply)
    if (!session) return
    const parsed = draftSchema
      .extend({
        action: z.enum(["save", "kot", "kot_print", "save_print", "settle"]),
        paymentType: z.enum(["not_paid", "cash", "card", "upi", "due", "other"]).optional(),
        paidPaise: z.number().int().min(0).optional(),
        idempotencyKey: z.string().min(8).max(80),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the order and try again.")

    const key = `${session.outletId}:pos:${parsed.data.idempotencyKey}`
    const existing = await pool.query<{ response_status: number; response_body: unknown; request_hash: string }>(
      "SELECT response_status, response_body, request_hash FROM idempotency_keys WHERE key = $1",
      [key],
    )
    const requestHash = JSON.stringify({
      action: parsed.data.action,
      draft: parsed.data,
    })
    if (existing.rowCount) {
      const prior = existing.rows[0]!
      if (prior.request_hash !== requestHash) {
        return sendError(reply, 409, "IDEMPOTENCY_CONFLICT", "This save key was already used.")
      }
      return reply.status(prior.response_status).send(prior.response_body)
    }

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const outlet = await client.query<{ tax_rate_bps: number; timezone: string }>(
        "SELECT tax_rate_bps, timezone FROM outlets WHERE id = $1",
        [session.outletId],
      )
      const taxRateBps = await defaultTaxBps(session.outletId, outlet.rows[0]?.tax_rate_bps ?? 500)
      const timezone = outlet.rows[0]?.timezone ?? "Asia/Kolkata"
      const businessDate = businessDateIn(timezone)
      const priced = await priceLines(
        session.outletId,
        parsed.data.lines,
        parsed.data.discountPaise ?? 0,
        taxRateBps,
      )

      if (parsed.data.orderType === "dine_in" && !parsed.data.tableLabel?.trim()) {
        throw Object.assign(new Error("Table is required for dine-in"), { code: "TABLE_REQUIRED" })
      }

      let status: "saved" | "printed" | "settled" = "saved"
      let paymentType = parsed.data.paymentType ?? "not_paid"
      let paidPaise = parsed.data.paidPaise ?? 0
      let changePaise = 0
      let printedAt: string | null = null
      let settledAt: string | null = null

      if (parsed.data.action === "save_print" || parsed.data.action === "kot_print") {
        status = "printed"
        printedAt = new Date().toISOString()
      }
      if (parsed.data.action === "settle") {
        status = "settled"
        paymentType = parsed.data.paymentType && parsed.data.paymentType !== "not_paid" ? parsed.data.paymentType : "cash"
        paidPaise = parsed.data.paidPaise ?? priced.summary.totalPaise
        if (paidPaise < priced.summary.totalPaise) {
          throw Object.assign(new Error("Paid amount is less than bill total"), { code: "UNDERPAID" })
        }
        changePaise = paidPaise - priced.summary.totalPaise
        settledAt = new Date().toISOString()
        printedAt = printedAt ?? settledAt
      }

      const tableLabel =
        parsed.data.orderType === "dine_in"
          ? await claimGuestLabel(client, session.outletId, parsed.data.tableLabel)
          : parsed.data.tableLabel?.trim() || null
      const guestLetter = tableLabel?.slice(-1) ?? ""
      const customerName =
        parsed.data.customerName?.trim() ||
        (tableLabel && tableLabel.length > 1 && /^[A-Z]$/.test(guestLetter) ? `Guest ${guestLetter}` : null)

      const orderNo = await nextOrderNo(client, session.outletId, businessDate)
      const inserted = await client.query(
        `INSERT INTO orders (
           outlet_id, order_no, business_date, order_type, status, table_label, customer_name, customer_phone,
           pax, note, payment_type, paid_paise, change_paise, discount_paise,
           item_count, subtotal_paise, tax_paise, total_paise, biller_name, printed_at, settled_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
         ) RETURNING *`,
        [
          session.outletId,
          orderNo,
          businessDate,
          parsed.data.orderType,
          status,
          tableLabel,
          customerName,
          parsed.data.customerPhone?.trim() || null,
          parsed.data.pax ?? 1,
          parsed.data.note?.trim() || null,
          paymentType,
          paidPaise,
          changePaise,
          priced.summary.discountPaise,
          priced.summary.itemCount,
          priced.summary.subtotalPaise,
          priced.summary.taxPaise,
          priced.summary.totalPaise,
          session.adminName,
          printedAt,
          settledAt,
        ],
      )
      const order = inserted.rows[0]!
      const lineRows = await insertLines(client, session.outletId, Number(order.id), priced.priced)
      let kotNo: number | null = null
      if (["kot", "kot_print", "save_print", "settle", "save"].includes(parsed.data.action)) {
        kotNo = await createKot(client, session.outletId, Number(order.id), businessDate, lineRows)
        order.kot_no = kotNo
      }
      if (parsed.data.action === "settle") {
        await markKotsUsed(client, Number(order.id))
      }

      if (status === "settled") await consumeSettledOrder(client, session.outletId, Number(order.id))
      const body = { ...mapOrder(order), lines: priced.priced, kotNo }
      await client.query(
        `INSERT INTO idempotency_keys (key, outlet_id, request_hash, response_status, response_body)
         VALUES ($1,$2,$3,201,$4::jsonb)`,
        [key, session.outletId, requestHash, JSON.stringify(body)],
      )
      await client.query("COMMIT")
      return reply.status(201).send(body)
    } catch (error) {
      await client.query("ROLLBACK")
      const code = error && typeof error === "object" && "code" in error ? String((error as { code: string }).code) : ""
      if (code === "ITEM_UNAVAILABLE") return sendError(reply, 409, code, "One of those dishes is no longer available")
      if (code === "TABLE_REQUIRED") return sendError(reply, 400, code, "Select a table for dine-in")
      if (code === "UNDERPAID") return sendError(reply, 400, code, "Paid amount is less than bill total")
      if (code === "SEAT_TAKEN" || code === "TABLE_FULL") {
        return sendError(reply, 409, code, error instanceof Error ? error.message : "That seat is already open")
      }
      throw error
    } finally {
      client.release()
    }
  })

  app.put("/api/v1/billing/pos/orders/:id", async (request, reply) => {
    const session = await requirePos(request, reply)
    if (!session) return
    const orderId = Number((request.params as { id: string }).id)
    const parsed = draftSchema
      .extend({
        version: z.number().int().positive(),
        action: z.enum(["save", "kot", "kot_print", "save_print", "settle"]).optional(),
        paymentType: z.enum(["not_paid", "cash", "card", "upi", "due", "other"]).optional(),
        paidPaise: z.number().int().min(0).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the order and try again.")

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const current = await client.query(
        `SELECT * FROM orders WHERE id = $1 AND outlet_id = $2 FOR UPDATE`,
        [orderId, session.outletId],
      )
      const row = current.rows[0]
      if (!row) {
        await client.query("ROLLBACK")
        return sendError(reply, 404, "NOT_FOUND", "Order not found")
      }
      if (!["saved", "printed"].includes(row.status)) {
        await client.query("ROLLBACK")
        return sendError(reply, 409, "ORDER_CLOSED", "Only saved/printed orders can be edited")
      }
      if (Number(row.version) !== parsed.data.version) {
        await client.query("ROLLBACK")
        return sendError(reply, 409, "VERSION_CONFLICT", "Order was updated elsewhere. Reload it.")
      }

      const outlet = await client.query<{ tax_rate_bps: number; timezone: string }>(
        "SELECT tax_rate_bps, timezone FROM outlets WHERE id = $1",
        [session.outletId],
      )
      const priced = await priceLines(
        session.outletId,
        parsed.data.lines,
        parsed.data.discountPaise ?? 0,
        await defaultTaxBps(session.outletId, outlet.rows[0]?.tax_rate_bps ?? 500),
      )

      let status = row.status as string
      let paymentType = row.payment_type as string
      let paidPaise = Number(row.paid_paise)
      let changePaise = Number(row.change_paise)
      let printedAt = row.printed_at
      let settledAt = row.settled_at
      const action = parsed.data.action ?? "save"

      if (action === "save_print" || action === "kot_print") {
        status = "printed"
        printedAt = printedAt ?? new Date()
      }
      if (action === "settle") {
        status = "settled"
        paymentType = parsed.data.paymentType && parsed.data.paymentType !== "not_paid" ? parsed.data.paymentType : "cash"
        paidPaise = parsed.data.paidPaise ?? priced.summary.totalPaise
        if (paidPaise < priced.summary.totalPaise) {
          await client.query("ROLLBACK")
          return sendError(reply, 400, "UNDERPAID", "Paid amount is less than bill total")
        }
        changePaise = paidPaise - priced.summary.totalPaise
        settledAt = new Date()
        printedAt = printedAt ?? settledAt
      }

      await client.query(
        `UPDATE kot_items SET order_item_id = NULL
         WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)`,
        [orderId],
      )
      await client.query("DELETE FROM order_items WHERE order_id = $1", [orderId])
      const lineRows = await insertLines(client, session.outletId, orderId, priced.priced)

      if (["kot", "kot_print", "save", "save_print"].includes(action)) {
        await createKot(client, session.outletId, orderId, pgDateToIso(row.business_date), lineRows)
      }
      if (action === "settle") {
        await markKotsUsed(client, orderId)
      }

      const updated = await client.query(
        `UPDATE orders SET
           order_type=$3, table_label=$4, customer_name=$5, customer_phone=$6, pax=$7, note=$8,
           status=$9, payment_type=$10, paid_paise=$11, change_paise=$12, discount_paise=$13,
           item_count=$14, subtotal_paise=$15, tax_paise=$16, total_paise=$17,
           printed_at=$18, settled_at=$19, version=version+1, updated_at=now()
         WHERE id=$1 AND outlet_id=$2
         RETURNING *`,
        [
          orderId,
          session.outletId,
          parsed.data.orderType,
          parsed.data.tableLabel?.trim() || null,
          parsed.data.customerName?.trim() || null,
          parsed.data.customerPhone?.trim() || null,
          parsed.data.pax ?? 1,
          parsed.data.note?.trim() || null,
          status,
          paymentType,
          paidPaise,
          changePaise,
          priced.summary.discountPaise,
          priced.summary.itemCount,
          priced.summary.subtotalPaise,
          priced.summary.taxPaise,
          priced.summary.totalPaise,
          printedAt,
          settledAt,
        ],
      )
      if (status === "settled") await consumeSettledOrder(client, session.outletId, orderId)
      await client.query("COMMIT")
      return { ...mapOrder(updated.rows[0]!), lines: priced.priced }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  })

  app.post("/api/v1/billing/pos/orders/:id/cancel", async (request, reply) => {
    const session = await requirePos(request, reply)
    if (!session) return
    const orderId = Number((request.params as { id: string }).id)
    const parsed = z
      .object({ version: z.number().int().positive(), reason: z.string().trim().min(2).max(200) })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Cancel reason is required")

    const result = await pool.query(
      `UPDATE orders
       SET status='cancelled', cancel_reason=$4, version=version+1, updated_at=now()
       WHERE id=$1 AND outlet_id=$2 AND version=$3 AND status IN ('saved','printed')
       RETURNING id`,
      [orderId, session.outletId, parsed.data.version, parsed.data.reason],
    )
    if (!result.rowCount) return sendError(reply, 409, "VERSION_CONFLICT", "Could not cancel. Reload the order.")
    await pool.query(`UPDATE kots SET status='cancelled' WHERE order_id=$1`, [orderId])
    return { ok: true }
  })

  app.get("/api/v1/billing/pos/orders/:id", async (request, reply) => {
    const session = await requirePos(request, reply)
    if (!session) return
    const orderId = Number((request.params as { id: string }).id)
    const order = await pool.query(`SELECT * FROM orders WHERE id=$1 AND outlet_id=$2`, [orderId, session.outletId])
    if (!order.rowCount) return sendError(reply, 404, "NOT_FOUND", "Order not found")
    const lines = await pool.query(
      `SELECT menu_item_id, item_name, unit_price_paise, qty, line_total_paise, note
       FROM order_items WHERE order_id=$1 ORDER BY sort_rank, id`,
      [orderId],
    )
    return {
      ...mapOrder(order.rows[0]!),
      lines: lines.rows.map((l) => ({
        menuItemId: Number(l.menu_item_id),
        name: l.item_name,
        unitPricePaise: l.unit_price_paise,
        qty: l.qty,
        lineTotalPaise: l.line_total_paise,
        note: l.note,
      })),
    }
  })

  app.get("/api/v1/billing/pos/kots", async (request, reply) => {
    const session = await requirePos(request, reply)
    if (!session) return
    reply.header("cache-control", "no-store")
    const q = request.query as {
      status?: string
      orderType?: string
      tableNo?: string
      kotId?: string
      from?: string
      to?: string
      customer?: string
      modified?: string
      all?: string
    }
    const outlet = await pool.query<{ timezone: string }>("SELECT timezone FROM outlets WHERE id=$1", [session.outletId])
    const businessDate = businessDateIn(outlet.rows[0]?.timezone ?? session.timezone)
    const showAll = q.all === "1"
    const from = q.from || (showAll ? null : businessDate)
    const to = q.to || (showAll ? null : businessDate)
    const rows = await pool.query<{
      id: string
      kot_no: number
      status: string
      is_modified: boolean
      punched_at: Date
      order_id: string
      order_no: number
      order_type: string
      table_label: string | null
      customer_name: string | null
      customer_phone: string | null
      business_date: Date
      items: { name: string; qty: number; note: string | null }[] | null
    }>(
      `SELECT k.id, k.kot_no, k.status, k.is_modified, k.punched_at,
              o.id AS order_id, o.order_no, o.order_type, o.business_date,
              o.table_label, o.customer_name, o.customer_phone,
              COALESCE(
                json_agg(json_build_object('name', ki.item_name, 'qty', ki.qty, 'note', ki.note) ORDER BY ki.id)
                  FILTER (WHERE ki.id IS NOT NULL),
                '[]'
              ) AS items
       FROM kots k
       JOIN orders o ON o.id = k.order_id
       LEFT JOIN kot_items ki ON ki.kot_id = k.id
       WHERE k.outlet_id = $1
         AND ($2::date IS NULL OR o.business_date >= $2::date)
         AND ($3::date IS NULL OR o.business_date <= $3::date)
         AND ($4::text IS NULL OR k.status = $4)
         AND ($5::text IS NULL OR o.order_type = $5)
         AND ($6::text IS NULL OR o.table_label ILIKE $6)
         AND ($7::text IS NULL OR k.kot_no::text = $7)
         AND ($8::text IS NULL OR o.customer_name ILIKE '%' || $8 || '%' OR o.customer_phone ILIKE '%' || $8 || '%')
         AND ($9::boolean IS NULL OR k.is_modified = $9)
       GROUP BY k.id, o.id
       ORDER BY k.punched_at DESC, k.id DESC
       LIMIT 200`,
      [
        session.outletId,
        from,
        to,
        q.status && q.status !== "all" ? q.status : null,
        q.orderType && q.orderType !== "all" ? q.orderType : null,
        q.tableNo?.trim() ? q.tableNo.trim() : null,
        q.kotId?.trim() || null,
        q.customer?.trim() || null,
        q.modified === "modified" ? true : q.modified === "fresh" ? false : null,
      ],
    )
    return {
      businessDate,
      kots: rows.rows.map((row) => ({
        id: Number(row.id),
        kotNo: row.kot_no,
        status: row.status,
        modified: row.is_modified,
        punchedAt: new Date(row.punched_at).toISOString(),
        businessDate: pgDateToIso(row.business_date),
        orderId: Number(row.order_id),
        orderNo: row.order_no,
        orderType: row.order_type,
        tableLabel: row.table_label,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        items: row.items ?? [],
      })),
    }
  })

  app.post("/api/v1/billing/pos/orders/:id/move", async (request, reply) => {
    const session = await requirePos(request, reply)
    if (!session) return
    const orderId = Number((request.params as { id: string }).id)
    const parsed = z
      .object({
        version: z.number().int().positive(),
        tableLabel: z.string().trim().min(1).max(20),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Choose a table.")

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const current = await client.query(
        `SELECT id, version, status, table_label, order_type FROM orders WHERE id=$1 AND outlet_id=$2 FOR UPDATE`,
        [orderId, session.outletId],
      )
      const row = current.rows[0]
      if (!row) {
        await client.query("ROLLBACK")
        return sendError(reply, 404, "NOT_FOUND", "Order not found")
      }
      if (!["saved", "printed"].includes(row.status)) {
        await client.query("ROLLBACK")
        return sendError(reply, 409, "ORDER_CLOSED", "Only a running order can move tables")
      }
      if (Number(row.version) !== parsed.data.version) {
        await client.query("ROLLBACK")
        return sendError(reply, 409, "VERSION_CONFLICT", "Order was updated elsewhere. Reload it.")
      }
      let nextLabel: string | null
      try {
        nextLabel = await claimGuestLabel(client, session.outletId, parsed.data.tableLabel, orderId)
      } catch (error) {
        await client.query("ROLLBACK")
        const code = error && typeof error === "object" && "code" in error ? String((error as { code: string }).code) : ""
        if (code === "SEAT_TAKEN" || code === "TABLE_FULL") {
          return sendError(reply, 409, code, error instanceof Error ? error.message : "That seat is already open")
        }
        throw error
      }
      const updated = await client.query(
        `UPDATE orders
         SET table_label=$3, order_type='dine_in', version=version+1, updated_at=now()
         WHERE id=$1 AND outlet_id=$2
         RETURNING *`,
        [orderId, session.outletId, nextLabel],
      )
      await client.query(
        `UPDATE kots SET status='shifted' WHERE order_id=$1 AND status='active'`,
        [orderId],
      )
      await client.query("COMMIT")
      return mapOrder(updated.rows[0]!)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  })

  app.get("/api/v1/billing/pos/live", async (request, reply) => {
    const session = await requirePos(request, reply)
    if (!session) return
    reply.header("cache-control", "no-store")
    const rows = await pool.query(
      `SELECT * FROM orders
       WHERE outlet_id=$1 AND status IN ('saved','printed')
       ORDER BY updated_at DESC, id DESC
       LIMIT 100`,
      [session.outletId],
    )
    const orders = rows.rows.map(mapOrder)
    const runningAmount = orders.reduce((sum, o) => sum + o.totalPaise, 0)
    return {
      kpis: {
        runningOrderCount: orders.length,
        runningAmountPaise: runningAmount,
        pendingOrders: orders.filter((o) => o.status === "saved").length,
      },
      orders,
    }
  })

  app.get("/api/v1/billing/pos/orders", async (request, reply) => {
    const session = await requirePos(request, reply)
    if (!session) return
    reply.header("cache-control", "no-store")
    const q = request.query as {
      status?: string
      orderType?: string
      paymentType?: string
      invoiceId?: string
      customer?: string
      limit?: string
    }
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 50) || 50))
    const outlet = await pool.query<{ timezone: string }>("SELECT timezone FROM outlets WHERE id=$1", [
      session.outletId,
    ])
    const businessDate = businessDateIn(outlet.rows[0]?.timezone ?? session.timezone)
    const rows = await pool.query(
      `SELECT * FROM orders
       WHERE outlet_id=$1 AND business_date=$2
         AND ($3::text IS NULL OR status = $3)
         AND ($4::text IS NULL OR order_type = $4)
         AND ($5::text IS NULL OR payment_type = $5)
         AND ($6::text IS NULL OR order_no::text = $6)
         AND (
           $7::text IS NULL OR customer_name ILIKE '%'||$7||'%' OR COALESCE(customer_phone,'') ILIKE '%'||$7||'%'
         )
       ORDER BY created_at DESC, id DESC
       LIMIT $8`,
      [
        session.outletId,
        businessDate,
        q.status && q.status !== "all" ? q.status : null,
        q.orderType && q.orderType !== "all" ? q.orderType : null,
        q.paymentType && q.paymentType !== "all" ? q.paymentType : null,
        q.invoiceId?.trim() || null,
        q.customer?.trim() || null,
        limit,
      ],
    )
    return { orders: rows.rows.map(mapOrder), businessDate }
  })
}
