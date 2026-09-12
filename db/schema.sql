-- Covermint LC schema (pg, no ORM). Idempotent.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Departments: single enum source (FR-XCUT-01)
CREATE TABLE IF NOT EXISTS departments (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO departments(code,name) VALUES
 ('LIFE','Life'),('HEALTH','Health'),('MOTOR','Motor'),
 ('NON_MOTOR','Non-Motor'),('GROUP','Group'),('HR','HR'),
 ('ACCOUNTS','Accounts'),('CRM','CRM')
ON CONFLICT (code) DO NOTHING;

-- Hierarchy stub (FR-HIER-01 minimal for LC)
CREATE TABLE IF NOT EXISTS hierarchy_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_level INT NOT NULL CHECK (role_level BETWEEN 1 AND 8),
  parent_id UUID REFERENCES hierarchy_nodes(id),
  employee_name TEXT,
  department TEXT REFERENCES departments(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RMs (source RM for LG)
CREATE TABLE IF NOT EXISTS rms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  employee_code TEXT,
  hierarchy_id UUID REFERENCES hierarchy_nodes(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','on_leave')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step-1 drafts (name, phone+OTP, mail, PAN) before full submit
CREATE TABLE IF NOT EXISTS registration_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  pan_no TEXT NOT NULL,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','submitted','expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '48 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafts_phone ON registration_drafts(phone);

-- LGs: one table + lg_type discriminator (FR-LG-01)
CREATE TABLE IF NOT EXISTS lgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lg_seq SERIAL UNIQUE,
  lg_type TEXT NOT NULL DEFAULT 'INDIVIDUAL' CHECK (lg_type IN ('INDIVIDUAL','COMPANY')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  pan_no TEXT NOT NULL UNIQUE,
  aadhaar_no_encrypted TEXT,
  address_aadhaar TEXT,
  pincode TEXT,
  current_address TEXT,
  source_rm_id UUID REFERENCES rms(id),
  isp_name TEXT,
  po_name TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','approved','rejected')),
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  type_specific_data JSONB NOT NULL DEFAULT '{}',
  draft_id UUID REFERENCES registration_drafts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Start display LG-ID at 12345: ALTER SEQUENCE after first deploy if needed
-- SELECT setval('lgs_lg_seq_seq', 12344);  -- run once on fresh DB so first LG = 12345

-- Banking per LG
CREATE TABLE IF NOT EXISTS lg_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lg_id UUID NOT NULL UNIQUE REFERENCES lgs(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  branch TEXT,
  ifsc TEXT NOT NULL,
  account_no_encrypted TEXT NOT NULL,
  bank_address TEXT,
  ifsc_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ifsc_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents, versioned (FR-XCUT-05). draft_id allows upload before final submit.
CREATE TABLE IF NOT EXISTS lg_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lg_id UUID REFERENCES lgs(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES registration_drafts(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('aadhaar_front','aadhaar_back','pan_card','cheque')),
  file_url TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (lg_id IS NOT NULL OR draft_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_docs_draft ON lg_documents(draft_id);
CREATE INDEX IF NOT EXISTS idx_docs_lg ON lg_documents(lg_id);

-- TOS versions + acceptances (overlay scroll proof)
CREATE TABLE IF NOT EXISTS tos_versions (
  version TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO tos_versions(version, text, text_hash) VALUES
 ('v1', 'Covermint LG Terms of Service (placeholder v1). By accepting you confirm details are true, you consent to KYC verification and data storage per company policy. Full legal text to be pasted by owner.', 'placeholder-v1')
ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS tos_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lg_id UUID REFERENCES lgs(id),
  draft_id UUID REFERENCES registration_drafts(id),
  tos_version TEXT NOT NULL REFERENCES tos_versions(version),
  name_snapshot TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT
);

-- OTP (dev bypass 123456 when OTP_MODE=dev)
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'register' CHECK (purpose IN ('register','login')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '10 minutes',
  attempts INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone);

-- Sell-hub policy intents (stubs for life/motor/health full impl later)
CREATE TABLE IF NOT EXISTS policy_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lg_id UUID NOT NULL REFERENCES lgs(id),
  category TEXT NOT NULL CHECK (category IN ('life','motor','health')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','quoted','issued','lapsed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail (FR-SYS-02, includes CSV exports)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT,
  actor_type TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);

-- Event outbox (FR-ERP-02 stub: lg.created, lg.verified, ...)
CREATE TABLE IF NOT EXISTS events_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
