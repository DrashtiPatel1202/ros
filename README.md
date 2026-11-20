# ros

Restaurant Order Management (Petpooja-style billing clone + API).

## Local development

```bash
npm install
npm run db:setup          # only if using local Postgres
npm run dev:clone         # API :4000 + billing :5174
```

Open **`http://127.0.0.1:5174`**. Demo billing login: `demo@harbour.kitchen` / `demo1234`.

### Shared DB/Redis on EC2 (team testing)

Use a **`.env`** at the repo root (`DATABASE_URL`, `REDIS_URL`) — see **`.env.example`** and **`docs/deploy/`**. Credentials live under **`CREDS/`** (gitignored).

```bash
npm run dev:clone
curl http://127.0.0.1:4000/api/v1/health
```

Full guide: [docs/deploy/README.md](docs/deploy/README.md).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev:clone` | API + billing (clone UI) |
| `npm run dev:counter` | API + web counter |
| `npm run db:setup` | Initialize / seed database |
| `npm test` | Pricing + API integration tests |

## Documentation

- [Deployment & hybrid dev](docs/deploy/README.md)
- [Product / clone status](docs/petpooja-clone/DEVELOPMENT-STATUS.md)