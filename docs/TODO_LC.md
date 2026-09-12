# TODO_LC — live tracker

## Done
- [x] Express + pg + Swagger skeleton (`/health`, `/api-docs`, `/openapi.json` smoke-tested)
- [x] Prisma 7.10.0: `prisma/schema.prisma` valid, `prisma generate` ok, `prisma.config.ts` (dotenv) wired
- [x] First migration `20260912090110_init` applied via **session pooler** (IPv4); direct host is IPv6-only here
- [x] Seed: 8 departments, TOS v1, `lg_seq` starts at 12345
- [x] Full E2E `node e2e-lc.js`: init→OTP(123456)→step2→4 docs→TOS→submit(lg_seq 12345)→login→dashboard→catalog→intent→performance→verify approved→active true→list→CSV export. ALL GREEN
- [x] Swagger: full spec in `openapi/` (base + parts/lg + parts/staff + parts/utils, 21 paths, request/response schemas + examples + bearer auth) served at `/api-docs` + `/openapi.json`; verified locally — every POST/PATCH shows its JSON body with Try-it-out
- [x] SQL schema: drafts, lgs(lg_seq), bank, docs(versioned), TOS, OTP, rms, intents, audit, outbox
- [x] Register/OTP/docs/TOS/submit/dashboard + sell/lead/renewal/performance stubs + CSV export
- [x] IFSC proxy (Razorpay free, HDFC0001233 verified live), storage abstraction (local fallback active)
- [x] Docs: API_REFERENCE.md, LG_WORKFLOW.md, this file

## Left
- [x] Storage: private `lg-docs` bucket live; `storage.js` uses signed URLs (1yr); verified upload→signed URL→reachable (test object under `verify/` prefix, safe to delete)
- [x] Deploy-ready: `render.yaml` committed (build `npm install && npx prisma generate && npx prisma migrate deploy`, `healthCheckPath: /health`); secrets verified OUT of git (only placeholders in `.env.example`/TODO); `.env` + `generated/` + `uploads/` gitignored
- [ ] Replace placeholder TOS v1 with legal text; rotate leaked `sb_secret` + DB password after first deploy
- [ ] Negative-case tests: duplicate PAN 409, activate-before-approval 400, bad OTP 400, missing doc 400
- [ ] Phase 2: Prisma Client runtime (needs TypeScript; v7 generates TS-only), KMS decrypt, staff roles
