# REA-POS documentation

| Pack | Purpose |
| --- | --- |
| **[petpooja-clone/](./petpooja-clone/)** | **Full clone charter** — same Petpooja Billing features + same UI. Start here when the goal is to clone the software. |
| [petpooja-billing/](./petpooja-billing/) | Observed feature encyclopedia (fields, routes, endpoints, plain-language explanation) |
| [mvp/](./mvp/) | Narrow REA Counter experiment — not the full clone |

## Run the clone (Wave 0 + 1 in progress)

```bash
npm install
npm run db:setup
npm run dev:clone
```

Open http://127.0.0.1:5174 — login `demo@harbour.kitchen` / `demo1234`.

Progress: [`petpooja-clone/DEVELOPMENT-STATUS.md`](./petpooja-clone/DEVELOPMENT-STATUS.md).
