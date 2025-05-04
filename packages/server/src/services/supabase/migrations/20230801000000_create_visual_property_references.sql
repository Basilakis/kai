-- Create Visual Property Reference tables

-- Visual Property Reference table
CREATE TABLE IF NOT EXISTS "VisualPropertyReference" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "propertyName" TEXT NOT NULL,
  "materialType" TEXT NOT NULL,
  "displayName" TEXT,
  "description" TEXT,
  "previewImage" TEXT,
  "modelPath" TEXT,
  "modelAccuracy" DOUBLE PRECISION,
  "lastTrainedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Unique constraint on property name and material type
  UNIQUE ("propertyName", "materialType")
);

-- Visual Property Reference Item table
CREATE TABLE IF NOT EXISTS "VisualPropertyReferenceItem" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "referenceId" UUID NOT NULL,
  "imagePath" TEXT NOT NULL,
  "propertyValue" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Foreign key to Visual Property Reference
  CONSTRAINT "VisualPropertyReferenceItem_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "VisualPropertyReference" ("id") ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "VisualPropertyReference_propertyName_materialType_idx" ON "VisualPropertyReference" ("propertyName", "materialType");
CREATE INDEX IF NOT EXISTS "VisualPropertyReferenceItem_referenceId_idx" ON "VisualPropertyReferenceItem" ("referenceId");
CREATE INDEX IF NOT EXISTS "VisualPropertyReferenceItem_propertyValue_idx" ON "VisualPropertyReferenceItem" ("propertyValue");

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_visual_property_reference_updated_at
BEFORE UPDATE ON "VisualPropertyReference"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visual_property_reference_item_updated_at
BEFORE UPDATE ON "VisualPropertyReferenceItem"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
