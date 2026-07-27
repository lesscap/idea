-- CreateEnum
CREATE TYPE "turn_status" AS ENUM ('queued', 'running', 'completed', 'failed', 'aborted');

-- CreateTable
CREATE TABLE "conversations" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "appId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "agentKind" TEXT NOT NULL DEFAULT 'claude-code',
    "providerSessionId" TEXT,
    "title" TEXT,
    "titleLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_events" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_inputs" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turns" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "userEventSequence" INTEGER NOT NULL,
    "status" "turn_status" NOT NULL DEFAULT 'queued',
    "workerId" INTEGER,
    "runningKey" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "abortRequestedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" SERIAL NOT NULL,
    "machineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_workspaceId_lastActiveAt_idx" ON "conversations"("workspaceId", "lastActiveAt");

-- CreateIndex
CREATE INDEX "conversations_appId_idx" ON "conversations"("appId");

-- CreateIndex
CREATE INDEX "conversation_events_conversationId_type_idx" ON "conversation_events"("conversationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_events_conversationId_sequence_key" ON "conversation_events"("conversationId", "sequence");

-- CreateIndex
CREATE INDEX "pending_inputs_conversationId_id_idx" ON "pending_inputs"("conversationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "turns_runningKey_key" ON "turns"("runningKey");

-- CreateIndex
CREATE INDEX "turns_conversationId_status_idx" ON "turns"("conversationId", "status");

-- CreateIndex
CREATE INDEX "turns_status_leaseUntil_idx" ON "turns"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "workers_machineId_key" ON "workers"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "workers_name_key" ON "workers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "workers_apiToken_key" ON "workers"("apiToken");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_inputs" ADD CONSTRAINT "pending_inputs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
