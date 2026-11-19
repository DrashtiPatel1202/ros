import { pool } from "./db.ts"

export async function writeAudit(input: {
  outletId: number
  actorName: string
  category: string
  action: string
  summary: string
  entityType?: string
  entityId?: string
  source?: string
  before?: unknown
  after?: unknown
}) {
  await pool.query(
    `INSERT INTO audit_events
       (outlet_id, actor_name, source, category, action, entity_type, entity_id, summary, before, after)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
    [
      input.outletId,
      input.actorName,
      input.source ?? "web",
      input.category,
      input.action,
      input.entityType ?? "",
      input.entityId ?? "",
      input.summary,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
    ],
  )
}
