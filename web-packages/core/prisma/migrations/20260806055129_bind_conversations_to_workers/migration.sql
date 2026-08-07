/*
  Warnings:

  - You are about to drop the column `agentKind` on the `conversations` table. All the data in the column will be lost.
  - You are about to drop the column `workerId` on the `turns` table. All the data in the column will be lost.
  - Made the column `providerId` on table `conversations` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_providerId_fkey";

-- DropForeignKey
ALTER TABLE "turns" DROP CONSTRAINT "turns_workerId_fkey";

-- AlterTable
ALTER TABLE "conversations" DROP COLUMN "agentKind",
ADD COLUMN     "workerId" INTEGER,
ALTER COLUMN "providerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "turns" DROP COLUMN "workerId";

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
