# Agent rules — Petpooja full clone

You are cloning **Petpooja Billing** (and linked sub-apps) for feature + UI parity. Behavioural truth lives in `docs/petpooja-billing/`. Clone law lives in `docs/petpooja-clone/`.

## Before writing code (when development is requested)

1. Read [00-CLONE-CHARTER.md](./00-CLONE-CHARTER.md) and [01-UI-FIDELITY.md](./01-UI-FIDELITY.md).  
2. Take the assigned wave from [03-CLONE-BACKLOG.md](./03-CLONE-BACKLOG.md).  
3. For each screen, open the linked module under `petpooja-billing/` and the live Petpooja URL if the user has a session.  
4. Update [02-SCREEN-INVENTORY.md](./02-SCREEN-INVENTORY.md) Impl column as you go.  

## Do

- Match Petpooja shell, control order, labels, filters, and empty states.  
- Prefer Bootstrap 5 + InterVariable + light admin chrome.  
- Keep list/export/modal patterns Petpooja-like.  
- Mark unknowns in [04-GAP-CAPTURE.md](./04-GAP-CAPTURE.md) instead of inventing a different UX.  
- Use side-by-side screenshots as acceptance evidence.  

## Do not

- Continue or restyle the REA Counter MVP (`apps/web` cream/Fraunces) as the billing product.  
- "Simplify" Petpooja into fewer screens for convenience.  
- Invent purple/cream redesign systems.  
- Commit credentials, cookies, OTPs, or customer PII.  
- Hotlink `billingcdn.petpooja.com` as a permanent dependency.  
- Claim Full in the inventory without UI fidelity checklist.  

## Relationship to older subagent briefs

`petpooja-billing/dev/subagent-task-briefs.md` is useful for **domain engines** (tax, discounts, sync). For **UI**, this clone pack overrides it: the UI must look like Petpooja, not a greenfield counter.

## Capture while building

If a fancybox or report is still undocumented, pause implementation, capture fields into `petpooja-billing`, then continue. Do not skip the capture and guess the form.