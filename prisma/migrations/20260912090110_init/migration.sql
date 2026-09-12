-- CreateTable
CREATE TABLE "departments" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "hierarchy_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_level" INTEGER NOT NULL,
    "parent_id" UUID,
    "employee_name" TEXT,
    "department" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hierarchy_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "employee_code" TEXT,
    "hierarchy_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_drafts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pan_no" TEXT NOT NULL,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'open',
    "expires_at" TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '48 hours',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lgs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lg_seq" SERIAL NOT NULL,
    "lg_type" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pan_no" TEXT NOT NULL,
    "aadhaar_no_encrypted" TEXT,
    "address_aadhaar" TEXT,
    "pincode" TEXT,
    "current_address" TEXT,
    "source_rm_id" UUID,
    "isp_name" TEXT,
    "po_name" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'pending',
    "verified_by" TEXT,
    "verified_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "type_specific_data" JSONB NOT NULL DEFAULT '{}',
    "draft_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lg_bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lg_id" UUID NOT NULL,
    "bank_name" TEXT NOT NULL,
    "branch" TEXT,
    "ifsc" TEXT NOT NULL,
    "account_no_encrypted" TEXT NOT NULL,
    "bank_address" TEXT,
    "ifsc_verified" BOOLEAN NOT NULL DEFAULT false,
    "ifsc_response" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lg_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lg_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lg_id" UUID,
    "draft_id" UUID,
    "doc_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lg_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tos_versions" (
    "version" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "text_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tos_versions_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "tos_acceptances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lg_id" UUID,
    "draft_id" UUID,
    "tos_version" TEXT NOT NULL,
    "name_snapshot" TEXT NOT NULL,
    "accepted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "tos_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'register',
    "expires_at" TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '10 minutes',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_intents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lg_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" TEXT,
    "actor_type" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rms_phone_key" ON "rms"("phone");

-- CreateIndex
CREATE INDEX "registration_drafts_phone_idx" ON "registration_drafts"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "lgs_lg_seq_key" ON "lgs"("lg_seq");

-- CreateIndex
CREATE UNIQUE INDEX "lgs_phone_key" ON "lgs"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "lgs_pan_no_key" ON "lgs"("pan_no");

-- CreateIndex
CREATE UNIQUE INDEX "lg_bank_accounts_lg_id_key" ON "lg_bank_accounts"("lg_id");

-- CreateIndex
CREATE INDEX "lg_documents_draft_id_idx" ON "lg_documents"("draft_id");

-- CreateIndex
CREATE INDEX "lg_documents_lg_id_idx" ON "lg_documents"("lg_id");

-- CreateIndex
CREATE INDEX "otp_verifications_phone_idx" ON "otp_verifications"("phone");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "hierarchy_nodes" ADD CONSTRAINT "hierarchy_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "hierarchy_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hierarchy_nodes" ADD CONSTRAINT "hierarchy_nodes_department_fkey" FOREIGN KEY ("department") REFERENCES "departments"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rms" ADD CONSTRAINT "rms_hierarchy_id_fkey" FOREIGN KEY ("hierarchy_id") REFERENCES "hierarchy_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lgs" ADD CONSTRAINT "lgs_source_rm_id_fkey" FOREIGN KEY ("source_rm_id") REFERENCES "rms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lgs" ADD CONSTRAINT "lgs_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "registration_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lg_bank_accounts" ADD CONSTRAINT "lg_bank_accounts_lg_id_fkey" FOREIGN KEY ("lg_id") REFERENCES "lgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lg_documents" ADD CONSTRAINT "lg_documents_lg_id_fkey" FOREIGN KEY ("lg_id") REFERENCES "lgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lg_documents" ADD CONSTRAINT "lg_documents_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "registration_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tos_acceptances" ADD CONSTRAINT "tos_acceptances_lg_id_fkey" FOREIGN KEY ("lg_id") REFERENCES "lgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tos_acceptances" ADD CONSTRAINT "tos_acceptances_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "registration_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tos_acceptances" ADD CONSTRAINT "tos_acceptances_tos_version_fkey" FOREIGN KEY ("tos_version") REFERENCES "tos_versions"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_intents" ADD CONSTRAINT "policy_intents_lg_id_fkey" FOREIGN KEY ("lg_id") REFERENCES "lgs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
