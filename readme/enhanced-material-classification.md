# Enhanced Material Classification

This document describes the Enhanced Material Classification feature, which provides hierarchical classification for materials, support for multiple classification systems, and mapping between different classification standards.

## Overview

The Enhanced Material Classification feature provides a comprehensive system for classifying materials using different classification standards. This enables:

1. **Hierarchical Classification**: Materials can be classified using hierarchical classification systems, with parent-child relationships between categories.
2. **Multiple Classification Systems**: Support for multiple classification standards, such as CSI MasterFormat, Uniclass, OmniClass, ASTM, and ISO.
3. **Classification Mappings**: Ability to map categories between different classification systems, enabling cross-standard compatibility.

## Architecture

The Enhanced Material Classification feature consists of the following components:

### Database Schema

- **classification_systems**: Stores classification systems with their codes, names, and versions.
- **classification_categories**: Stores classification categories with hierarchical structure.
- **material_classifications**: Stores classifications assigned to materials.
- **classification_mappings**: Stores mappings between categories in different classification systems.

### API Endpoints

The following API endpoints are available for managing material classifications:

#### Classification Systems

- `GET /api/classification/systems`: Get all classification systems.
- `GET /api/classification/systems/:id`: Get a classification system by ID.
- `POST /api/classification/systems`: Create a new classification system (admin only).
- `PUT /api/classification/systems/:id`: Update a classification system (admin only).

#### Classification Categories

- `GET /api/classification/categories`: Get classification categories.
- `GET /api/classification/categories/:id`: Get a classification category by ID.
- `POST /api/classification/categories`: Create a new classification category (admin only).
- `PUT /api/classification/categories/:id`: Update a classification category (admin only).

#### Material Classifications

- `GET /api/classification/material-classifications`: Get material classifications.
- `GET /api/classification/material-classifications/:id`: Get a material classification by ID.
- `POST /api/classification/material-classifications`: Create a new material classification.
- `PUT /api/classification/material-classifications/:id`: Update a material classification.
- `DELETE /api/classification/material-classifications/:id`: Delete a material classification.

#### Classification Mappings

- `GET /api/classification/mappings`: Get classification mappings.
- `GET /api/classification/mappings/:id`: Get a classification mapping by ID.
- `POST /api/classification/mappings`: Create a new classification mapping (admin only).
- `PUT /api/classification/mappings/:id`: Update a classification mapping (admin only).
- `DELETE /api/classification/mappings/:id`: Delete a classification mapping (admin only).

#### Additional Endpoints

- `GET /api/classification/systems/:id/tree`: Get a classification system with its categories as a tree.
- `GET /api/classification/materials/:materialId/classifications`: Get material with all its classifications.
- `GET /api/classification/categories/:categoryId/equivalent`: Find equivalent categories in another classification system.

### Client Components

The following client components are available for working with material classifications:

- **ClassificationTree**: Displays a hierarchical tree of classification categories.
- **ClassificationSystemSelector**: Allows users to select a classification system.
- **MaterialClassificationManager**: Allows users to manage classifications for a material.
- **ClassificationMappingManager**: Allows administrators to manage mappings between different classification systems.

### Admin Components

The following admin components are available for managing material classifications:

- **MaterialClassificationTab**: Tab for managing material classifications in the material detail page.
- **ClassificationManagementPage**: Admin page for managing classification systems, categories, and mappings.

## Usage

### Setting Up Classification Systems

Before using the enhanced material classification, you need to set up the classification systems you want to use. This can be done through the admin interface or by using the API.

```typescript
// Example: Adding a new classification system
const newSystem = {
  name: 'CSI MasterFormat',
  code: 'CSI_MASTERFORMAT',
  description: 'Construction Specifications Institute MasterFormat',
  version: '2020',
  isHierarchical: true
};

await fetch('/api/classification/systems', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(newSystem)
});
```

### Adding Classification Categories

Classification categories can be added through the admin interface or by using the API.

```typescript
// Example: Adding a classification category
const newCategory = {
  systemId: 'system-id',
  parentId: 'parent-category-id', // Optional, for hierarchical systems
  code: '09 30 00',
  name: 'Tiling',
  description: 'Tiling materials and installation',
  level: 2,
  path: '09.09 30 00'
};

await fetch('/api/classification/categories', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(newCategory)
});
```

### Classifying Materials

Materials can be classified through the material detail page or by using the API.

```typescript
// Example: Adding a classification to a material
const newClassification = {
  materialId: 'material-id',
  categoryId: 'category-id',
  isPrimary: true,
  source: 'manual'
};

await fetch('/api/classification/material-classifications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(newClassification)
});
```

### Creating Classification Mappings

Classification mappings can be created through the admin interface or by using the API.

```typescript
// Example: Creating a mapping between categories in different systems
const newMapping = {
  sourceCategoryId: 'source-category-id',
  targetCategoryId: 'target-category-id',
  mappingType: 'exact', // 'exact', 'broader', 'narrower', 'related'
  confidence: 0.9,
  description: 'Exact match between CSI MasterFormat and Uniclass'
};

await fetch('/api/classification/mappings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(newMapping)
});
```

### Finding Equivalent Categories

You can find equivalent categories in different classification systems using the API.

```typescript
// Example: Finding equivalent categories in another system
const response = await fetch(`/api/classification/categories/${categoryId}/equivalent?targetSystemId=${targetSystemId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
const equivalentCategories = data.equivalentCategories;
```

## Integration with Other Features

### Material Detail Page Integration

The enhanced material classification is integrated with the Material Detail Page, allowing users to manage classifications for a material.

### Search Integration

The enhanced material classification can be integrated with the search system to enable searching for materials by classification.

### Filtering Integration

The enhanced material classification can be integrated with the filtering system to enable filtering materials by classification.

## Best Practices

### Hierarchical Classification

When using hierarchical classification systems, make sure to maintain the proper parent-child relationships between categories. This ensures that the classification tree is displayed correctly and that materials can be found at the appropriate level of detail.

### Primary Classifications

Each material should have a primary classification in at least one classification system. This helps with organizing materials and enables more efficient searching and filtering.

### Classification Mappings

When creating mappings between different classification systems, be as specific as possible about the relationship between categories. Use the appropriate mapping type (exact, broader, narrower, related) and provide a confidence score to indicate the strength of the relationship.

## Conclusion

The Enhanced Material Classification feature provides a comprehensive system for classifying materials using different classification standards. This enables hierarchical classification, support for multiple classification systems, and mapping between different standards, enhancing the organization and searchability of materials in the system.
