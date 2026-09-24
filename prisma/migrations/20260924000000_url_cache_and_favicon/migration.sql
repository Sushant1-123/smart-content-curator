-- DropIndex
DROP INDEX "Item_tags_idx";

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "faviconUrl" TEXT;

-- CreateTable
CREATE TABLE "UrlCache" (
    "urlHash" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "siteName" TEXT,
    "faviconUrl" TEXT,
    "content" TEXT,
    "metadataFetchedAt" TIMESTAMP(3),
    "summary" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "promptVersion" TEXT,
    "model" TEXT,
    "aiGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrlCache_pkey" PRIMARY KEY ("urlHash")
);

-- CreateIndex
CREATE INDEX "Item_tags_idx" ON "Item" USING GIN ("tags");

