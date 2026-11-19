# Agent instructions — Petpooja documentation pack

This pack documents the Petpooja restaurant back-office (`billing.petpooja.com` + sub-apps) as the **behavioural encyclopedia**. For a **visual + feature clone**, also follow [`../petpooja-clone/`](../petpooja-clone/). Agents either **build** from both packs or **extend** these observation docs.

## If you are building the full clone

1. Follow [`../petpooja-clone/AGENTS.md`](../petpooja-clone/AGENTS.md) and the assigned wave in the clone backlog.
2. Use this pack’s modules for fields, endpoints, and workflows.
3. Do **not** use the REA Counter MVP UI as the Petpooja shell.

## If you are building a domain module (sub-agent)

1. Take your brief from [dev/subagent-task-briefs.md](./dev/subagent-task-briefs.md), including the shared preamble. For UI, defer to the clone fidelity rules.
2. Read [dev/implementation-roadmap.md](./dev/implementation-roadmap.md) for the architecture principles and phase dependencies. Don't start a phase before the phases it depends on exist, or stub them behind interfaces.
3. Use [reference/data-model.md](./reference/data-model.md) and [reference/enums-and-options.md](./reference/enums-and-options.md) as starting points. The design is yours.
4. Petpooja's field keys (`data[Restaurant][s_l_a]` and so on) and endpoints in [reference/api-endpoint-inventory.md](./reference/api-endpoint-inventory.md) are **hints about capability**. Do not reproduce them as your API.
5. Items marked *unknown*, *inferred* or *open question* are decisions for you. Record them in `DECISIONS.md` in the target repo.
6. Do not copy Petpooja branding, wording, images or assets.

## If you are extending the docs

### Capture method (preferred order)

1. **Cursor browser** on the user's logged-in tab: snapshot + screenshot per screen, and record the URL, title and breadcrumb.
2. **Same-origin read-only parse**: `fetch(url, {credentials:'include'})` + `DOMParser`. Then extract `#content` form fields (label, type, name, options), tabs, buttons, modals, and the AJAX URL literals in inline `<script>`. Define the extractor inline per call; do not persist code in page storage.
3. **REA** for HAR / bundle analysis (see below).

### Rules

- **Read-only.** Never submit forms that save, delete, push, purchase or send messages. Opening modals and filters is fine.
- **No secrets or PII:**
  - no passwords, OTPs, cookies or tokens;
  - no customer phone numbers, emails or names;
  - no other tenants' outlet names.
  - Write `{restaurant_id}` in place of the outlet id.
- Mark each fact as **observed**, **inferred** or **unknown**.
- Sub-apps on other domains (`inventory.`, `finance.`, …) may need user approval before navigation.

### File conventions

- One file per logical module under `modules/NN-name.md`, from [_TEMPLATE-module.md](./_TEMPLATE-module.md).
- Header on every file:

  ```markdown
  **Status:** draft | reviewed | partial | stale
  **Last verified:** YYYY-MM-DD
  **Source:** browser observation | server HTML parse | network capture | user input
  ```

- Use tables for fields, enums and endpoints, and Mermaid for lifecycles.
- Keep field keys verbatim in a `Key` column.
- Link across files with relative paths and heading anchors.
- When you add a module, update [README.md](./README.md), [FEATURES-EXPLAINED.md](./FEATURES-EXPLAINED.md), [reference/route-map.md](./reference/route-map.md) and, if a new build area appears, [dev/subagent-task-briefs.md](./dev/subagent-task-briefs.md).

### Coverage status and gaps

| Area | Status |
| --- | --- |
| Billing sidebar (all items) | done |
| Menu, Inventory sub-apps | done (some on-demand popups not opened) |
| Finance, Audit, Marketplace | done |
| Marketing Automation | landing only (not subscribed) |
| Tasks, TRM, Purchase, Bazaar, Supplier, Dynamic Dashboard, Google Business | **not opened** |
| POS desktop billing screen | **not captured** (settings only) |
| Per-report filters/columns | **not captured** |
| Populated grids / real data shapes | **not captured** (demo outlet has no sales) |

## REA integration

[`rea/`](../../rea/) is REA v6.9 (`rea-agents`). In this workspace:

- Dependencies are installed and `dist/` is built.
- **The CLI refuses to run on Node 24.9.0**, the only version installed: both Homebrew `node` and `node@24` are 24.9.0.
- REA needs Node 22.23.4+, 24.22.1+ or 26.12.1+. Upgrade with `brew upgrade node` (or install a supported Node with a version manager), then run `node rea/scripts/rea.mjs --help`.

Useful REA tools for this target (MCP names; the CLI equivalents use kebab-case):

| Goal | Tool |
| --- | --- |
| Passive capture of the logged-in tab (Chrome with `--remote-debugging-port` on loopback) | `list_browser_targets` → `inspect_web_page`, `observe_web_session` while a human clicks through |
| Route/endpoint candidates from Petpooja's JS bundles | `export_web_scripts` → `analyze_web_bundle`, `recover_javascript_sources` |
| Request/response schemas from a HAR saved in DevTools | `inspect_web_network_capture` |
| Mock back-office for agent testing | `export_environment_bundle` / `rea environment-build ./session.har ./petpooja-env --name petpooja --json` |

Only use a **test/demo account** for HAR captures, and redact before saving inside the repo. Environment semantics are in `rea/docs/specs/agent-environments/`. Auth/billing path heuristics are in `rea/src/domain/javascript/javascriptRouteInventory.ts`.