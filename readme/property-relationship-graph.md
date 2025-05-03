# Property Relationship Graph

The Property Relationship Graph is a powerful system that defines and stores relationships between different material properties. This document explains how the system works, how to use it, and how to extend it.

## Overview

The Property Relationship Graph enables:

1. **Defining Relationships**: Specify how different properties relate to each other
2. **Storing Correlations**: Record statistical or manual correlations between property values
3. **Setting Compatibility Rules**: Define which property values work well together
4. **Validating Property Combinations**: Check if a set of property values is valid/compatible
5. **Getting Recommendations**: Suggest compatible property values based on existing selections
6. **Visualizing Relationships**: View a graph visualization of property relationships

## Key Concepts

### Relationship Types

The system supports several types of relationships between properties:

- **Correlation**: Properties that tend to have related values (e.g., material type and water absorption)
- **Dependency**: Properties where one depends on the other (e.g., finish depends on material type)
- **Compatibility**: Properties that need to be compatible (e.g., finish and R-rating)
- **Exclusion**: Properties that have mutually exclusive values (e.g., certain finishes and R-ratings)
- **Causation**: Properties where one causes the other (e.g., material composition causes certain properties)
- **Derivation**: Properties where one is derived from the other (e.g., calculated properties)
- **Association**: General association between properties

### Compatibility Types

For compatibility relationships, the system defines several compatibility levels:

- **Compatible**: Values that work together
- **Recommended**: Values that are recommended to be used together
- **Not Recommended**: Values that are not recommended to be used together
- **Incompatible**: Values that should not be used together

## Database Schema

The system uses three main tables:

1. **property_relationships**: Defines relationships between properties
2. **property_value_correlations**: Stores correlations between specific property values
3. **property_compatibility_rules**: Defines compatibility rules between property values

## API Endpoints

### Property Relationships

- `POST /api/property-relationships`: Create a new property relationship
- `GET /api/property-relationships/:id`: Get a property relationship by ID
- `GET /api/property-relationships/material/:materialType`: Get relationships by material type
- `GET /api/property-relationships/source/:sourceProperty`: Get relationships by source property
- `GET /api/property-relationships/target/:targetProperty`: Get relationships by target property
- `PUT /api/property-relationships/:id`: Update a property relationship
- `DELETE /api/property-relationships/:id`: Delete a property relationship

### Value Correlations

- `POST /api/property-relationships/:relationshipId/correlations`: Create a new value correlation
- `GET /api/property-relationships/:relationshipId/correlations`: Get correlations by relationship ID
- `PUT /api/property-relationships/correlations/:id`: Update a value correlation
- `DELETE /api/property-relationships/correlations/:id`: Delete a value correlation

### Compatibility Rules

- `POST /api/property-relationships/:relationshipId/compatibility`: Create a new compatibility rule
- `GET /api/property-relationships/:relationshipId/compatibility`: Get rules by relationship ID
- `PUT /api/property-relationships/compatibility/:id`: Update a compatibility rule
- `DELETE /api/property-relationships/compatibility/:id`: Delete a compatibility rule

### Validation and Recommendations

- `POST /api/property-relationships/validate`: Validate a set of property values
- `POST /api/property-relationships/recommend`: Get property recommendations
- `GET /api/property-relationships/graph/:materialType`: Get graph visualization data

## Usage Examples

### Creating a Relationship

```typescript
// Create a correlation relationship between material and finish
const relationship = await fetch('/api/property-relationships', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sourceProperty: 'material',
    targetProperty: 'finish',
    relationshipType: 'correlation',
    materialType: 'tile',
    strength: 0.8,
    bidirectional: false,
    description: 'Material type influences the available finish options'
  })
});
```

### Adding Value Correlations

```typescript
// Add a correlation between porcelain material and matte finish
const correlation = await fetch(`/api/property-relationships/${relationshipId}/correlations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sourceValue: 'porcelain',
    targetValue: 'matte',
    correlationStrength: 0.7,
    sampleSize: 100,
    confidenceInterval: 0.05,
    isStatistical: true
  })
});
```

### Adding Compatibility Rules

```typescript
// Add a compatibility rule between matte finish and R11 rating
const rule = await fetch(`/api/property-relationships/${relationshipId}/compatibility`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sourceValue: 'matte',
    targetValue: 'R11',
    compatibilityType: 'recommended',
    reason: 'Matte finish works well with R11 rating for outdoor applications'
  })
});
```

### Validating Properties

```typescript
// Validate a set of property values
const validation = await fetch('/api/property-relationships/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    materialType: 'tile',
    properties: {
      material: 'porcelain',
      finish: 'polished',
      rRating: 'R12'
    }
  })
});

// Check validation result
const result = await validation.json();
if (!result.result.isValid) {
  console.log('Invalid property combination:');
  result.result.issues.forEach(issue => {
    console.log(`- ${issue.sourceProperty}=${issue.sourceValue} is ${issue.compatibilityType} with ${issue.targetProperty}=${issue.targetValue}`);
    if (issue.reason) {
      console.log(`  Reason: ${issue.reason}`);
    }
  });
}
```

### Getting Recommendations

```typescript
// Get recommendations for finish based on other properties
const recommendations = await fetch('/api/property-relationships/recommend', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    materialType: 'tile',
    properties: {
      material: 'porcelain',
      rRating: 'R11'
    },
    targetProperty: 'finish'
  })
});

// Display recommendations
const result = await recommendations.json();
console.log(`Recommendations for ${result.result.property}:`);
result.result.recommendations.forEach(rec => {
  console.log(`- ${rec.value} (confidence: ${rec.confidence.toFixed(2)})`);
});
```

## Integration with Material Metadata Panel

The Property Relationship Graph integrates with the Material Metadata Panel to provide:

1. **Validation**: Validate property values as they are entered
2. **Recommendations**: Suggest compatible property values
3. **Warnings**: Show warnings for incompatible property combinations
4. **Auto-fill**: Automatically fill in related properties

### Example Integration

```typescript
// In MaterialMetadataPanel.tsx

// Validate properties when they change
const handleMetadataChange = async (newMetadata: any) => {
  // Validate the new metadata
  const validation = await propertyRelationshipService.validateProperties({
    materialType,
    properties: newMetadata
  });
  
  // Update validation state
  setValidationResult(validation);
  
  // Call parent handler
  onMetadataChange(newMetadata);
};

// Get recommendations when a property changes
const handlePropertyChange = async (property: string, value: string) => {
  // Update metadata
  const newMetadata = { ...metadata, [property]: value };
  
  // Get recommendations for other properties
  const recommendations = await getRecommendationsForProperties(newMetadata);
  
  // Update recommendations state
  setRecommendations(recommendations);
  
  // Call the main handler
  handleMetadataChange(newMetadata);
};
```

## Benefits

The Property Relationship Graph provides numerous benefits:

1. **Smarter Recommendations**: The system can suggest compatible property values based on existing selections
2. **Better Validation**: Property values can be validated against known relationships
3. **Enhanced AI Understanding**: AI models can leverage relationship data for better inference
4. **Improved Search**: Search can use relationship data to find more relevant results
5. **Error Detection**: The system can detect inconsistent or unlikely property combinations
6. **Knowledge Capture**: The system captures domain expertise about property relationships

## Future Enhancements

Potential future enhancements to the Property Relationship Graph:

1. **Machine Learning Integration**: Use machine learning to automatically discover relationships and correlations
2. **Temporal Analysis**: Track how relationships change over time
3. **Confidence Scoring**: Add confidence scores to relationships based on data quality
4. **User Feedback Loop**: Allow users to provide feedback on recommendations
5. **Advanced Visualization**: Enhance the graph visualization with more interactive features

## Conclusion

The Property Relationship Graph is a powerful system for defining and working with relationships between material properties. By capturing these relationships, the system enables smarter recommendations, better validation, and enhanced AI understanding of materials.
