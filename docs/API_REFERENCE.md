# Covermint LC — API Reference (backend only)

Base: `http://localhost:10000` local, `https://<your-app>.onrender.com` prod.
Swagger UI: `GET /api-docs` · Spec: `GET /openapi.json`
Auth: LG JWT `Authorization: Bearer <token>` on `/me/*`. Staff endpoints need any valid JWT for now (enforce checker role in Phase 2).

## Registration (2-step + TOS overlay)

| Method | Path | Body / Notes |
|---|---|---|
| POST | /api/lg/register/init | `{name,phone,email,pan_no}` → `{draft_id, otp:{dev, hint}}`. 409 on duplicate PAN/phone |
| POST | /api/lg/otp/send | `{phone,purpose}` dev returns `{dev:true}` |
| POST | /api/lg/otp/verify | `{phone,otp,purpose}` dev OTP `123456` → marks drafts phone_verified |
| GET | /api/lg/register/:draftId | read-only echo Step 1 + docs + tos status |
| PATCH | /api/lg/register/:draftId | `{address_aadhaar,pincode,current_address,rm_name,rm_number,aadhaar_no,banking:{bank_name,branch,ifsc,account_number,bank_address}}`. RM auto-created by phone |
| POST | /api/lg/register/:draftId/documents | multipart fields `aadhaar_front,aadhaar_back,pan_card,cheque` (image/pdf ≤5MB each), versioned |
| GET | /api/tos?version=latest | overlay text `{version,text,text_hash}` |
| POST | /api/lg/register/:draftId/tos-accept | `{name,tos_version,scrolled_complete:true}` → stores ip/ua/timestamp. 400 unless scrolled_complete |
| POST | /api/lg/register/:draftId/submit | gated: OTP + address + banking + live IFSC verify + 4 docs + TOS → `{lg_id, lg_seq, verification_status:pending}` |

## Login + Dashboard

| POST | /api/lg/login/verify | `{phone,otp}` → `{token, lg_seq, id}` |
| GET | /api/lg/me/dashboard | LGJWT → `{lg_id,name,phone,email,aadhaar_masked,rm_name,rm_phone,isp_name,po_name,verification_status,is_active}` |

## Sell hub + bottom nav (stubs, final shape)

| GET | /api/lg/catalog/insurance | `[{life},{motor},{health}]` |
| POST | /api/lg/intents/policy | LGJWT `{category,payload}` → intent row |
| GET | /api/lg/me/leads | `{data,page,total}` empty until Lead module |
| GET | /api/lg/me/renewals | `{data,buckets:{d30,d60,d90}}` empty until renewal engine |
| GET | /api/lg/me/performance | `{leads_generated,conversion_pct,commission_earned}` feeds ISP/Accounts later |

## Admin / RM

| GET | /api/lg?type=&verification=&search=&page=&limit= | paginated list |
| GET | /api/lg/export | `Covermint_LG_Report_YYYY-MM-DD.csv` (filtered set, audited) |
| PATCH | /api/lg/:id/verify | `{decision:approved\|rejected}` → emits `lg.verified` |
| PATCH | /api/lg/:id/active | `{is_active}` → 400 if activating while not approved (FR-LG-04) |

## Utils

| POST | /api/utils/ifsc/verify | `{ifsc}` → `{bank,branch,address,verified}` via free Razorpay API, cached 30d |
| GET | /health | `{ok:true}` |

## Error shape

`{error: string}` with status 400 validation / 401 auth / 404 missing / 409 duplicate / 429 OTP abuse.
Every write + every CSV export lands in `audit_logs`; `lg.created`/`lg.verified`/`draft.updated` land in `events_outbox`.
