import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { writeAudit } from "./audit.ts"
import { requireBilling } from "./billingAuth.ts"
import { pool } from "./db.ts"
import { sendError } from "./http.ts"

export const defaultSettings = {
  outlet: {
    alias: "",
    email: "demo@harbour.kitchen",
    country: "India",
    state: "Maharashtra",
    city: "Mumbai",
    zip: "400001",
    address: "Harbour Road",
    area: "Colaba",
    landmark: "",
    lat: "18.9220",
    lng: "72.8347",
    fax: "",
    tin: "",
    operationType: "COCO",
    cuisines: "North Indian, Chinese",
    seating: "10-50",
    restaurantType: "Fine Dine",
    fssai: "",
    taxAuthority: "GST",
    supplyType: "Service",
  },
  contact: {
    ownerMobile: "",
    managerPhone: "",
    decisionMaker: "",
    directNumber: "",
    billerName: "Floor manager",
    billerPhone: "",
  },
  timings: {
    closingHour: "23:30",
    is24x7: false,
    deliveryFrom: "11:00",
    deliveryTo: "23:00",
    slots: [{ name: "Lunch", from: "12:00", to: "15:30", days: "All" }],
  },
  payment: {
    currency: "INR",
    customTypes: ["GPay", "Paytm"],
    cardOptions: ["Visa", "Mastercard", "RuPay"],
    upiProviders: ["Google Pay", "PhonePe", "BHIM"],
  },
  invoices: [{ name: "Default", prefix: "HK", nextNo: 1, active: true }],
  display: {
    uiMode: "touch",
    defaultScreen: "tables",
    dineInLabel: "Dine In",
    pickupLabel: "Pick Up",
    deliveryLabel: "Delivery",
    showDineIn: true,
    showPickup: true,
    showDelivery: true,
    paymentButtons: ["cash", "card", "due", "upi"],
    defaultOrderType: "dine_in",
    defaultQty: 1,
    mergeDuplicateItems: true,
    saveKotOnSaveBill: true,
    showItemPrice: true,
    personsMandatory: false,
    itemSort: "rank",
    discountLabel: "Discount",
    orderInfoLabel: "Order wise information",
  },
  printLogo: { caption: "Harbour Kitchen" },
  calculations: {
    roundOff: "normal",
    roundIncrement: "1",
    serviceCharge: false,
    serviceLabel: "Service Charge",
    serviceMode: "percentage",
    serviceValue: 0,
    containerCharge: false,
    containerLabel: "Container Charge",
    containerValue: 0,
    deliveryCharge: false,
    deliveryValue: 0,
    taxRateBps: 500,
    saveKotOnSaveBill: true,
    mergeDuplicateItems: true,
  },
  connected: {
    manualDayEnd: true,
    blockIfActiveTables: true,
    cashDrawerCashOnly: true,
    kdsUpdatesOrder: false,
    eInvoice: false,
  },
  print: {
    kotOnPrintBill: true,
    notesBelowItem: true,
    duplicateOnReprint: true,
    showPaidAndChange: true,
    kotAsToken: true,
    barcode: "last4",
  },
  customer: {
    phoneMandatoryDineIn: false,
    phoneMandatoryPickup: false,
    phoneMandatoryDelivery: true,
    minPhone: 10,
    maxPhone: 10,
    phoneMandatoryDue: true,
    showEmail: false,
  },
  online: {
    kotAfterAccept: true,
    billAfterAccept: false,
    minOrderRupees: 0,
    autoCancelMinutes: 30,
    prepMinutes: 20,
    deliveryMinutes: 40,
    advanceReminderMinutes: 0,
  },
  system: {
    syncBatch: 20,
    syncMinutes: 15,
    editMinutes: 30,
    cancelHours: 24,
    idleLogoutMinutes: 30,
    managerPassword: "",
  },
  notification: { dailySalesSms: false },
}

export type OutletSettings = typeof defaultSettings

function mergeSettings(saved: unknown): OutletSettings {
  const doc = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {}
  const out = structuredClone(defaultSettings) as OutletSettings
  for (const key of Object.keys(out) as (keyof OutletSettings)[]) {
    const incoming = doc[key]
    if (Array.isArray(out[key]) && Array.isArray(incoming)) {
      ;(out as Record<string, unknown>)[key] = incoming
    } else if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
      Object.assign(out[key] as object, incoming)
    }
  }
  return out
}

export async function ensureConfigSchema() {
  const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "../sql/003_config.sql")
  await pool.query(readFileSync(sqlPath, "utf8"))
}

export async function loadOutletSettings(outletId: number): Promise<OutletSettings> {
  await ensureConfigSchema()
  const row = await pool.query<{ document: unknown }>("SELECT document FROM outlet_settings WHERE outlet_id=$1", [
    outletId,
  ])
  if (!row.rowCount) return structuredClone(defaultSettings)
  return mergeSettings(row.rows[0]!.document)
}

const sections = [
  "outlet",
  "contact",
  "timings",
  "payment",
  "invoices",
  "display",
  "printLogo",
  "calculations",
  "connected",
  "print",
  "customer",
  "online",
  "system",
  "notification",
] as const

export async function registerConfigRoutes(app: FastifyInstance) {
  await ensureConfigSchema()

  app.get("/api/v1/billing/config", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const outlet = await pool.query<{ name: string; timezone: string; tax_rate_bps: number }>(
      "SELECT name, timezone, tax_rate_bps FROM outlets WHERE id=$1",
      [session.outletId],
    )
    const settings = await loadOutletSettings(session.outletId)
    settings.calculations.taxRateBps = outlet.rows[0]?.tax_rate_bps ?? settings.calculations.taxRateBps
    return {
      outletName: outlet.rows[0]?.name ?? "",
      timezone: outlet.rows[0]?.timezone ?? "Asia/Kolkata",
      settings,
    }
  })

  app.put("/api/v1/billing/config", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        section: z.enum(sections),
        value: z.unknown(),
        outletName: z.string().trim().min(1).max(80).optional(),
        timezone: z.string().trim().min(1).max(64).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the configuration and try again.")

    const current = await loadOutletSettings(session.outletId)
    if (parsed.data.section === "invoices") {
      if (!Array.isArray(parsed.data.value)) return sendError(reply, 400, "VALIDATION", "Invoice list is invalid.")
      current.invoices = parsed.data.value as OutletSettings["invoices"]
    } else if (parsed.data.value && typeof parsed.data.value === "object") {
      Object.assign(current[parsed.data.section] as object, parsed.data.value)
    }
    await pool.query(
      `INSERT INTO outlet_settings (outlet_id, document) VALUES ($1, $2::jsonb)
       ON CONFLICT (outlet_id) DO UPDATE SET document = $2::jsonb, updated_at = now()`,
      [session.outletId, JSON.stringify(current)],
    )
    if (parsed.data.outletName || parsed.data.timezone) {
      await pool.query(
        `UPDATE outlets SET name = COALESCE($2, name), timezone = COALESCE($3, timezone) WHERE id = $1`,
        [session.outletId, parsed.data.outletName ?? null, parsed.data.timezone ?? null],
      )
    }
    if (parsed.data.section === "calculations") {
      const tax = Number((parsed.data.value as { taxRateBps?: number }).taxRateBps)
      if (Number.isFinite(tax)) {
        const rateBps = Math.min(10000, Math.max(0, Math.round(tax)))
        await pool.query("UPDATE outlets SET tax_rate_bps=$2 WHERE id=$1", [session.outletId, rateBps])
        await pool.query(
          `UPDATE menu_taxes SET rate_bps = $2, title = 'GST ' || ($2 / 100) || '%'
           WHERE outlet_id = $1 AND is_default AND kind = 'gst'`,
          [session.outletId, rateBps],
        )
      }
    }
    if (parsed.data.section === "timings") {
      await writeAudit({
        outletId: session.outletId,
        actorName: session.adminName,
        category: "closing_hours",
        action: "updated",
        summary: "Outlet timings saved",
      })
    }
    return { settings: current }
  })

  app.get("/api/v1/billing/config/sub-order-types", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const rows = await pool.query("SELECT id, name, is_active FROM sub_order_types WHERE outlet_id=$1 ORDER BY name", [
      session.outletId,
    ])
    return { rows: rows.rows.map((r) => ({ id: Number(r.id), name: r.name, active: r.is_active })) }
  })

  app.post("/api/v1/billing/config/sub-order-types", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z.object({ name: z.string().trim().min(1).max(40) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Name is required.")
    const row = await pool.query(
      `INSERT INTO sub_order_types (outlet_id, name) VALUES ($1,$2)
       ON CONFLICT (outlet_id, name) DO UPDATE SET is_active = true RETURNING id, name, is_active`,
      [session.outletId, parsed.data.name],
    )
    return { id: Number(row.rows[0]!.id), name: row.rows[0]!.name, active: row.rows[0]!.is_active }
  })

  app.put("/api/v1/billing/config/sub-order-types/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z.object({ active: z.boolean() }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Could not update.")
    await pool.query("UPDATE sub_order_types SET is_active=$3 WHERE id=$1 AND outlet_id=$2", [
      id,
      session.outletId,
      parsed.data.active,
    ])
    return { ok: true }
  })

  app.delete("/api/v1/billing/config/sub-order-types/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    await pool.query("DELETE FROM sub_order_types WHERE id=$1 AND outlet_id=$2", [id, session.outletId])
    return { ok: true }
  })

  app.get("/api/v1/billing/config/delivery-distances", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const rows = await pool.query(
      "SELECT id, from_km, to_km, charge_paise FROM delivery_distances WHERE outlet_id=$1 ORDER BY from_km",
      [session.outletId],
    )
    return {
      rows: rows.rows.map((r) => ({
        id: Number(r.id),
        fromKm: Number(r.from_km),
        toKm: Number(r.to_km),
        chargePaise: r.charge_paise,
      })),
    }
  })

  app.post("/api/v1/billing/config/delivery-distances", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        fromKm: z.number().min(0),
        toKm: z.number().positive(),
        chargePaise: z.number().int().min(0),
      })
      .safeParse(request.body)
    if (!parsed.success || parsed.data.toKm <= parsed.data.fromKm) {
      return sendError(reply, 400, "VALIDATION", "Enter a distance slab and charge.")
    }
    const row = await pool.query(
      `INSERT INTO delivery_distances (outlet_id, from_km, to_km, charge_paise) VALUES ($1,$2,$3,$4) RETURNING id`,
      [session.outletId, parsed.data.fromKm, parsed.data.toKm, parsed.data.chargePaise],
    )
    return { id: Number(row.rows[0]!.id) }
  })

  app.delete("/api/v1/billing/config/delivery-distances/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    await pool.query("DELETE FROM delivery_distances WHERE id=$1 AND outlet_id=$2", [id, session.outletId])
    return { ok: true }
  })

  app.get("/api/v1/billing/config/area-charges", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const rows = await pool.query(
      "SELECT id, area_name, charge_paise, is_active FROM area_delivery_charges WHERE outlet_id=$1 ORDER BY area_name",
      [session.outletId],
    )
    return {
      rows: rows.rows.map((r) => ({
        id: Number(r.id),
        areaName: r.area_name,
        chargePaise: r.charge_paise,
        active: r.is_active,
      })),
    }
  })

  app.post("/api/v1/billing/config/area-charges", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({ areaName: z.string().trim().min(1).max(60), chargePaise: z.number().int().min(0) })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Area and charge are required.")
    const row = await pool.query(
      `INSERT INTO area_delivery_charges (outlet_id, area_name, charge_paise)
       VALUES ($1,$2,$3)
       ON CONFLICT (outlet_id, area_name) DO UPDATE SET charge_paise=$3, is_active=true
       RETURNING id`,
      [session.outletId, parsed.data.areaName, parsed.data.chargePaise],
    )
    return { id: Number(row.rows[0]!.id) }
  })

  app.delete("/api/v1/billing/config/area-charges/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    await pool.query("DELETE FROM area_delivery_charges WHERE id=$1 AND outlet_id=$2", [id, session.outletId])
    return { ok: true }
  })

  app.get("/api/v1/billing/config/floor", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const tables = await pool.query(
      `SELECT id, area_name, table_no, seats, pos_x, pos_y, width, height, shape, text_size, placed
       FROM pos_tables WHERE outlet_id = $1 AND is_active
       ORDER BY area_name, table_no`,
      [session.outletId],
    )
    const barriers = await pool.query(
      "SELECT id, pos_x, pos_y, width, height FROM floor_barriers WHERE outlet_id = $1 ORDER BY id",
      [session.outletId],
    )
    return {
      tables: tables.rows.map((row) => ({
        id: Number(row.id),
        area: row.area_name as string,
        tableNo: row.table_no as string,
        seats: Number(row.seats),
        x: Number(row.pos_x),
        y: Number(row.pos_y),
        width: Number(row.width),
        height: Number(row.height),
        shape: row.shape as string,
        textSize: Number(row.text_size),
        placed: Boolean(row.placed),
      })),
      barriers: barriers.rows.map((row) => ({
        id: Number(row.id),
        x: Number(row.pos_x),
        y: Number(row.pos_y),
        width: Number(row.width),
        height: Number(row.height),
      })),
    }
  })

  app.put("/api/v1/billing/config/floor", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const shape = z.enum(["circle", "square", "diamond", "arch", "rect", "oval"])
    const parsed = z
      .object({
        tables: z.array(
          z.object({
            id: z.number().int().positive(),
            x: z.number().int().min(0).max(4000),
            y: z.number().int().min(0).max(4000),
            width: z.number().int().min(40).max(400),
            height: z.number().int().min(40).max(400),
            shape,
            textSize: z.number().int().min(10).max(32),
            placed: z.boolean(),
          }),
        ),
        barriers: z.array(
          z.object({
            x: z.number().int().min(0).max(4000),
            y: z.number().int().min(0).max(4000),
            width: z.number().int().min(8).max(800),
            height: z.number().int().min(8).max(800),
          }),
        ),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the floor plan and try again.")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      for (const table of parsed.data.tables) {
        await client.query(
          `UPDATE pos_tables
           SET pos_x=$3, pos_y=$4, width=$5, height=$6, shape=$7, text_size=$8, placed=$9
           WHERE id=$1 AND outlet_id=$2`,
          [table.id, session.outletId, table.x, table.y, table.width, table.height, table.shape, table.textSize, table.placed],
        )
      }
      await client.query("DELETE FROM floor_barriers WHERE outlet_id = $1", [session.outletId])
      for (const barrier of parsed.data.barriers) {
        await client.query(
          `INSERT INTO floor_barriers (outlet_id, pos_x, pos_y, width, height) VALUES ($1,$2,$3,$4,$5)`,
          [session.outletId, barrier.x, barrier.y, barrier.width, barrier.height],
        )
      }
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
    return { ok: true }
  })

  app.post("/api/v1/billing/config/tables", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        area: z.string().trim().min(1).max(40),
        tableNo: z.string().trim().min(1).max(20),
        seats: z.number().int().min(1).max(30),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Area, table number and seats are required.")
    await pool.query(
      `INSERT INTO pos_tables (outlet_id, area_name, table_no, seats)
       VALUES ($1,$2,$3,$4) ON CONFLICT (outlet_id, table_no) DO UPDATE SET area_name=$2, seats=$4, is_active=true`,
      [session.outletId, parsed.data.area, parsed.data.tableNo, parsed.data.seats],
    )
    return { ok: true }
  })

  app.delete("/api/v1/billing/config/tables/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    await pool.query("UPDATE pos_tables SET is_active=false WHERE id=$1 AND outlet_id=$2", [id, session.outletId])
    return { ok: true }
  })
}
