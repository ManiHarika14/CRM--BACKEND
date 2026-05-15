-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "source" TEXT,
    "source_url" TEXT,
    "extraction_date" TIMESTAMP(3),
    "lead_type" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "company_name" TEXT,
    "website" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'new',
    "confidence" DOUBLE PRECISION,
    "crm_stage" TEXT NOT NULL DEFAULT 'new',
    "assigned_to" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
