import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { writeAudit } from "./audit.ts"
import { requireBilling } from "./billingAuth.ts"
import { pool } from "./db.ts"
import { sendError } from "./http.ts"
import { redis } from "./redis.ts"

async function bumpMenu(outletId: number) {
  await pool.query("UPDATE outlets SET menu_version = menu_version + 1 WHERE id = $1", [outletId])
  await redis.del(`menu:${outletId}:version`)
}

const dietary = z.enum(["veg", "non_veg", "egg"])

export async function registerMenuAdminRoutes(app: FastifyInstance) {
  app.get("/api/v1/billing/menu", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const categories = await pool.query(
      `SELECT c.id, c.name, c.sort_rank, c.is_active,
              (SELECT count(*)::int FROM menu_items i WHERE i.category_id = c.id) AS item_count
       FROM menu_categories c WHERE c.outlet_id = $1 ORDER BY c.sort_rank, c.id`,
      [session.outletId],
    )
    const items = await pool.query(
      `SELECT id, category_id, name, short_code, price_paise, dietary, is_available, sort_rank
       FROM menu_items WHERE outlet_id = $1 ORDER BY sort_rank, id`,
      [session.outletId],
    )
    return {
      categories: categories.rows.map((row) => ({
        id: Number(row.id),
        name: row.name as string,
        sortRank: row.sort_rank as number,
        active: row.is_active as boolean,
        itemCount: row.item_count as number,
      })),
      items: items.rows.map((row) => ({
        id: Number(row.id),
        categoryId: Number(row.category_id),
        name: row.name as string,
        shortCode: (row.short_code as string | null) ?? "",
        pricePaise: row.price_paise as number,
        dietary: row.dietary as "veg" | "non_veg" | "egg",
        available: row.is_available as boolean,
      })),
    }
  })

  app.post("/api/v1/billing/menu/categories", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z.object({ name: z.string().trim().min(1).max(60) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Category name is required.")
    const rank = await pool.query<{ next: number }>(
      "SELECT COALESCE(MAX(sort_rank), 0) + 1 AS next FROM menu_categories WHERE outlet_id = $1",
      [session.outletId],
    )
    const row = await pool.query(
      `INSERT INTO menu_categories (outlet_id, name, sort_rank) VALUES ($1, $2, $3) RETURNING id`,
      [session.outletId, parsed.data.name, rank.rows[0]!.next],
    )
    await bumpMenu(session.outletId)
    return { id: Number(row.rows[0]!.id) }
  })

  app.put("/api/v1/billing/menu/categories/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z
      .object({ name: z.string().trim().min(1).max(60).optional(), active: z.boolean().optional() })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the category and try again.")
    const updated = await pool.query(
      `UPDATE menu_categories SET
         name = COALESCE($3, name),
         is_active = COALESCE($4, is_active)
       WHERE id = $1 AND outlet_id = $2`,
      [id, session.outletId, parsed.data.name ?? null, parsed.data.active ?? null],
    )
    if (!updated.rowCount) return sendError(reply, 404, "NOT_FOUND", "Category not found.")
    await bumpMenu(session.outletId)
    return { ok: true }
  })

  app.post("/api/v1/billing/menu/items", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(80),
        categoryId: z.number().int().positive(),
        pricePaise: z.number().int().min(0).max(10_000_000),
        shortCode: z.string().trim().max(12).optional(),
        dietary: dietary.default("veg"),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Name, category and price are required.")
    const category = await pool.query("SELECT id FROM menu_categories WHERE id = $1 AND outlet_id = $2", [
      parsed.data.categoryId,
      session.outletId,
    ])
    if (!category.rowCount) return sendError(reply, 400, "VALIDATION", "Pick a category from this outlet.")
    const row = await pool.query(
      `INSERT INTO menu_items (outlet_id, category_id, name, short_code, price_paise, dietary)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        session.outletId,
        parsed.data.categoryId,
        parsed.data.name,
        parsed.data.shortCode || null,
        parsed.data.pricePaise,
        parsed.data.dietary,
      ],
    )
    await bumpMenu(session.outletId)
    return { id: Number(row.rows[0]!.id) }
  })

  app.put("/api/v1/billing/menu/items/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        categoryId: z.number().int().positive().optional(),
        pricePaise: z.number().int().min(0).max(10_000_000).optional(),
        shortCode: z.string().trim().max(12).optional(),
        dietary: dietary.optional(),
        available: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the item and try again.")
    const current = await pool.query<{ name: string; is_available: boolean }>(
      "SELECT name, is_available FROM menu_items WHERE id = $1 AND outlet_id = $2",
      [id, session.outletId],
    )
    const updated = await pool.query(
      `UPDATE menu_items SET
         name = COALESCE($3, name),
         category_id = COALESCE($4, category_id),
         price_paise = COALESCE($5, price_paise),
         short_code = COALESCE($6, short_code),
         dietary = COALESCE($7, dietary),
         is_available = COALESCE($8, is_available)
       WHERE id = $1 AND outlet_id = $2`,
      [
        id,
        session.outletId,
        parsed.data.name ?? null,
        parsed.data.categoryId ?? null,
        parsed.data.pricePaise ?? null,
        parsed.data.shortCode ?? null,
        parsed.data.dietary ?? null,
        parsed.data.available ?? null,
      ],
    )
    if (!updated.rowCount) return sendError(reply, 404, "NOT_FOUND", "Item not found.")
    await bumpMenu(session.outletId)
    const before = current.rows[0]
    if (before && parsed.data.available !== undefined && parsed.data.available !== before.is_available) {
      await writeAudit({
        outletId: session.outletId,
        actorName: session.adminName,
        category: "item_onoff",
        action: parsed.data.available ? "on" : "off",
        entityType: "menu_item",
        entityId: String(id),
        summary: `${before.name} turned ${parsed.data.available ? "on" : "off"}`,
      })
    }
    return { ok: true }
  })
}
