# Material-Specific UI Components

This document describes the material-specific UI components implemented in the platform. These components ensure consistent filtering of metadata fields by material type and provide visual indicators for material types.

## Overview

The material-specific UI components consist of the following:

1. **MaterialTypeSelector**: A dropdown selector for material types with icons and descriptions
2. **MaterialTypeIndicator**: A chip component that indicates the material type with an icon and color
3. **MetadataFieldFilter**: A filter component for metadata fields with material type filtering
4. **Enhanced MetadataFieldManager**: An updated manager component that uses material-specific filtering

## Material Type Selector

The `MaterialTypeSelector` component provides a consistent way to select material types across the platform.

### Features

- Material type options with icons and descriptions
- Consistent styling and behavior
- Support for required/optional states
- Support for disabled state
- Support for different sizes

### Usage

```tsx
import MaterialTypeSelector, { MaterialType } from '../../components/common/MaterialTypeSelector';

// In your component
const [materialType, setMaterialType] = useState<MaterialType>('all');

// In your JSX
<MaterialTypeSelector
  value={materialType}
  onChange={setMaterialType}
  label="Material Type"
  required
  showDescription
/>
```

## Material Type Indicator

The `MaterialTypeIndicator` component provides a visual indicator for material types.

### Features

- Consistent color coding for different material types
- Icons that represent each material type
- Tooltips with descriptions
- Support for different sizes

### Usage

```tsx
import MaterialTypeIndicator, { getMaterialTypeFromCategories } from './MaterialTypeIndicator';

// In your JSX
<MaterialTypeIndicator
  materialType={getMaterialTypeFromCategories(field.categories)}
  size="small"
/>
```

## Metadata Field Filter

The `MetadataFieldFilter` component provides a consistent way to filter metadata fields by material type, field type, and search term.

### Features

- Search by name or description
- Filter by field type
- Filter by material type
- Consistent styling and behavior

### Usage

```tsx
import MetadataFieldFilter, { MetadataFieldFilterOptions } from './MetadataFieldFilter';

// In your component
const [filterOptions, setFilterOptions] = useState<MetadataFieldFilterOptions>({
  searchTerm: '',
  fieldType: 'all',
  materialType: 'all',
  isActive: true
});

// In your JSX
<MetadataFieldFilter
  filterOptions={filterOptions}
  onFilterChange={setFilterOptions}
/>
```

## Enhanced Metadata Field Manager

The `MetadataFieldManager` component has been enhanced to use material-specific filtering and indicators.

### Features

- Filter metadata fields by material type
- Visual indicators for material types
- Consistent material type selection in the edit dialog
- Improved user experience with clear filtering options

## Material Type Categories

The platform supports the following material types:

- **Tile**: Ceramic, porcelain, mosaic, and other tile materials
- **Wood**: Hardwood, engineered wood, laminate, and other wood materials
- **Lighting**: Lamps, fixtures, and other lighting products
- **Furniture**: Chairs, tables, sofas, and other furniture
- **Decoration**: Decorative items like vases, artwork, and rugs
- **All**: Common fields applicable to all material types

Each material type has a specific color and icon for consistent visual identification across the platform.

## Integration with Other Components

The material-specific UI components are designed to integrate with other components in the platform:

1. **OCR Processing**: The material type detection in OCR processing uses the same material types as the UI components
2. **ML Training**: The material-specific ML training uses the same material types for filtering metadata fields
3. **Admin Dashboard**: The admin dashboard uses material type indicators to show which material type each field belongs to

This integration ensures a consistent user experience across the platform.

## Future Enhancements

Planned enhancements for the material-specific UI components:

1. **Material Type Management**: Add a UI for managing material types and their properties
2. **Material Type Hierarchy**: Implement a hierarchical structure for material types
3. **Material Type Relationships**: Add support for relationships between material types
4. **Material Type Statistics**: Add statistics about metadata fields by material type
5. **Material Type Validation**: Add validation rules specific to each material type
