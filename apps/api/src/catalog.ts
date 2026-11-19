import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { requireBilling } from "./billingAuth.ts"
import { pool } from "./db.ts"
import { sendError } from "./http.ts"

const orderTypes = z.array(z.enum(["dine_in", "pickup", "delivery"])).min(1)

export async function ensureCatalogSchema() {
  const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "../sql/004_catalog.sql")
  await pool.query(readFileSync(sqlPath, "utf8"))
}

export async function defaultTaxBps(outletId: number, fallback: number) {
  const row = await pool.query<{ rate_bps: number }>(
    `SELECT rate_bps FROM menu_taxes
     WHERE outlet_id = $1 AND is_default AND is_active
     ORDER BY id LIMIT 1`,
    [outletId],
  )
  return row.rows[0]?.rate_bps ?? fallback
}

function mapTax(row: {
  id: string
  title: string
  kind: string
  mode: string
  rate_bps: number
  order_types: string[]
  is_active: boolean
  is_default: boolean
}) {
  return {
    id: Number(row.id),
    title: row.title,
    kind: row.kind,
    mode: row.mode,
    rateBps: row.rate_bps,
    orderTypes: row.order_types,
    active: row.is_active,
    isDefault: row.is_default,
  }
}

export async function registerCatalogRoutes(app: FastifyInstance) {
  await ensureCatalogSchema()

  app.get("/api/v1/billing/catalog/taxes", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const rows = await pool.query(
      `SELECT id, title, kind, mode, rate_bps, order_types, is_active, is_default
       FROM menu_taxes WHERE outlet_id = $1 ORDER BY is_default DESC, title`,
      [session.outletId],
    )
    return { rows: rows.rows.map((row) => mapTax(row)) }
  })

  app.post("/api/v1/billing/catalog/taxes", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        title: z.string().trim().min(1).max(60),
        kind: z.enum(["gst", "vat", "custom"]),
        mode: z.enum(["forward", "backward"]).default("forward"),
        rateBps: z.number().int().min(0).max(10000),
        orderTypes: orderTypes.default(["dine_in", "pickup", "delivery"]),
        isDefault: z.boolean().default(false),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the tax and try again.")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      if (parsed.data.isDefault) {
        await client.query("UPDATE menu_taxes SET is_default = false WHERE outlet_id = $1", [session.outletId])
        await client.query("UPDATE outlets SET tax_rate_bps = $2 WHERE id = $1", [session.outletId, parsed.data.rateBps])
      }
      const row = await client.query(
        `INSERT INTO menu_taxes (outlet_id, title, kind, mode, rate_bps, order_types, is_default)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, title, kind, mode, rate_bps, order_types, is_active, is_default`,
        [
          session.outletId,
          parsed.data.title,
          parsed.data.kind,
          parsed.data.mode,
          parsed.data.rateBps,
          parsed.data.orderTypes,
          parsed.data.isDefault,
        ],
      )
      await client.query("COMMIT")
      return mapTax(row.rows[0]!)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  })

  app.put("/api/v1/billing/catalog/taxes/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z
      .object({
        active: z.boolean().optional(),
        isDefault: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the tax and try again.")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      if (parsed.data.isDefault) {
        await client.query("UPDATE menu_taxes SET is_default = false WHERE outlet_id = $1 AND id <> $2", [
          session.outletId,
          id,
        ])
      }
      const row = await client.query(
        `UPDATE menu_taxes SET
           is_active = COALESCE($3, is_active),
           is_default = COALESCE($4, is_default)
         WHERE id = $1 AND outlet_id = $2
         RETURNING id, title, kind, mode, rate_bps, order_types, is_active, is_default`,
        [id, session.outletId, parsed.data.active ?? null, parsed.data.isDefault ?? null],
      )
      if (!row.rowCount) {
        await client.query("ROLLBACK")
        return sendError(reply, 404, "NOT_FOUND", "Tax not found.")
      }
      const tax = row.rows[0]!
      if (tax.is_default && tax.is_active) {
        await client.query("UPDATE outlets SET tax_rate_bps = $2 WHERE id = $1", [session.outletId, tax.rate_bps])
      }
      await client.query("COMMIT")
      return mapTax(tax)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  })

  app.get("/api/v1/billing/catalog/discounts", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const rows = await pool.query(
      `SELECT id, title, kind, rate_bps, amount_paise, max_paise, applies_to, order_types, is_active
       FROM menu_discounts WHERE outlet_id = $1 ORDER BY title`,
      [session.outletId],
    )
    return { rows: rows.rows.map(mapDiscount) }
  })

  app.post("/api/v1/billing/catalog/discounts", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        title: z.string().trim().min(1).max(60),
        kind: z.enum(["percentage", "fixed"]),
        rateBps: z.number().int().min(0).max(10000).optional(),
        amountPaise: z.number().int().min(0).optional(),
        appliesTo: z.enum(["core", "total"]).default("core"),
        orderTypes: orderTypes.default(["dine_in", "pickup", "delivery"]),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the discount and try again.")
    if (parsed.data.kind === "percentage" && parsed.data.rateBps == null) {
      return sendError(reply, 400, "VALIDATION", "A percentage discount needs a rate.")
    }
    if (parsed.data.kind === "fixed" && parsed.data.amountPaise == null) {
      return sendError(reply, 400, "VALIDATION", "A fixed discount needs an amount.")
    }
    const row = await pool.query(
      `INSERT INTO menu_discounts (outlet_id, title, kind, rate_bps, amount_paise, applies_to, order_types)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, title, kind, rate_bps, amount_paise, max_paise, applies_to, order_types, is_active`,
      [
        session.outletId,
        parsed.data.title,
        parsed.data.kind,
        parsed.data.kind === "percentage" ? parsed.data.rateBps : null,
        parsed.data.kind === "fixed" ? parsed.data.amountPaise : null,
        parsed.data.appliesTo,
        parsed.data.orderTypes,
      ],
    )
    return mapDiscount(row.rows[0]!)
  })

  app.put("/api/v1/billing/catalog/discounts/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z.object({ active: z.boolean() }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the discount and try again.")
    const row = await pool.query(
      `UPDATE menu_discounts SET is_active = $3 WHERE id = $1 AND outlet_id = $2
       RETURNING id, title, kind, rate_bps, amount_paise, max_paise, applies_to, order_types, is_active`,
      [id, session.outletId, parsed.data.active],
    )
    if (!row.rowCount) return sendError(reply, 404, "NOT_FOUND", "Discount not found.")
    return mapDiscount(row.rows[0]!)
  })
}

function mapDiscount(row: {
  id: string
  title: string
  kind: string
  rate_bps: number | null
  amount_paise: number | null
  max_paise: number | null
  applies_to: string
  order_types: string[]
  is_active: boolean
}) {
  return {
    id: Number(row.id),
    title: row.title,
    kind: row.kind as "percentage" | "fixed",
    rateBps: row.rate_bps,
    amountPaise: row.amount_paise,
    maxPaise: row.max_paise,
    appliesTo: row.applies_to,
    orderTypes: row.order_types,
    active: row.is_active,
  }
}
