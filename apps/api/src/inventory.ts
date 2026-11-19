import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { FastifyInstance } from "fastify"
import type { PoolClient } from "pg"
import { z } from "zod"
import { requireBilling } from "./billingAuth.ts"
import { pool } from "./db.ts"
import { sendError } from "./http.ts"

const qty = z.number().positive().max(1_000_000)

export async function ensureInventorySchema() {
  const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "../sql/005_inventory.sql")
  await pool.query(readFileSync(sqlPath, "utf8"))
  await pool.query(
    `INSERT INTO inv_settings (outlet_id)
     SELECT id FROM outlets
     ON CONFLICT (outlet_id) DO NOTHING`,
  )
  await pool.query(
    `INSERT INTO inv_units (outlet_id, name)
     SELECT o.id, u.name
     FROM outlets o
     CROSS JOIN (VALUES ('Kg'), ('Gm'), ('L'), ('Ml'), ('Pcs')) AS u(name)
     ON CONFLICT (outlet_id, name) DO NOTHING`,
  )
}

function num(value: unknown) {
  return Number(value)
}

async function postMovement(
  client: PoolClient,
  input: {
    outletId: number
    materialId: number
    qtyDelta: number
    unitCostPaise: number
    sourceType: string
    sourceId: number
    avgCosting: boolean
  },
) {
  const inserted = await client.query(
    `INSERT INTO inv_ledger (outlet_id, material_id, qty_delta, unit_cost_paise, source_type, source_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (outlet_id, material_id, source_type, source_id) DO NOTHING
     RETURNING id`,
    [input.outletId, input.materialId, input.qtyDelta, input.unitCostPaise, input.sourceType, input.sourceId],
  )
  if (!inserted.rowCount) return
  const current = await client.query<{ on_hand: string; avg_cost_paise: number }>(
    "SELECT on_hand, avg_cost_paise FROM inv_materials WHERE id = $1 AND outlet_id = $2 FOR UPDATE",
    [input.materialId, input.outletId],
  )
  const row = current.rows[0]
  if (!row) return
  const onHand = num(row.on_hand)
  let avg = row.avg_cost_paise
  if (input.avgCosting && input.qtyDelta > 0 && input.unitCostPaise > 0) {
    const next = onHand + input.qtyDelta
    avg = next > 0 ? Math.round((onHand * avg + input.qtyDelta * input.unitCostPaise) / next) : input.unitCostPaise
  }
  await client.query("UPDATE inv_materials SET on_hand = on_hand + $3, avg_cost_paise = $4 WHERE id = $1 AND outlet_id = $2", [
    input.materialId,
    input.outletId,
    input.qtyDelta,
    avg,
  ])
}

export async function consumeSettledOrder(client: PoolClient, outletId: number, orderId: number) {
  const settings = await client.query<{ auto_consumption: boolean; avg_costing: boolean }>(
    "SELECT auto_consumption, avg_costing FROM inv_settings WHERE outlet_id = $1",
    [outletId],
  )
  if (!settings.rows[0]?.auto_consumption) return
  const lines = await client.query<{ material_id: string; qty: string; avg_cost_paise: number }>(
    `SELECT rl.material_id, SUM(rl.qty * oi.qty) AS qty, m.avg_cost_paise
     FROM order_items oi
     JOIN inv_recipes r ON r.menu_item_id = oi.menu_item_id AND r.outlet_id = $2
     JOIN inv_recipe_lines rl ON rl.recipe_id = r.id
     JOIN inv_materials m ON m.id = rl.material_id
     WHERE oi.order_id = $1
     GROUP BY rl.material_id, m.avg_cost_paise`,
    [orderId, outletId],
  )
  for (const line of lines.rows) {
    await postMovement(client, {
      outletId,
      materialId: Number(line.material_id),
      qtyDelta: -num(line.qty),
      unitCostPaise: line.avg_cost_paise,
      sourceType: "sale",
      sourceId: orderId,
      avgCosting: false,
    })
  }
}

export async function registerInventoryRoutes(app: FastifyInstance) {
  await ensureInventorySchema()

  app.get("/api/v1/billing/inventory", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const [materials, low, docs, settings] = await Promise.all([
      pool.query<{ count: string; value: string }>(
        `SELECT count(*)::int AS count,
                COALESCE(SUM(on_hand * avg_cost_paise), 0)::bigint AS value
         FROM inv_materials WHERE outlet_id = $1 AND is_active`,
        [session.outletId],
      ),
      pool.query<{ count: string }>(
        `SELECT count(*)::int AS count FROM inv_materials
         WHERE outlet_id = $1 AND is_active AND on_hand <= min_qty AND min_qty > 0`,
        [session.outletId],
      ),
      pool.query(
        `SELECT id, doc_type, doc_no, status, total_paise, business_date
         FROM inv_documents WHERE outlet_id = $1 ORDER BY id DESC LIMIT 8`,
        [session.outletId],
      ),
      pool.query("SELECT auto_consumption, revert_on_cancel, avg_costing FROM inv_settings WHERE outlet_id = $1", [
        session.outletId,
      ]),
    ])
    const head = materials.rows[0]
    const setting = settings.rows[0]
    return {
      materialCount: Number(head?.count ?? 0),
      stockValuePaise: Number(head?.value ?? 0),
      lowStockCount: Number(low.rows[0]?.count ?? 0),
      settings: {
        autoConsumption: Boolean(setting?.auto_consumption),
        revertOnCancel: Boolean(setting?.revert_on_cancel),
        avgCosting: Boolean(setting?.avg_costing),
      },
      recent: docs.rows.map((row) => ({
        id: Number(row.id),
        type: row.doc_type,
        docNo: row.doc_no,
        status: row.status,
        totalPaise: row.total_paise,
        businessDate: String(row.business_date).slice(0, 10),
      })),
    }
  })

  app.get("/api/v1/billing/inventory/materials", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const [materials, units, categories] = await Promise.all([
      pool.query(
        `SELECT m.id, m.name, m.on_hand, m.min_qty, m.avg_cost_paise, m.hsn, m.is_active, m.is_favorite,
                m.category_id, m.unit_id, u.name AS unit_name, c.name AS category_name
         FROM inv_materials m
         JOIN inv_units u ON u.id = m.unit_id
         LEFT JOIN inv_categories c ON c.id = m.category_id
         WHERE m.outlet_id = $1
         ORDER BY m.name`,
        [session.outletId],
      ),
      pool.query("SELECT id, name FROM inv_units WHERE outlet_id = $1 ORDER BY name", [session.outletId]),
      pool.query("SELECT id, name FROM inv_categories WHERE outlet_id = $1 ORDER BY name", [session.outletId]),
    ])
    return {
      units: units.rows.map((row) => ({ id: Number(row.id), name: row.name })),
      categories: categories.rows.map((row) => ({ id: Number(row.id), name: row.name })),
      materials: materials.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        onHand: num(row.on_hand),
        minQty: num(row.min_qty),
        avgCostPaise: row.avg_cost_paise,
        hsn: row.hsn,
        active: row.is_active,
        favorite: row.is_favorite,
        categoryId: row.category_id ? Number(row.category_id) : null,
        categoryName: row.category_name ?? "",
        unitId: Number(row.unit_id),
        unitName: row.unit_name,
      })),
    }
  })

  app.post("/api/v1/billing/inventory/categories", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z.object({ name: z.string().trim().min(1).max(60) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Category name is required.")
    const row = await pool.query(
      `INSERT INTO inv_categories (outlet_id, name) VALUES ($1,$2)
       ON CONFLICT (outlet_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [session.outletId, parsed.data.name],
    )
    return { id: Number(row.rows[0]!.id) }
  })

  app.post("/api/v1/billing/inventory/materials", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(80),
        unitId: z.number().int().positive(),
        categoryId: z.number().int().positive().nullable().optional(),
        minQty: z.number().min(0).default(0),
        hsn: z.string().trim().max(20).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Name and unit are required.")
    const row = await pool.query(
      `INSERT INTO inv_materials (outlet_id, name, unit_id, category_id, min_qty, hsn)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        session.outletId,
        parsed.data.name,
        parsed.data.unitId,
        parsed.data.categoryId ?? null,
        parsed.data.minQty,
        parsed.data.hsn ?? "",
      ],
    )
    return { id: Number(row.rows[0]!.id) }
  })

  app.put("/api/v1/billing/inventory/materials/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z.object({ active: z.boolean().optional(), favorite: z.boolean().optional() }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the material and try again.")
    const updated = await pool.query(
      `UPDATE inv_materials SET is_active = COALESCE($3, is_active), is_favorite = COALESCE($4, is_favorite)
       WHERE id = $1 AND outlet_id = $2`,
      [id, session.outletId, parsed.data.active ?? null, parsed.data.favorite ?? null],
    )
    if (!updated.rowCount) return sendError(reply, 404, "NOT_FOUND", "Material not found.")
    return { ok: true }
  })

  app.get("/api/v1/billing/inventory/suppliers", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const rows = await pool.query(
      "SELECT id, name, company, phone, is_active FROM inv_suppliers WHERE outlet_id = $1 ORDER BY name",
      [session.outletId],
    )
    return {
      rows: rows.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        company: row.company,
        phone: row.phone,
        active: row.is_active,
      })),
    }
  })

  app.post("/api/v1/billing/inventory/suppliers", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(80),
        company: z.string().trim().max(80).optional(),
        phone: z.string().trim().max(20).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Supplier name is required.")
    const row = await pool.query(
      `INSERT INTO inv_suppliers (outlet_id, name, company, phone) VALUES ($1,$2,$3,$4) RETURNING id`,
      [session.outletId, parsed.data.name, parsed.data.company ?? "", parsed.data.phone ?? ""],
    )
    return { id: Number(row.rows[0]!.id) }
  })

  app.get("/api/v1/billing/inventory/recipes", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const items = await pool.query(
      `SELECT i.id, i.name, c.name AS category
       FROM menu_items i JOIN menu_categories c ON c.id = i.category_id
       WHERE i.outlet_id = $1 AND i.is_available ORDER BY c.sort_rank, i.name`,
      [session.outletId],
    )
    const recipes = await pool.query(
      `SELECT r.id, r.menu_item_id, rl.material_id, rl.qty, m.name AS material_name
       FROM inv_recipes r
       JOIN inv_recipe_lines rl ON rl.recipe_id = r.id
       JOIN inv_materials m ON m.id = rl.material_id
       WHERE r.outlet_id = $1`,
      [session.outletId],
    )
    const byItem = new Map<number, { materialId: number; name: string; qty: number }[]>()
    for (const row of recipes.rows) {
      const itemId = Number(row.menu_item_id)
      const list = byItem.get(itemId) ?? []
      list.push({ materialId: Number(row.material_id), name: row.material_name, qty: num(row.qty) })
      byItem.set(itemId, list)
    }
    return {
      items: items.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        category: row.category,
        lines: byItem.get(Number(row.id)) ?? [],
      })),
    }
  })

  app.put("/api/v1/billing/inventory/recipes/:menuItemId", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const menuItemId = Number((request.params as { menuItemId: string }).menuItemId)
    const parsed = z
      .object({ lines: z.array(z.object({ materialId: z.number().int().positive(), qty })) })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Recipe lines are invalid.")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const item = await client.query("SELECT id FROM menu_items WHERE id = $1 AND outlet_id = $2", [
        menuItemId,
        session.outletId,
      ])
      if (!item.rowCount) {
        await client.query("ROLLBACK")
        return sendError(reply, 404, "NOT_FOUND", "Menu item not found.")
      }
      const recipe = await client.query(
        `INSERT INTO inv_recipes (outlet_id, menu_item_id) VALUES ($1,$2)
         ON CONFLICT (outlet_id, menu_item_id) DO UPDATE SET menu_item_id = EXCLUDED.menu_item_id
         RETURNING id`,
        [session.outletId, menuItemId],
      )
      const recipeId = recipe.rows[0]!.id
      await client.query("DELETE FROM inv_recipe_lines WHERE recipe_id = $1", [recipeId])
      for (const line of parsed.data.lines) {
        await client.query("INSERT INTO inv_recipe_lines (recipe_id, material_id, qty) VALUES ($1,$2,$3)", [
          recipeId,
          line.materialId,
          line.qty,
        ])
      }
      await client.query("COMMIT")
      return { ok: true }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  })

  app.get("/api/v1/billing/inventory/documents", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const type = String((request.query as { type?: string }).type ?? "purchase")
    const rows = await pool.query(
      `SELECT d.id, d.doc_no, d.status, d.total_paise, d.note, d.business_date, s.name AS supplier_name
       FROM inv_documents d
       LEFT JOIN inv_suppliers s ON s.id = d.supplier_id
       WHERE d.outlet_id = $1 AND d.doc_type = $2
       ORDER BY d.id DESC LIMIT 100`,
      [session.outletId, type],
    )
    return {
      rows: rows.rows.map((row) => ({
        id: Number(row.id),
        docNo: row.doc_no,
        status: row.status,
        totalPaise: row.total_paise,
        note: row.note,
        businessDate: String(row.business_date).slice(0, 10),
        supplierName: row.supplier_name ?? "",
      })),
    }
  })

  app.post("/api/v1/billing/inventory/documents", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        type: z.enum(["purchase", "purchase_order", "wastage", "closing"]),
        supplierId: z.number().int().positive().nullable().optional(),
        note: z.string().trim().max(200).optional(),
        lines: z
          .array(
            z.object({
              materialId: z.number().int().positive(),
              qty,
              unitCostPaise: z.number().int().min(0).default(0),
            }),
          )
          .min(1),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Add at least one stock line.")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const settings = await client.query<{ avg_costing: boolean }>(
        "SELECT avg_costing FROM inv_settings WHERE outlet_id = $1",
        [session.outletId],
      )
      const number = await client.query<{ next: number }>(
        `SELECT COALESCE(MAX(doc_no), 0) + 1 AS next FROM inv_documents WHERE outlet_id = $1 AND doc_type = $2`,
        [session.outletId, parsed.data.type],
      )
      const total = parsed.data.lines.reduce((sum, line) => sum + line.qty * line.unitCostPaise, 0)
      const doc = await client.query(
        `INSERT INTO inv_documents (outlet_id, doc_type, doc_no, supplier_id, status, note, total_paise, business_date)
         VALUES ($1,$2,$3,$4,$7,$5,$6, CURRENT_DATE) RETURNING id`,
        [
          session.outletId,
          parsed.data.type,
          number.rows[0]!.next,
          parsed.data.supplierId ?? null,
          parsed.data.note ?? "",
          Math.round(total),
          parsed.data.type === "purchase_order" ? "saved" : "processed",
        ],
      )
      const documentId = Number(doc.rows[0]!.id)
      for (const line of parsed.data.lines) {
        const amount = Math.round(line.qty * line.unitCostPaise)
        const lineRow = await client.query(
          `INSERT INTO inv_document_lines (document_id, material_id, qty, unit_cost_paise, amount_paise)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [documentId, line.materialId, line.qty, line.unitCostPaise, amount],
        )
        const lineId = Number(lineRow.rows[0]!.id)
        if (parsed.data.type === "purchase") {
          await postMovement(client, {
            outletId: session.outletId,
            materialId: line.materialId,
            qtyDelta: line.qty,
            unitCostPaise: line.unitCostPaise,
            sourceType: "purchase",
            sourceId: lineId,
            avgCosting: settings.rows[0]?.avg_costing ?? true,
          })
        } else if (parsed.data.type === "wastage") {
          await postMovement(client, {
            outletId: session.outletId,
            materialId: line.materialId,
            qtyDelta: -line.qty,
            unitCostPaise: line.unitCostPaise,
            sourceType: "wastage",
            sourceId: lineId,
            avgCosting: false,
          })
        } else if (parsed.data.type === "closing") {
          const current = await client.query<{ on_hand: string }>(
            "SELECT on_hand FROM inv_materials WHERE id = $1 AND outlet_id = $2",
            [line.materialId, session.outletId],
          )
          const delta = line.qty - num(current.rows[0]?.on_hand ?? 0)
          if (delta !== 0) {
            await postMovement(client, {
              outletId: session.outletId,
              materialId: line.materialId,
              qtyDelta: delta,
              unitCostPaise: line.unitCostPaise,
              sourceType: "closing",
              sourceId: lineId,
              avgCosting: false,
            })
          }
        }
      }
      await client.query("COMMIT")
      return { id: documentId, docNo: number.rows[0]!.next }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  })

  app.put("/api/v1/billing/inventory/settings", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        autoConsumption: z.boolean(),
        revertOnCancel: z.boolean(),
        avgCosting: z.boolean(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the settings and try again.")
    await pool.query(
      `INSERT INTO inv_settings (outlet_id, auto_consumption, revert_on_cancel, avg_costing)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (outlet_id) DO UPDATE
         SET auto_consumption = $2, revert_on_cancel = $3, avg_costing = $4`,
      [session.outletId, parsed.data.autoConsumption, parsed.data.revertOnCancel, parsed.data.avgCosting],
    )
    return { ok: true }
  })
}
