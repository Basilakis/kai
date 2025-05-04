-- Create specialized crawler config table
CREATE TABLE IF NOT EXISTS "SpecializedCrawlerConfig" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "propertyName" TEXT NOT NULL,
  "materialType" TEXT NOT NULL,
  "crawlerType" TEXT NOT NULL,
  "baseConfig" JSONB NOT NULL,
  "extractionRules" JSONB NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create specialized crawler job table
CREATE TABLE IF NOT EXISTS "SpecializedCrawlerJob" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "jobId" TEXT UNIQUE NOT NULL,
  "configId" UUID NOT NULL REFERENCES "SpecializedCrawlerConfig" ("id") ON DELETE CASCADE,
  "propertyName" TEXT NOT NULL,
  "materialType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "results" JSONB,
  "stats" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "SpecializedCrawlerConfig_propertyName_materialType_idx" ON "SpecializedCrawlerConfig" ("propertyName", "materialType");
CREATE INDEX IF NOT EXISTS "SpecializedCrawlerJob_propertyName_materialType_idx" ON "SpecializedCrawlerJob" ("propertyName", "materialType");
CREATE INDEX IF NOT EXISTS "SpecializedCrawlerJob_status_idx" ON "SpecializedCrawlerJob" ("status");
CREATE INDEX IF NOT EXISTS "SpecializedCrawlerJob_configId_idx" ON "SpecializedCrawlerJob" ("configId");
