import { randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"
import { hashPin } from "./crypto.ts"

const databaseUrl = process.env.DATABASE_URL ?? "postgres://localhost:5432/rea_pos"
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "")
if (!/^[a-z][a-z0-9_]*$/.test(databaseName)) throw new Error("Refusing an unsafe database name")

const admin = new pg.Client({ connectionString: databaseUrl.replace(`/${databaseName}`, "/postgres") })
await admin.connect()
const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName])
if (!existing.rowCount) await admin.query(`CREATE DATABASE ${databaseName}`)
await admin.end()

const client = new pg.Client({ connectionString: databaseUrl })
await client.connect()
const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "../sql/001_init.sql")
await client.query(readFileSync(sqlPath, "utf8"))

const outlets = await client.query("SELECT id FROM outlets LIMIT 1")
if (!outlets.rowCount) {
  const outlet = await client.query<{ id: string }>(
    `INSERT INTO outlets (name, timezone, currency, tax_rate_bps)
     VALUES ('Harbour Kitchen', 'Asia/Kolkata', 'INR', 500)
     RETURNING id`,
  )
  const outletId = outlet.rows[0]!.id
  await client.query(
    `INSERT INTO managers (outlet_id, display_name, pin_hash) VALUES ($1, 'Floor manager', $2)`,
    [outletId, hashPin("1234")],
  )

  const categories = [
    ["Starters", ["Veg Manchurian|MANCH|22000|veg", "Paneer Tikka|TIKKA|28000|veg", "Chicken 65|C65|29000|non_veg", "Tomato Soup|SOUP|14000|veg"]],
    ["Mains", ["Paneer Butter Masala|PBM|32000|veg", "Dal Tadka|DAL|22000|veg", "Kadai Chicken|KADAI|36000|non_veg", "Egg Curry|EGGCURRY|26000|egg", "Veg Biryani|VBIR|28000|veg"]],
    ["Breads", ["Butter Naan|NAAN|5000|veg", "Tandoori Roti|ROTI|3000|veg", "Garlic Naan|GNAAN|7000|veg", "Lachha Paratha|PARA|6000|veg"]],
    ["Rice", ["Steamed Rice|RICE|12000|veg", "Jeera Rice|JEERA|15000|veg", "Chicken Biryani|CBIR|34000|non_veg"]],
    ["Beverages", ["Masala Chai|CHAI|4000|veg", "Sweet Lassi|LASSI|8000|veg", "Fresh Lime|LIME|6000|veg", "Cold Coffee|COFFEE|12000|veg"]],
    ["Desserts", ["Gulab Jamun|JAMUN|9000|veg", "Brownie|BROWNIE|14000|egg", "Vanilla Ice Cream|ICE|8000|veg"]],
  ] as const

  for (const [index, [name, items]] of categories.entries()) {
    const category = await client.query<{ id: string }>(
      `INSERT INTO menu_categories (outlet_id, name, sort_rank) VALUES ($1, $2, $3) RETURNING id`,
      [outletId, name, index],
    )
    const categoryId = category.rows[0]!.id
    for (const [itemIndex, spec] of items.entries()) {
      const [itemName, shortCode, price, dietary] = spec.split("|")
      await client.query(
        `INSERT INTO menu_items (outlet_id, category_id, name, short_code, price_paise, dietary, sort_rank)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [outletId, categoryId, itemName, shortCode, Number(price), dietary, itemIndex],
      )
    }
  }
}

await client.end()
console.log(`Database ${databaseName} is ready. Manager PIN: 1234`)
