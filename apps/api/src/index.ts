import { randomBytes } from "node:crypto"
import compress from "@fastify/compress"
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify"
import { z } from "zod"
import { pool } from "./db.ts"
import { verifyPin } from "./crypto.ts"
import { clearSession, readSession, sendError, writeSession, type Session } from "./http.ts"
import { searchItems, sendCategories, sendCategoryItems } from "./menu.ts"
import {
  businessDateIn,
  cancelOrder,
  createOrder,
  decodeCursor,
  getOrder,
  listOrders,
  OrderError,
  updateOrder,
} from "./orders.ts"
import { redis } from "./redis.ts"
import { registerBillingRoutes } from "./billing.ts"
import { registerPosRoutes } from "./pos.ts"
import { registerConfigRoutes } from "./config.ts"
import { registerMenuAdminRoutes } from "./menuAdmin.ts"
import { registerCatalogRoutes } from "./catalog.ts"
import { registerInventoryRoutes } from "./inventory.ts"
import { registerManagementRoutes } from "./management.ts"

const app = Fastify({
  logger: { level: "info", redact: ["req.headers.cookie", "req.body.pin"] },
  bodyLimit: 32 * 1024,
})
await app.register(compress, { global: true, threshold: 1024 })

const pinBody = z.object({ pin: z.string().regex(/^\d{4}$/, "Enter the 4-digit PIN") })
const lineSchema = z.object({
  menuItemId: z.number().int().positive(),
  qty: z.number().int().min(1).max(99),
  note: z.string().trim().max(200).optional(),
})
const draftSchema = z.object({
  orderType: z.enum(["dine_in", "pickup", "delivery"]),
  tableLabel: z.string().trim().max(20).optional(),
  customerName: z.string().trim().max(80).optional(),
  note: z.string().trim().max(300).optional(),
  lines: z.array(lineSchema).min(1).max(40),
})
const updateSchema = draftSchema.extend({ version: z.number().int().positive() })

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof OrderError) {
    return sendError(reply, error.status, error.code, error.message, error.details)
  }
  const statusCode = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500
  if (statusCode < 500) return sendError(reply, statusCode, "BAD_REQUEST", error.message)
  app.log.error(error)
  return sendError(reply, 500, "INTERNAL", "Something went wrong. Try again.")
})

app.get("/api/v1/health", async () => {
  await pool.query("SELECT 1")
  const pong = await redis.ping()
  return { ok: true, db: "up", redis: pong === "PONG" ? "up" : "down" }
})

app.post("/api/v1/session", async (request, reply) => {
  const parsed = pinBody.safeParse(request.body)
  if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Enter the 4-digit PIN")
  const ip = request.ip
  const attempts = await redis.incr(`login:${ip}`)
  if (attempts === 1) await redis.expire(`login:${ip}`, 15 * 60)
  if (attempts > 8) return sendError(reply, 429, "RATE_LIMITED", "Too many tries. Wait a few minutes.")

  const found = await pool.query<{
    id: string
    display_name: string
    pin_hash: string
    outlet_id: string
    name: string
    timezone: string
    currency: string
    tax_rate_bps: number
  }>(
    `SELECT m.id, m.display_name, m.pin_hash, o.id AS outlet_id, o.name, o.timezone, o.currency, o.tax_rate_bps
     FROM managers m JOIN outlets o ON o.id = m.outlet_id
     ORDER BY m.id LIMIT 1`,
  )
  const manager = found.rows[0]
  if (!manager || !verifyPin(parsed.data.pin, manager.pin_hash)) {
    return sendError(reply, 401, "BAD_PIN", "That PIN doesn't match.")
  }
  await redis.del(`login:${ip}`)
  const session: Session = {
    managerId: Number(manager.id),
    managerName: manager.display_name,
    outletId: Number(manager.outlet_id),
    outletName: manager.name,
    timezone: manager.timezone,
    currency: manager.currency,
    taxRateBps: manager.tax_rate_bps,
  }
  await writeSession(reply, randomBytes(32).toString("base64url"), session)
  return publicSession(session)
})

app.get("/api/v1/session", async (request, reply) => {
  const session = await requireSession(request, reply)
  if (!session) return
  return publicSession(session)
})

app.delete("/api/v1/session", async (request, reply) => {
  await clearSession(request, reply)
  return { ok: true }
})

app.get("/api/v1/menu/categories", async (request, reply) => {
  const session = await requireSession(request, reply)
  if (!session) return
  return sendCategories(pool, session, reply, request.headers["if-none-match"])
})

app.get("/api/v1/menu/items", async (request, reply) => {
  const session = await requireSession(request, reply)
  if (!session) return
  const categoryId = Number((request.query as { categoryId?: string }).categoryId)
  if (!Number.isInteger(categoryId) || categoryId < 1) {
    return sendError(reply, 400, "VALIDATION", "Choose a category")
  }
  return sendCategoryItems(pool, session, categoryId, reply, request.headers["if-none-match"])
})

app.get("/api/v1/menu/search", async (request, reply) => {
  const session = await requireSession(request, reply)
  if (!session) return
  reply.header("cache-control", "private, max-age=15")
  const query = (request.query as { q?: string }).q ?? ""
  return searchItems(pool, session, query)
})

app.post("/api/v1/orders", async (request, reply) => {
  const session = await requireSession(request, reply)
  if (!session) return
  const parsed = draftSchema.safeParse(request.body)
  if (!parsed.success) return sendError(reply, 400, "VALIDATION", draftMessage(parsed.error.issues[0]?.message))
  const key = request.headers["idempotency-key"]
  if (typeof key !== "string" || key.length < 16 || key.length > 80) {
    return sendError(reply, 400, "VALIDATION", "Missing save key. Try saving again.")
  }
  const result = await createOrder(pool, session.outletId, key, parsed.data)
  return reply.status(result.status).send(result.body)
})

app.get("/api/v1/orders", async (request, reply) => {
  const session = await requireSession(request, reply)
  if (!session) return
  reply.header("cache-control", "no-store")
  const query = request.query as { status?: string; cursor?: string; limit?: string }
  const status = query.status === "open" || query.status === "cancelled" ? query.status : null
  if (query.status && !status) return sendError(reply, 400, "VALIDATION", "Unknown status filter")
  const cursor = query.cursor ? decodeCursor(query.cursor) : null
  if (query.cursor && !cursor) return sendError(reply, 400, "VALIDATION", "That page token is not valid")
  const limit = Math.min(50, Math.max(1, Number(query.limit ?? 30) || 30))
  return listOrders(pool, session.outletId, businessDateIn(session.timezone), status, cursor, limit)
})

app.get("/api/v1/orders/:id", async (request, reply) => {
  const session = await requireSession(request, reply)
  if (!session) return
  reply.header("cache-control", "no-store")
  const order = await getOrder(pool, session.outletId, idParam(request))
  if (!order) return sendError(reply, 404, "NOT_FOUND", "That order is not on today's book")
  return order
})

app.put("/api/v1/orders/:id", async (request, reply) => {
  const session = await requireSession(request, reply)
  if (!session) return
  const parsed = updateSchema.safeParse(request.body)
  if (!parsed.success) return sendError(reply, 400, "VALIDATION", draftMessage(parsed.error.issues[0]?.message))
  const { version, ...draft } = parsed.data
  return updateOrder(pool, session.outletId, idParam(request), version, draft)
})

app.post("/api/v1/orders/:id/cancel", async (request, reply) => {
  const session = await requireSession(request, reply)
  if (!session) return
  const version = z.object({ version: z.number().int().positive() }).safeParse(request.body)
  if (!version.success) return sendError(reply, 400, "VALIDATION", "Open the order again, then cancel it.")
  await cancelOrder(pool, session.outletId, idParam(request), version.data.version)
  return { ok: true }
})

const port = Number(process.env.PORT ?? 4000)
await redis.connect()
try {
  await pool.query("SELECT 1 FROM outlets LIMIT 1")
  await pool.query("DELETE FROM idempotency_keys WHERE created_at < now() - interval '1 day'")
} catch (error) {
  app.log.error(error)
  console.error("Database is not ready. From the repo root run: npm run db:setup")
  process.exit(1)
}
await registerBillingRoutes(app)
await registerPosRoutes(app)
await registerConfigRoutes(app)
await registerMenuAdminRoutes(app)
await registerCatalogRoutes(app)
await registerInventoryRoutes(app)
await registerManagementRoutes(app)
await app.listen({ port, host: "127.0.0.1" })

async function requireSession(request: FastifyRequest, reply: FastifyReply): Promise<Session | null> {
  const session = await readSession(request)
  if (!session) {
    await sendError(reply, 401, "UNAUTHENTICATED", "Sign in to continue.")
    return null
  }
  return session
}

function publicSession(session: Session) {
  return {
    managerName: session.managerName,
    outlet: {
      name: session.outletName,
      timezone: session.timezone,
      currency: session.currency,
      taxRateBps: session.taxRateBps,
    },
  }
}

function idParam(request: FastifyRequest): number {
  const id = Number((request.params as { id: string }).id)
  if (!Number.isInteger(id) || id < 1) {
    throw new OrderError(404, "NOT_FOUND", "That order is not on today's book")
  }
  return id
}

function draftMessage(issue: string | undefined): string {
  if (!issue) return "Check the order and try again."
  if (issue.includes("Array")) return "Add at least one dish."
  return issue
}

