import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
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

async function ensureMenuExtras() {
  const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "../sql/007_gaps.sql")
  await pool.query(readFileSync(sqlPath, "utf8"))
}

export async function registerMenuAdminRoutes(app: FastifyInstance) {
  await ensureMenuExtras()
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
    const variants = await pool.query(
      `SELECT id, name, price_paise, is_active FROM menu_variants WHERE outlet_id = $1 ORDER BY name`,
      [session.outletId],
    )
    const itemVariants = await pool.query(
      `SELECT iv.item_id, iv.variant_id, iv.price_paise
       FROM item_variants iv JOIN menu_items i ON i.id = iv.item_id WHERE i.outlet_id = $1`,
      [session.outletId],
    )
    const groups = await pool.query(
      `SELECT id, name, min_select, max_select, is_active FROM addon_groups WHERE outlet_id = $1 ORDER BY name`,
      [session.outletId],
    )
    const addonItems = await pool.query(
      `SELECT a.id, a.group_id, a.name, a.price_paise, a.is_active
       FROM addon_items a JOIN addon_groups g ON g.id = a.group_id WHERE g.outlet_id = $1 ORDER BY a.name`,
      [session.outletId],
    )
    const itemGroups = await pool.query(
      `SELECT ig.item_id, ig.group_id FROM item_addon_groups ig
       JOIN menu_items i ON i.id = ig.item_id WHERE i.outlet_id = $1`,
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
      variants: variants.rows.map((row) => ({
        id: Number(row.id),
        name: row.name as string,
        pricePaise: row.price_paise as number,
        active: row.is_active as boolean,
      })),
      itemVariants: itemVariants.rows.map((row) => ({
        itemId: Number(row.item_id),
        variantId: Number(row.variant_id),
        pricePaise: row.price_paise == null ? null : Number(row.price_paise),
      })),
      addonGroups: groups.rows.map((row) => ({
        id: Number(row.id),
        name: row.name as string,
        minSelect: row.min_select as number,
        maxSelect: row.max_select as number,
        active: row.is_active as boolean,
        items: addonItems.rows
          .filter((item) => Number(item.group_id) === Number(row.id))
          .map((item) => ({
            id: Number(item.id),
            name: item.name as string,
            pricePaise: item.price_paise as number,
            active: item.is_active as boolean,
          })),
      })),
      itemAddonGroups: itemGroups.rows.map((row) => ({
        itemId: Number(row.item_id),
        groupId: Number(row.group_id),
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

  app.post("/api/v1/billing/menu/variants", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z.object({ name: z.string().trim().min(1).max(40), pricePaise: z.number().int().min(0) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Name and price are required.")
    const row = await pool.query(
      `INSERT INTO menu_variants (outlet_id, name, price_paise) VALUES ($1,$2,$3)
       ON CONFLICT (outlet_id, name) DO UPDATE SET price_paise = EXCLUDED.price_paise, is_active = true
       RETURNING id`,
      [session.outletId, parsed.data.name, parsed.data.pricePaise],
    )
    await bumpMenu(session.outletId)
    return { id: Number(row.rows[0]!.id) }
  })

  app.put("/api/v1/billing/menu/items/:id/variants", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const itemId = Number((request.params as { id: string }).id)
    const parsed = z.object({ variantIds: z.array(z.number().int().positive()).max(20) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Choose the variations for this item.")
    const item = await pool.query("SELECT id FROM menu_items WHERE id = $1 AND outlet_id = $2", [itemId, session.outletId])
    if (!item.rowCount) return sendError(reply, 404, "NOT_FOUND", "Item not found.")
    await pool.query("DELETE FROM item_variants WHERE item_id = $1", [itemId])
    for (const variantId of parsed.data.variantIds) {
      await pool.query(
        `INSERT INTO item_variants (item_id, variant_id)
         SELECT $1, id FROM menu_variants WHERE id = $2 AND outlet_id = $3`,
        [itemId, variantId, session.outletId],
      )
    }
    await bumpMenu(session.outletId)
    return { ok: true }
  })

  app.post("/api/v1/billing/menu/addon-groups", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(40),
        minSelect: z.number().int().min(0).max(10).default(0),
        maxSelect: z.number().int().min(1).max(10).default(1),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Group name is required.")
    const row = await pool.query(
      `INSERT INTO addon_groups (outlet_id, name, min_select, max_select) VALUES ($1,$2,$3,$4)
       ON CONFLICT (outlet_id, name) DO UPDATE SET min_select = EXCLUDED.min_select, max_select = EXCLUDED.max_select, is_active = true
       RETURNING id`,
      [session.outletId, parsed.data.name, parsed.data.minSelect, parsed.data.maxSelect],
    )
    await bumpMenu(session.outletId)
    return { id: Number(row.rows[0]!.id) }
  })

  app.post("/api/v1/billing/menu/addon-groups/:id/items", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const groupId = Number((request.params as { id: string }).id)
    const parsed = z.object({ name: z.string().trim().min(1).max(40), pricePaise: z.number().int().min(0) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Addon name and price are required.")
    const group = await pool.query("SELECT id FROM addon_groups WHERE id = $1 AND outlet_id = $2", [groupId, session.outletId])
    if (!group.rowCount) return sendError(reply, 404, "NOT_FOUND", "Addon group not found.")
    const row = await pool.query(
      `INSERT INTO addon_items (group_id, name, price_paise) VALUES ($1,$2,$3) RETURNING id`,
      [groupId, parsed.data.name, parsed.data.pricePaise],
    )
    await bumpMenu(session.outletId)
    return { id: Number(row.rows[0]!.id) }
  })

  app.put("/api/v1/billing/menu/items/:id/addons", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const itemId = Number((request.params as { id: string }).id)
    const parsed = z.object({ groupIds: z.array(z.number().int().positive()).max(20) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Choose the addon groups for this item.")
    const item = await pool.query("SELECT id FROM menu_items WHERE id = $1 AND outlet_id = $2", [itemId, session.outletId])
    if (!item.rowCount) return sendError(reply, 404, "NOT_FOUND", "Item not found.")
    await pool.query("DELETE FROM item_addon_groups WHERE item_id = $1", [itemId])
    for (const groupId of parsed.data.groupIds) {
      await pool.query(
        `INSERT INTO item_addon_groups (item_id, group_id)
         SELECT $1, id FROM addon_groups WHERE id = $2 AND outlet_id = $3`,
        [itemId, groupId, session.outletId],
      )
    }
    await bumpMenu(session.outletId)
    return { ok: true }
  })
}
