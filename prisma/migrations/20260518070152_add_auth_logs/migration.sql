-- CreateTable
CREATE TABLE "auth_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "email" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "auth_logs" ADD CONSTRAINT "auth_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
