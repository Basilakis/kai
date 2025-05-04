-- Create material comparison table
CREATE TABLE IF NOT EXISTS "MaterialComparison" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "materialIds" TEXT[] NOT NULL,
  "overallSimilarity" FLOAT NOT NULL,
  "propertyComparisons" JSONB NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create material comparison preset table
CREATE TABLE IF NOT EXISTS "MaterialComparisonPreset" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "materialType" TEXT,
  "propertyWeights" JSONB NOT NULL,
  "includeProperties" TEXT[],
  "excludeProperties" TEXT[],
  "createdBy" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "MaterialComparison_materialIds_idx" ON "MaterialComparison" USING GIN ("materialIds");
CREATE INDEX IF NOT EXISTS "MaterialComparison_overallSimilarity_idx" ON "MaterialComparison" ("overallSimilarity");
CREATE INDEX IF NOT EXISTS "MaterialComparisonPreset_materialType_idx" ON "MaterialComparisonPreset" ("materialType");
CREATE INDEX IF NOT EXISTS "MaterialComparisonPreset_createdBy_idx" ON "MaterialComparisonPreset" ("createdBy");
CREATE INDEX IF NOT EXISTS "MaterialComparisonPreset_isDefault_idx" ON "MaterialComparisonPreset" ("isDefault");
