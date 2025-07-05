# Property Inheritance System

The Property Inheritance System allows properties to be inherited based on material type hierarchies, with support for overrides and templates.

## Overview

The Property Inheritance System provides a way to define default properties for materials based on their type and category. This reduces redundant data entry, ensures consistency across similar materials, makes it easier to update properties for entire categories of materials, and simplifies the creation of new material entries.

## Key Features

- **Property Templates**: Define templates for material properties that can be inherited
- **Type-Based Inheritance**: Automatically apply properties based on material type
- **Category-Based Inheritance**: Apply properties based on material category
- **Hierarchical Inheritance**: Support for parent-child relationships between templates
- **Priority-Based Overrides**: Higher priority templates override lower priority ones
- **Conditional Rules**: Apply properties based on conditions
- **Property Overrides**: Allow specific overrides for individual materials

## Architecture

The Property Inheritance System consists of the following components:

### 1. Property Template Model

The Property Template model defines the structure for property templates:

- **ID**: Unique identifier for the template
- **Name**: Name of the template
- **Description**: Description of the template
- **Material Type**: Type of material the template applies to (optional)
- **Category ID**: Category the template applies to (optional)
- **Parent Template ID**: Parent template to inherit from (optional)
- **Priority**: Priority of the template (higher priority templates override lower priority ones)
- **Properties**: Key-value pairs of properties to apply
- **Override Rules**: Rules for when to apply properties

### 2. Property Inheritance Service

The Property Inheritance Service handles the logic for applying property templates to materials:

- **Apply Inheritance**: Apply property templates to a material
- **Get Applicable Templates**: Get templates that apply to a material
- **Apply Template**: Apply a template to a material
- **Check Override Rules**: Check if a property should be applied based on override rules

### 3. Material Service Integration

The Material Service integrates with the Property Inheritance Service to apply property templates when creating or updating materials:

- **Create Material**: Apply property templates when creating a material
- **Update Material**: Apply property templates when updating a material
- **Apply Inheritance**: Apply property templates to an existing material

### 4. API Endpoints

The API endpoints for managing property templates:

- **GET /api/property-templates**: Get all property templates
- **GET /api/property-templates/:id**: Get a property template by ID
- **POST /api/property-templates**: Create a new property template
- **PUT /api/property-templates/:id**: Update a property template
- **DELETE /api/property-templates/:id**: Delete a property template
- **POST /api/property-templates/:id/apply**: Apply a property template to a material
- **POST /api/materials/:id/apply-inheritance**: Apply property inheritance to a material

### 5. UI Components

The UI components for managing property templates:

- **Property Template Manager**: Component for managing property templates
- **Property Template Form**: Form for creating and editing property templates
- **Property Template List**: List of property templates
- **Property Template Details**: Details of a property template

## Usage

### Creating a Property Template

1. Navigate to the Property Templates page in the admin panel
2. Click "Create Template"
3. Fill in the template details:
   - Name: Name of the template
   - Description: Description of the template
   - Material Type: Type of material the template applies to (optional)
   - Category: Category the template applies to (optional)
   - Parent Template: Parent template to inherit from (optional)
   - Priority: Priority of the template
   - Properties: Key-value pairs of properties to apply
   - Override Rules: Rules for when to apply properties
4. Click "Create" to save the template

### Applying Property Inheritance

Property inheritance is automatically applied when creating or updating materials. You can also manually apply property inheritance to an existing material:

1. Navigate to the Materials page in the admin panel
2. Select a material
3. Click "Apply Inheritance"
4. Configure inheritance options:
   - Apply Defaults: Whether to apply default values
   - Override Existing: Whether to override existing values
5. Click "Apply" to apply property inheritance

## Implementation Details

### Property Template Model

The Property Template model is implemented using Supabase PostgreSQL in `packages/server/src/models/propertyTemplate.model.ts`.

### Property Inheritance Service

The Property Inheritance Service is implemented in `packages/server/src/services/propertyInheritance/propertyInheritanceService.ts`.

### Material Service Integration

The Material Service integration is implemented in `packages/server/src/services/material/materialService.ts`.

### API Endpoints

The API endpoints are implemented in `packages/server/src/controllers/propertyTemplate.controller.ts` and `packages/server/src/routes/propertyTemplate.routes.ts`.

### UI Components

The UI components are implemented in `packages/client/src/components/propertyTemplates/PropertyTemplateManager.tsx` and `packages/client/src/pages/admin/PropertyTemplatesPage.tsx`.

## Examples

### Example 1: Basic Property Template

```json
{
  "name": "Ceramic Tile Template",
  "description": "Default properties for ceramic tiles",
  "materialType": "ceramic",
  "isActive": true,
  "priority": 10,
  "properties": {
    "finish": "matte",
    "waterAbsorption": 0.5,
    "slipResistance": "R9",
    "technicalSpecs": {
      "density": 2.3,
      "hardness": 7
    }
  }
}
```

### Example 2: Template with Override Rules

```json
{
  "name": "Porcelain Tile Template",
  "description": "Default properties for porcelain tiles",
  "materialType": "porcelain",
  "isActive": true,
  "priority": 20,
  "properties": {
    "finish": "polished",
    "waterAbsorption": 0.1,
    "slipResistance": "R10",
    "technicalSpecs": {
      "density": 2.5,
      "hardness": 8
    }
  },
  "overrideRules": [
    {
      "field": "finish",
      "condition": "finish=textured",
      "value": "textured"
    },
    {
      "field": "slipResistance",
      "condition": "finish=textured",
      "value": "R11"
    }
  ]
}
```

## Future Enhancements

- **Template Versioning**: Add support for versioning property templates
- **Template Export/Import**: Add support for exporting and importing property templates
- **Template Cloning**: Add support for cloning property templates
- **Template Testing**: Add support for testing property templates against materials
- **Template Analytics**: Add support for analyzing property template usage
- **Template Validation**: Add support for validating property templates against material types
- **Template Inheritance Visualization**: Add support for visualizing property template inheritance
