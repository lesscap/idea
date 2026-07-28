-- A conversation can concern several apps or requirements. Until those
-- associations have their own model, workspace is its only direct scope.
DROP INDEX "conversations_appId_idx";

ALTER TABLE "conversations" DROP CONSTRAINT "conversations_appId_fkey";

ALTER TABLE "conversations" DROP COLUMN "appId";
