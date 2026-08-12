-- CreateEnum
CREATE TYPE "requirement_file_role" AS ENUM ('image', 'attachment');

-- CreateTable
CREATE TABLE "requirement_draft_files" (
    "requirementId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "role" "requirement_file_role" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "requirement_draft_files_pkey" PRIMARY KEY ("requirementId","fileId")
);

-- CreateTable
CREATE TABLE "requirement_revision_files" (
    "revisionId" INTEGER NOT NULL,
    "fileId" INTEGER NOT NULL,
    "role" "requirement_file_role" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "requirement_revision_files_pkey" PRIMARY KEY ("revisionId","fileId")
);

-- CreateIndex
CREATE INDEX "requirement_draft_files_fileId_idx" ON "requirement_draft_files"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_draft_files_requirementId_role_position_key" ON "requirement_draft_files"("requirementId", "role", "position");

-- CreateIndex
CREATE INDEX "requirement_revision_files_fileId_idx" ON "requirement_revision_files"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_revision_files_revisionId_role_position_key" ON "requirement_revision_files"("revisionId", "role", "position");

-- AddForeignKey
ALTER TABLE "requirement_draft_files" ADD CONSTRAINT "requirement_draft_files_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirement_drafts"("requirementId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_draft_files" ADD CONSTRAINT "requirement_draft_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_revision_files" ADD CONSTRAINT "requirement_revision_files_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "requirement_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_revision_files" ADD CONSTRAINT "requirement_revision_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
