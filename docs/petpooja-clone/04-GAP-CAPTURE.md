# Capture gaps (blockers for 100% clone fidelity)

Anything here is **still required** for a complete clone, but was not fully observed on 2026-11-19. Until captured: implement Shell only / marketing-like pages, then replace.

## Never opened / separate login

| Area | Gap | Capture method when available |
| --- | --- | --- |
| Dynamic Dashboard (`dashboard.petpooja.com`) | Separate login; internals unknown | Log in; screenshot every widget; dump routes |
| Marketing Automation app | Account not subscribed; landing only | Subscribe or demo; capture plans, campaign builder, segments |
| Google Business (Beta) | Sidebar item; no page | Click when available |
| Attendo / Tasks / TRM / Purchase / Bazaar / Suppliers | Entry only | Open each host; nav sweep like billing |
| Community SSO | Not opened | Capture forum chrome if in scope |

## Observed but incomplete

| Area | Gap |
| --- | --- |
| All Orders / report grids | Demo had no sales — column sets from AJAX not fully listed |
| Category / variation / addon / table add-edit popups | Loaded on demand; fields inferred |
| Per-report filter forms | Catalogue known; individual "View Details" not opened for all ~100 |
| Sign-in credential step | User completed manually; password vs OTP branching incomplete |
| Online channel list | ~600 names — store as data file when scraped, do not hardcode in UI code |
| Payment providers / payout statuses | Large enums partially listed; scrape full `<option>` lists |

## POS client (outside browser)

| Area | Gap |
| --- | --- |
| Desktop / Android POS billing UI | Only settings known via outlet config |
| Print layouts | Settings known; WYSIWYG unknown |
| Sync protocol wire format | Settings (batch size, intervals) known; packets unknown |

**Capture plan:** screen-record POS while ordering; optional REA/HAR on sync traffic with a test outlet.

## UI asset extraction (for fidelity)

| Need | Status |
| --- | --- |
| Exact accent hexes, button radii, table cell padding | Sampled partially (`#fafafa`, InterVariable, Bootstrap 5) — do a token dump pass before Wave 0 CSS freeze |
| Logo / illustration slots | Sizes needed; do not hotlink production CDN long-term |
| Fancybox / toast markup | Pattern known; extract HTML snippets during Wave 0 |

## How to update this file

When you capture something:

1. Write details into the matching `petpooja-billing` module (or a new one).  
2. Remove or shrink the gap row here.  
3. Flip the screen from Capture then clone → Must clone with deeper Spec depth in [02-SCREEN-INVENTORY.md](./02-SCREEN-INVENTORY.md).