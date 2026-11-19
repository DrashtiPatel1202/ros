import type { FastifyReply, FastifyRequest } from "fastify"
import { sendError } from "./http.ts"
import { redis } from "./redis.ts"

const COOKIE = "rea_billing_session"

export type BillingPrincipal = {
  adminId: number
  adminName: string
  email: string
  outletId: number
  outletName: string
  timezone: string
}

export async function requireBilling(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.cookie
  let token: string | null = null
  if (header) {
    for (const part of header.split(";")) {
      const [name, ...rest] = part.trim().split("=")
      if (name === COOKIE) token = decodeURIComponent(rest.join("="))
    }
  }
  if (!token) {
    await sendError(reply, 401, "UNAUTHENTICATED", "Sign in to continue.")
    return null
  }
  const raw = await redis.get(`billing-session:${token}`)
  if (!raw) {
    await sendError(reply, 401, "UNAUTHENTICATED", "Sign in to continue.")
    return null
  }
  return JSON.parse(raw) as BillingPrincipal
}
