-- CreateEnum
CREATE TYPE "DocumentExtractionStatus" AS ENUM ('NOT_STARTED', 'EXTRACTED', 'NEEDS_OCR', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentParsingStatus" AS ENUM ('NOT_STARTED', 'PARSED', 'NEEDS_REVIEW', 'CONFIRMED', 'FAILED');

-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "extractionStatus" "DocumentExtractionStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "parsingStatus" "DocumentParsingStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "extractionMethod" TEXT NOT NULL,
    "rawText" TEXT,
    "normalizedText" TEXT,
    "parsedJson" JSONB,
    "correctedJson" JSONB,
    "parserName" TEXT,
    "parserVersion" TEXT,
    "confidenceScore" DECIMAL(5,4),
    "warnings" JSONB,
    "missingFields" JSONB,
    "textChecksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExtraction_documentId_key" ON "DocumentExtraction"("documentId");

-- AddForeignKey
ALTER TABLE "DocumentExtraction"
ADD CONSTRAINT "DocumentExtraction_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
