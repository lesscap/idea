-- CreateEnum
CREATE TYPE "file_status" AS ENUM ('pending', 'ready');

-- CreateTable
CREATE TABLE "files" (
    "id" SERIAL NOT NULL,
    "fid" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "uploadedById" INTEGER NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "contentType" VARCHAR(128) NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "status" "file_status" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_fid_key" ON "files"("fid");

-- CreateIndex
CREATE UNIQUE INDEX "files_storageKey_key" ON "files"("storageKey");

-- CreateIndex
CREATE INDEX "files_appId_createdAt_idx" ON "files"("appId", "createdAt");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
