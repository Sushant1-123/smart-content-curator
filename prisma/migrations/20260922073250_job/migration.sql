-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'READY', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "siteName" TEXT,
    "summary" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_url_key" ON "Item"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Item_urlHash_key" ON "Item"("urlHash");

-- CreateIndex
CREATE INDEX "Item_createdAt_idx" ON "Item"("createdAt");

-- CreateIndex
CREATE INDEX "Item_tags_idx" ON "Item"("tags");

-- CreateIndex
CREATE INDEX "Item_status_idx" ON "Item"("status");
