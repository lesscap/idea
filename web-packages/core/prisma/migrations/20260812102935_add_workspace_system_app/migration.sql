/*
  Warnings:

  - A unique constraint covering the columns `[systemAppId]` on the table `workspaces` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "systemAppId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_systemAppId_key" ON "workspaces"("systemAppId");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_systemAppId_fkey" FOREIGN KEY ("systemAppId") REFERENCES "apps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
