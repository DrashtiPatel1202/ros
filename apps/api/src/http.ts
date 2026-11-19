import type { FastifyReply, FastifyRequest } from "fastify"
import { redis } from "./redis.ts"

export type Session = {
  managerId: number
  managerName: string
  outletId: number
  outletName: string
  timezone: string
  currency: string
  taxRateBps: number
}

const COOKIE = "rea_session"

export function readToken(request: FastifyRequest): string | null {
  const header = request.headers.cookie
  if (!header) return null
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === COOKIE) return decodeURIComponent(rest.join("="))
  }
  return null
}

export async function readSession(request: FastifyRequest): Promise<Session | null> {
  const token = readToken(request)
  if (!token) return null
  const raw = await redis.get(`session:${token}`)
  if (!raw) return null
  return JSON.parse(raw) as Session
}

export async function writeSession(reply: FastifyReply, token: string, session: Session) {
  await redis.set(`session:${token}`, JSON.stringify(session), "EX", 60 * 60 * 12)
  reply.header(
    "set-cookie",
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 12}`,
  )
}

export async function clearSession(request: FastifyRequest, reply: FastifyReply) {
  const token = readToken(request)
  if (token) await redis.del(`session:${token}`)
  reply.header("set-cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
}

export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return reply.status(status).send({ error: { code, message, ...details } })
}
