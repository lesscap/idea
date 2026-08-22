/*
  Warnings:

  - You are about to drop the column `requirementSequence` on the `apps` table. All the data in the column will be lost.
  - You are about to drop the `requirement_draft_files` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requirement_drafts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requirement_revision_files` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requirement_revisions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requirements` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "issue_state" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "issue_close_reason" AS ENUM ('completed', 'not_planned');

-- CreateEnum
CREATE TYPE "issue_type" AS ENUM ('bug', 'feature', 'task');

-- CreateEnum
CREATE TYPE "issue_file_role" AS ENUM ('image', 'attachment');

-- CreateEnum
CREATE TYPE "issue_activity_kind" AS ENUM ('state_changed', 'type_changed', 'label_added', 'label_removed');

-- DropForeignKey
ALTER TABLE "requirement_draft_files" DROP CONSTRAINT "requirement_draft_files_fileId_fkey";

-- DropForeignKey
ALTER TABLE "requirement_draft_files" DROP CONSTRAINT "requirement_draft_files_requirementId_fkey";

-- DropForeignKey
ALTER TABLE "requirement_drafts" DROP CONSTRAINT "requirement_drafts_requirementId_fkey";

-- DropForeignKey
ALTER TABLE "requirement_drafts" DROP CONSTRAINT "requirement_drafts_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "requirement_drafts" DROP CONSTRAINT "requirement_drafts_updatedInConversationId_fkey";

-- DropForeignKey
ALTER TABLE "requirement_revision_files" DROP CONSTRAINT "requirement_revision_files_fileId_fkey";

-- DropForeignKey
ALTER TABLE "requirement_revision_files" DROP CONSTRAINT "requirement_revision_files_revisionId_fkey";

-- DropForeignKey
ALTER TABLE "requirement_revisions" DROP CONSTRAINT "requirement_revisions_confirmedById_fkey";

-- DropForeignKey
ALTER TABLE "requirement_revisions" DROP CONSTRAINT "requirement_revisions_confirmedInConversationId_fkey";

-- DropForeignKey
ALTER TABLE "requirement_revisions" DROP CONSTRAINT "requirement_revisions_requirementId_fkey";

-- DropForeignKey
ALTER TABLE "requirements" DROP CONSTRAINT "requirements_appId_fkey";

-- DropForeignKey
ALTER TABLE "requirements" DROP CONSTRAINT "requirements_createdById_fkey";

-- DropForeignKey
ALTER TABLE "requirements" DROP CONSTRAINT "requirements_currentRevisionId_fkey";

-- AlterTable
ALTER TABLE "apps" DROP COLUMN "requirementSequence",
ADD COLUMN     "issueSequence" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "requirement_draft_files";

-- DropTable
DROP TABLE "requirement_drafts";

-- DropTable
DROP TABLE "requirement_revision_files";

-- DropTable
DROP TABLE "requirement_revisions";

-- DropTable
DROP TABLE "requirements";

-- DropEnum
DROP TYPE "requirement_file_role";

-- DropEnum
DROP TYPE "requirement_status";

-- CreateTable
CREATE TABLE "issues" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "state" "issue_state" NOT NULL DEFAULT 'open',
    "type" "issue_type",
    "closeReason" "issue_close_reason",
    "revisionSequence" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "closedById" INTEGER,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "normalizedName" VARCHAR(50) NOT NULL,
    "description" VARCHAR(100),
    "color" VARCHAR(6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_labels" (
    "issueId" INTEGER NOT NULL,
    "labelId" INTEGER NOT NULL,

    CONSTRAINT "issue_labels_pkey" PRIMARY KEY ("issueId","labelId")
);

-- CreateTable
CREATE TABLE "issue_revisions" (
    "id" SERIAL NOT NULL,
    "issueId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_files" (
    "issueId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "role" "issue_file_role" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "issue_files_pkey" PRIMARY KEY ("issueId","fileId")
);

-- CreateTable
CREATE TABLE "issue_revision_files" (
    "revisionId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "role" "issue_file_role" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "issue_revision_files_pkey" PRIMARY KEY ("revisionId","fileId")
);

-- CreateTable
CREATE TABLE "issue_activities" (
    "id" SERIAL NOT NULL,
    "issueId" INTEGER NOT NULL,
    "kind" "issue_activity_kind" NOT NULL,
    "actorId" INTEGER NOT NULL,
    "fromState" "issue_state",
    "toState" "issue_state",
    "closeReason" "issue_close_reason",
    "fromType" "issue_type",
    "toType" "issue_type",
    "labelId" INTEGER,
    "labelName" VARCHAR(50),
    "labelColor" VARCHAR(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issues_appId_state_updatedAt_idx" ON "issues"("appId", "state", "updatedAt");

-- CreateIndex
CREATE INDEX "issues_appId_type_idx" ON "issues"("appId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "issues_appId_number_key" ON "issues"("appId", "number");

-- CreateIndex
CREATE INDEX "labels_appId_name_idx" ON "labels"("appId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "labels_appId_normalizedName_key" ON "labels"("appId", "normalizedName");

-- CreateIndex
CREATE INDEX "issue_labels_labelId_idx" ON "issue_labels"("labelId");

-- CreateIndex
CREATE INDEX "issue_revisions_issueId_createdAt_idx" ON "issue_revisions"("issueId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "issue_revisions_issueId_number_key" ON "issue_revisions"("issueId", "number");

-- CreateIndex
CREATE INDEX "issue_files_fileId_idx" ON "issue_files"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "issue_files_issueId_role_position_key" ON "issue_files"("issueId", "role", "position");

-- CreateIndex
CREATE INDEX "issue_revision_files_fileId_idx" ON "issue_revision_files"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "issue_revision_files_revisionId_role_position_key" ON "issue_revision_files"("revisionId", "role", "position");

-- CreateIndex
CREATE INDEX "issue_activities_issueId_createdAt_idx" ON "issue_activities"("issueId", "createdAt");

-- CreateIndex
CREATE INDEX "issue_activities_labelId_idx" ON "issue_activities"("labelId");

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_labels" ADD CONSTRAINT "issue_labels_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_revisions" ADD CONSTRAINT "issue_revisions_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_revisions" ADD CONSTRAINT "issue_revisions_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_files" ADD CONSTRAINT "issue_files_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_files" ADD CONSTRAINT "issue_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_revision_files" ADD CONSTRAINT "issue_revision_files_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "issue_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_revision_files" ADD CONSTRAINT "issue_revision_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_activities" ADD CONSTRAINT "issue_activities_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
