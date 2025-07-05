# Catalog Import and Tag Definition Process

## Overview

This document explains how the catalog import system works and how tags are automatically defined and assigned during the catalog import process. The system uses advanced PDF processing, OCR, and Natural Language Processing (NLP) to automatically extract material properties and generate meaningful tags without manual intervention.

## Table of Contents

- [Import Workflow Overview](#import-workflow-overview)
- [Tag Definition Process](#tag-definition-process)
- [Tag Sources and Categories](#tag-sources-and-categories)
- [Technical Implementation](#technical-implementation)
- [Factory-Based Organization](#factory-based-organization)
- [Traceability and References](#traceability-and-references)
- [Code References](#code-references)

## Import Workflow Overview

The catalog import process follows a comprehensive pipeline that transforms PDF catalogs into searchable, tagged material records:

### 1. PDF Processing Pipeline
- **Entry Point**: [`processPdfCatalog`](../packages/server/src/services/pdf/pdfProcessor.ts#L90) function handles the entire import workflow
- **Image Extraction**: PDF pages are processed to extract material images
- **OCR Processing**: Text content is extracted from PDF pages using OCR technology
- **S3 Storage**: Extracted images are uploaded to S3 storage with generated URLs

### 2. Material Creation Workflow
- **Material Generation**: [`createMaterialFromImageAndText`](../packages/server/src/services/pdf/pdfProcessor.ts#L437) combines image and text data
- **Property Extraction**: [`extractMaterialProperties`](../packages/server/src/services/pdf/pdfProcessor.ts#L514) processes OCR text using NLP
- **Database Storage**: Materials are stored with comprehensive metadata and tag associations

### 3. Catalog Association
- **Source Tracking**: Each material maintains `catalogId` linking back to its source catalog
- **Page Reference**: `catalogPage` field shows which page the material was extracted from
- **Extraction Timestamp**: `extractedAt` field tracks when the import occurred

## Tag Definition Process

Tags are **automatically generated** during the catalog import process through intelligent text analysis, but can also be **manually edited and customized** after import to meet specific organizational needs.

### Predefined Tag Selection System

The [`extractMaterialProperties`](../packages/server/src/services/pdf/pdfProcessor.ts#L514) function uses sophisticated NLP-based matching against predefined tag lists maintained in the admin panel:

```typescript
// Example predefined tag selection logic
const properties = {
  tags: [] // Tags array populated from predefined lists
};

// NLP-based color matching against admin panel color list
if (colorMatch) {
  const matchedColor = matchAgainstPredefinedTags(colorMatch[1], adminColorTags);
  if (matchedColor) properties.tags.push(matchedColor);
}

// Material type matching against predefined material types
const materialType = matchAgainstPredefinedTags(extractedType, adminMaterialTypes);
if (materialType) properties.tags.push(materialType);
```

**Key Requirements:**
- **No Random Tag Generation**: Tags are never randomly created or auto-generated
- **Admin Panel Lists**: All tags must exist in predefined lists maintained through the admin panel
- **NLP Matching**: Sophisticated text analysis matches extracted properties to predefined tag options
- **Quality Control**: Only validated, pre-approved tags are assigned to materials

### Multi-Tag Support & Manual Editing

The system supports **multiple tags per material** and provides **full editing capabilities**:

- **Multi-Tag Architecture**: Each material can have multiple tags stored as an array, enabling rich categorization
- **Post-Import Editing**: Tags can be modified, added, or removed after the initial import process
- **Custom Tag Creation**: Users can add custom tags beyond those automatically generated
- **Tag Management**: Full CRUD operations (Create, Read, Update, Delete) for tag management
- **Flexible Organization**: Support for both system-generated and user-defined tagging schemes

### NLP-Based Property Extraction

The system employs Natural Language Processing techniques to:
- Parse extracted text for material characteristics
- Identify patterns using regex matching
- Extract semantic meaning from product descriptions
- Generate contextually relevant tags as a starting point for further customization

## Tag Sources and Categories

### 1. Color Information
- **Source**: Text patterns like "color: blue", "available in white", "finish: black"
- **Processing**: Color names are extracted and normalized
- **Example Tags**: "white", "blue", "black", "grey", "beige"
- **Code Location**: [Line 545](../packages/server/src/services/pdf/pdfProcessor.ts#L545)

### 2. Material Types
- **Source**: Predefined material type keywords in product descriptions
- **Detected Types**: 
  - "ceramic"
  - "porcelain" 
  - "natural stone"
  - "glass"
  - "metal"
  - "concrete"
  - "terrazzo"
  - "mosaic"
- **Code Location**: [Line 553](../packages/server/src/services/pdf/pdfProcessor.ts#L553)

### 3. Finish Types
- **Source**: Finish-related terms in material descriptions
- **Detected Finishes**:
  - "matte"
  - "glossy"
  - "polished"
  - "honed"
  - "textured"
  - "brushed"
  - "lappato"
  - "satin"
- **Code Location**: [Line 563](../packages/server/src/services/pdf/pdfProcessor.ts#L563)

### 4. Collection and Series Information
- **Source**: Collection patterns like "collection: Modern Series", "from the Urban Collection"
- **Processing**: Collection and series names are extracted and normalized
- **Example Tags**: "modern series", "urban collection", "classic line"
- **Code Locations**: [Lines 572, 578](../packages/server/src/services/pdf/pdfProcessor.ts#L572)

### 5. Technical Specifications
- **Source**: Technical data extracted from product specifications
- **Properties**: Water absorption, slip resistance, frost resistance
- **Usage**: Used for advanced filtering and material matching

## Technical Implementation

### MCP Integration
The system supports Model Context Protocol (MCP) for enhanced processing:
- **MCP-based Processing**: Uses external AI services when available
- **Fallback Implementation**: Direct processing when MCP services are unavailable
- **Credit System**: Tracks usage and costs for external processing services

### Database Integration
- **Supabase Backend**: PostgreSQL database with comprehensive material service
- **Service Layer**: [`SupabaseMaterialService`](../packages/server/src/services/supabase/supabase-material-service.ts) handles all material operations
- **Search Capabilities**: Advanced search and filtering using the generated tags

### Admin Panel Integration
- **Catalog Management**: [`catalog.admin.controller.ts`](../packages/server/src/controllers/admin/catalog.admin.controller.ts) provides admin functionality
- **Filtering System**: [`getMaterialsByFilter`](../packages/server/src/controllers/admin/catalog.admin.controller.ts#L315) enables tag-based filtering
- **XML Export**: Generate XML exports of catalogs and materials with tag information

## Factory-Based Organization

### Mandatory Factory Selection

**Critical Requirement**: Factory selection is **mandatory** during all catalog import and web crawling operations:

- **Import Process**: Factory must be explicitly selected before starting PDF catalog import
- **Web Crawling**: Factory selection is required when initiating web crawling operations
- **No Auto-Selection**: The system **cannot** and **will not** automatically select a factory
- **User Responsibility**: Users must manually choose the appropriate factory for each import/crawl operation
- **Validation**: Import/crawl operations will fail if no factory is selected

### Hierarchical Structure
The system supports factory-based catalog organization:
- **Factory Association**: Catalogs are linked to specific factories via `factoryId`
- **Tag Organization**: Tags help categorize materials within each factory's catalog
- **Admin Filtering**: Filter materials by factory, then refine by tags

### Organizational Benefits
- **Scalability**: Support for multiple factories and their catalogs
- **Isolation**: Factory-specific material organization
- **Flexibility**: Cross-factory search and comparison capabilities
- **Data Integrity**: Mandatory factory selection ensures proper data organization and traceability

## Traceability and References

### What Tags Point To

Tags serve as **categorical metadata** that reference:

1. **Material Properties**
   - Physical characteristics (color, finish, texture)
   - Material composition (ceramic, stone, metal)
   - Technical specifications (performance characteristics)

2. **Catalog Organization**
   - **Factory Association**: Enable factory-based filtering and organization
   - **Collection Grouping**: Materials from same collections share tags
   - **Search Enhancement**: Power the advanced search and filtering system

3. **Traceability Links**
   - **Source Catalog**: `catalogId` maintains link to original catalog
   - **Page Reference**: `catalogPage` shows extraction source
   - **Import History**: `extractedAt` provides temporal tracking

### Search and Filtering Integration

The generated tags integrate with the search system:
- **Text Search**: Combined with full-text search capabilities
- **Faceted Search**: Enable multi-dimensional filtering
- **Recommendation Engine**: Support for material recommendation systems

## Tag Management and Admin Panel Features

### Admin Panel Tag Management

The system provides comprehensive tag management capabilities through the admin panel:

- **Tag Editing Interface**: Full CRUD operations for tag management via admin controllers
- **Bulk Tag Operations**: Ability to modify tags across multiple materials simultaneously
- **Tag Validation**: Ensures tag consistency and prevents duplicate or invalid tags
- **Tag Analytics**: View tag usage statistics and material distribution by tags

### Multi-Tag Architecture

The tag system is designed for flexibility and scalability:

- **Array-Based Storage**: Tags are stored as arrays in the database, supporting unlimited tags per material
- **Tag Relationships**: Support for hierarchical and related tag structures
- **Tag Normalization**: Automatic formatting and standardization of tag values
- **Custom Tag Categories**: Ability to create custom tag categories beyond the automatic ones

### Post-Import Tag Editing Workflow

After catalog import, users can enhance and customize the automatically generated tags:

1. **Review Generated Tags**: Examine automatically created tags for accuracy and completeness
2. **Add Custom Tags**: Include business-specific, project-specific, or custom categorization tags
3. **Remove Irrelevant Tags**: Clean up any incorrectly generated or unnecessary tags
4. **Standardize Tag Format**: Ensure consistent naming conventions across the material database
5. **Create Tag Hierarchies**: Organize tags into logical groupings for better navigation

### Tag-Based Features

The multi-tag system enables advanced functionality:

- **Advanced Filtering**: Filter materials by multiple tag criteria simultaneously
- **Tag-Based Search**: Search materials using tag combinations
- **Material Recommendations**: Suggest similar materials based on shared tags
- **Collection Management**: Group materials by tag-based collections
- **Export Customization**: Generate XML exports filtered by specific tag criteria

## Code References

### Key Files and Functions

1. **PDF Processing Service**
   - File: [`packages/server/src/services/pdf/pdfProcessor.ts`](../packages/server/src/services/pdf/pdfProcessor.ts)
   - Main Function: `processPdfCatalog` (Lines 90-370)
   - Material Creation: `createMaterialFromImageAndText` (Lines 437-504)
   - Property Extraction: `extractMaterialProperties` (Lines 514-600)

2. **Material Service**
   - File: [`packages/server/src/services/supabase/supabase-material-service.ts`](../packages/server/src/services/supabase/supabase-material-service.ts)
   - Search Function: `searchMaterials` (Lines 231-331)
   - CRUD Operations: Comprehensive material management

3. **Admin Controller**
   - File: [`packages/server/src/controllers/admin/catalog.admin.controller.ts`](../packages/server/src/controllers/admin/catalog.admin.controller.ts)
   - Filter Function: `getMaterialsByFilter` (Lines 315-331)
   - XML Export: `generateFilteredMaterialsXml`

### Data Flow

```
PDF Catalog → OCR Processing → Text Analysis → NLP Extraction → Tag Generation → Database Storage → Search Index
     ↓              ↓              ↓              ↓              ↓              ↓              ↓
Factory ID → Image Extract → Property ID → Pattern Match → Tag Creation → Material Record → Admin Panel
```

## Benefits

### Automation
- **Zero Manual Tagging**: Complete automation of tag generation
- **Consistency**: Standardized tag creation across all imports
- **Scalability**: Handle large catalog volumes efficiently

### Accuracy
- **NLP Processing**: Intelligent text understanding
- **Pattern Recognition**: Reliable property extraction
- **Quality Control**: Consistent tag formatting and normalization

### Integration
- **Search Enhancement**: Power advanced search capabilities
- **Admin Tools**: Enable sophisticated filtering and management
- **API Support**: Programmatic access to tagged material data

This automated tagging system ensures that catalog imports result in immediately searchable, well-organized material databases without requiring manual intervention, while maintaining full traceability back to the source catalogs.