# Petpooja Billing — product documentation pack

Observation-based encyclopedia of Petpooja Billing (`billing.petpooja.com` + linked sub-apps), captured 2026-11-19. Use this for **what the product does** (fields, endpoints, workflows).

## If you are cloning Petpooja (same features + same UI)

**Primary pack:** [`../petpooja-clone/`](../petpooja-clone/)

| Start with | Purpose |
| --- | --- |
| [Clone README](../petpooja-clone/README.md) | Entry |
| [Clone charter](../petpooja-clone/00-CLONE-CHARTER.md) | Definition of done |
| [UI fidelity](../petpooja-clone/01-UI-FIDELITY.md) | Same UI rules |
| [Screen inventory](../petpooja-clone/02-SCREEN-INVENTORY.md) | Every screen + clone status |
| [Clone backlog](../petpooja-clone/03-CLONE-BACKLOG.md) | Waves when development starts |

This `petpooja-billing/` tree remains the **behavioural source of truth** those clone docs point at. Do **not** use the REA Counter MVP UI as the clone shell.

## Other audiences

| You are… | Read |
| --- | --- |
| Learning the product in plain language | [FEATURES-EXPLAINED.md](./FEATURES-EXPLAINED.md) |
| Extending these observation docs | [AGENTS.md](./AGENTS.md) |
| Implementing domain engines later | [dev/](./dev/) + module files |

## Module index

| Doc | Status | Covers |
| --- | --- | --- |
| [00-overview.md](./00-overview.md) | reviewed | Product map, sub-app domains, architecture |
| [01-authentication.md](./01-authentication.md) | reviewed | Sign-in, 2FA, step-up, SSO, logout |
| [02-dashboard.md](./02-dashboard.md) | reviewed | Global shell, AI agent, widgets, Action Center |
| [modules/03-orders-billing.md](./modules/03-orders-billing.md) | reviewed | Live / All / Online Orders, KOT, Day End, Delivery |
| [modules/04-menu-management.md](./modules/04-menu-management.md) | reviewed | Menu sub-app |
| [modules/05-inventory.md](./modules/05-inventory.md) | reviewed | Inventory sub-app |
| [modules/06-reports.md](./modules/06-reports.md) | reviewed | 100+ reports |
| [modules/07-outlet-configuration.md](./modules/07-outlet-configuration.md) | reviewed | 15 outlet settings pages |
| [modules/08-accounting-payments.md](./modules/08-accounting-payments.md) | reviewed | Payouts, wallet, expenses, … |
| [modules/09-users-devices.md](./modules/09-users-devices.md) | reviewed | Staff, devices, apps |
| [modules/10-logs-audit.md](./modules/10-logs-audit.md) | reviewed | Logs + Audit Trail |
| [modules/11-crm-marketing.md](./modules/11-crm-marketing.md) | reviewed | CRM, campaigns, loyalty |
| [modules/12-marketplace-integrations.md](./modules/12-marketplace-integrations.md) | reviewed | Marketplace + integrations |
| [modules/13-finance.md](./modules/13-finance.md) | reviewed | Finance SPA |
| [modules/14-ecosystem-apps.md](./modules/14-ecosystem-apps.md) | partial | Ecosystem products |

## Reference

| Doc | Purpose |
| --- | --- |
| [reference/route-map.md](./reference/route-map.md) | Sidebar → URL |
| [reference/api-endpoint-inventory.md](./reference/api-endpoint-inventory.md) | ~300 observed endpoints |
| [reference/data-model.md](./reference/data-model.md) | Inferred entities |
| [reference/enums-and-options.md](./reference/enums-and-options.md) | Dropdowns / statuses |

## Development notes (legacy relative to clone)

| Doc | Note |
| --- | --- |
| [dev/implementation-roadmap.md](./dev/implementation-roadmap.md) | Domain architecture; **UI direction superseded** by clone UI fidelity |
| [dev/subagent-task-briefs.md](./dev/subagent-task-briefs.md) | Domain briefs; UI must follow `petpooja-clone` |
| [../mvp/FEATURE-STATUS.md](../mvp/FEATURE-STATUS.md) | Narrow counter MVP — **not** the full clone |

## Legal

- No credentials, tokens, or customer PII in the repo.  
- Petpooja is a trademark of Prayosha Food Services Pvt. Ltd.