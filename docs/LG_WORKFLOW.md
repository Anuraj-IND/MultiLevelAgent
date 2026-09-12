# LC Workflow (backend view)

## OTP-gated 2-step registration
1. App posts Step 1 → `registration_drafts(open, phone_verified=false)` + OTP sent (dev `123456`).
2. App verifies OTP → drafts for that phone flipped `phone_verified=true`.
3. `GET register/:draftId` renders non-editable echo block.
4. `PATCH register/:draftId` saves address + RM (auto-create by phone) + banking; stored as `draft.updated` event payload (persisted to LG at submit).
5. `POST documents` (4 files, image/pdf ≤5MB) → `lg_documents(draft_id, version+1)` via Supabase Storage (`lg-docs`) with local `uploads/` fallback; SHA256 stored.
6. `GET /api/tos` loads overlay; `POST tos-accept` requires `scrolled_complete:true` + stores name snapshot + ip/ua/timestamp.
7. `POST submit` enforces ALL: OTP ✓, address ✓, banking ✓ + live IFSC lookup ✓, 4 docs ✓, TOS ✓ → creates `lgs(pending,inactive,lg_seq)`, `lg_bank_accounts`, moves docs/draft→LG, emits `lg.created`. Duplicate submit returns existing.
8. `POST login/verify` (phone OTP) → JWT. `GET me/dashboard` returns LG-ID + RM/ISP/PO.

## State machines
- Draft: `open → submitted` (expiry 48h unenforced for now).
- LG verification: `pending → approved|rejected` (staff only). Active toggle independent: `is_active` may go true only if `approved` (FR-LG-04). Deactivation anytime.
- Docs: append-only versions, never overwrite (FR-XCUT-05).
- IFSC: format regex first, then live Razorpay verify at PATCH-time (soft) and mandatory at submit.

## PII notes
- `account_number` + `aadhaar_no` stored AES-256-GCM (`encryptPii`, key=JWT_SECRET). Dashboard returns masked only. Full KMS + decrypt endpoint = Phase 2.
- PAN/phone unique enforced in DB (duplicate onboarding blocked FR-LG-03).
