/*
  Warnings:

  - You are about to drop the column `workspaceId` on the `conversations` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[workspaceId,slug]` on the table `apps` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cid]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `apps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `appId` to the `conversations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cid` to the `conversations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_workspaceId_fkey";

-- DropIndex
DROP INDEX "conversations_workspaceId_lastActiveAt_idx";

-- DropIndex
DROP INDEX "workers_machineId_key";

-- DropIndex
DROP INDEX "workers_name_key";

-- AlterTable
ALTER TABLE "apps" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "conversations" DROP COLUMN "workspaceId",
ADD COLUMN     "appId" INTEGER NOT NULL,
ADD COLUMN     "cid" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "apps_workspaceId_slug_key" ON "apps"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_cid_key" ON "conversations"("cid");

-- CreateIndex
CREATE INDEX "conversations_appId_lastActiveAt_idx" ON "conversations"("appId", "lastActiveAt");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
