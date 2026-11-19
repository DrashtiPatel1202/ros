# Petpooja Billing — full clone pack

**Goal:** rebuild `https://billing.petpooja.com` (and the linked Petpooja sub-apps reachable from it) so a user who knows Petpooja cannot tell the difference in **features or UI**, except where this pack explicitly marks a gap or a deliberate stand-in.

**Status:** Wave 0 + Wave 1 **started** in `apps/billing`. See [DEVELOPMENT-STATUS.md](./DEVELOPMENT-STATUS.md). The earlier REA Counter MVP (`apps/web`) is **not** this product.

**Source of behavioural detail:** [`../petpooja-billing/`](../petpooja-billing/) (screen fields, endpoints, enums, workflows observed 2026-11-19).

## Start here (in order)

| # | Doc | Purpose |
| --- | --- | --- |
| 1 | [00-CLONE-CHARTER.md](./00-CLONE-CHARTER.md) | What "complete clone" means, scope boundaries, acceptance bar |
| 2 | [01-UI-FIDELITY.md](./01-UI-FIDELITY.md) | Same UI rules: shell, layout, CSS stack, interaction patterns |
| 3 | [02-SCREEN-INVENTORY.md](./02-SCREEN-INVENTORY.md) | Every screen / nav leaf with clone status and depth |
| 4 | [03-CLONE-BACKLOG.md](./03-CLONE-BACKLOG.md) | Ordered build waves for when you ask for development |
| 5 | [04-GAP-CAPTURE.md](./04-GAP-CAPTURE.md) | What was never opened or never reverse-engineered yet |
| 6 | [AGENTS.md](./AGENTS.md) | Rules for agents that will build the clone later |

## How this pack relates to the older docs

| Pack | Role |
| --- | --- |
| **This pack (`petpooja-clone/`)** | Clone charter: **same product + same UI** |
| [`petpooja-billing/`](../petpooja-billing/) | Feature encyclopedia: fields, filters, endpoints, enums |
| [`mvp/`](../mvp/) | Narrow counter prototype — **out of scope** for the clone unless you merge it later |

When a screen is listed here, implement it by combining:

1. This pack's UI and acceptance rules  
2. The matching module file under `petpooja-billing/` (e.g. `modules/03-orders-billing.md`)  
3. [`petpooja-billing/reference/route-map.md`](../petpooja-billing/reference/route-map.md) for URLs  
4. Live Petpooja for visual parity (side-by-side), while you still have a login  

## What to do next

1. Read the charter and the screen inventory.  
2. Decide brand naming (keep "Petpooja" only if you have rights; otherwise mirror layout/copy structure with your brand).  
3. When you are ready, ask for development and name the first wave from [03-CLONE-BACKLOG.md](./03-CLONE-BACKLOG.md) (recommended: Wave 0 shell + auth + dashboard chrome).