-- CreateEnum
CREATE TYPE "requirement_status" AS ENUM ('draft', 'active', 'archived');

-- AlterTable
ALTER TABLE "apps" ADD COLUMN     "requirementSequence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "requirements" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "requirement_status" NOT NULL DEFAULT 'draft',
    "revisionSequence" INTEGER NOT NULL DEFAULT 0,
    "currentRevisionId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_drafts" (
    "requirementId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" INTEGER NOT NULL,
    "updatedInConversationId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirement_drafts_pkey" PRIMARY KEY ("requirementId")
);

-- CreateTable
CREATE TABLE "requirement_revisions" (
    "id" SERIAL NOT NULL,
    "requirementId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "confirmedById" INTEGER NOT NULL,
    "confirmedInConversationId" INTEGER,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requirements_currentRevisionId_key" ON "requirements"("currentRevisionId");

-- CreateIndex
CREATE INDEX "requirements_appId_status_idx" ON "requirements"("appId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_appId_number_key" ON "requirements"("appId", "number");

-- CreateIndex
CREATE INDEX "requirement_drafts_updatedInConversationId_idx" ON "requirement_drafts"("updatedInConversationId");

-- CreateIndex
CREATE INDEX "requirement_revisions_requirementId_confirmedAt_idx" ON "requirement_revisions"("requirementId", "confirmedAt");

-- CreateIndex
CREATE INDEX "requirement_revisions_confirmedInConversationId_idx" ON "requirement_revisions"("confirmedInConversationId");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_revisions_requirementId_number_key" ON "requirement_revisions"("requirementId", "number");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_currentRevisionId_fkey" FOREIGN KEY ("currentRevisionId") REFERENCES "requirement_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_drafts" ADD CONSTRAINT "requirement_drafts_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_drafts" ADD CONSTRAINT "requirement_drafts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_drafts" ADD CONSTRAINT "requirement_drafts_updatedInConversationId_fkey" FOREIGN KEY ("updatedInConversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_revisions" ADD CONSTRAINT "requirement_revisions_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_revisions" ADD CONSTRAINT "requirement_revisions_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_revisions" ADD CONSTRAINT "requirement_revisions_confirmedInConversationId_fkey" FOREIGN KEY ("confirmedInConversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
