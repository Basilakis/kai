# Advanced Property Validation

This document describes the Advanced Property Validation feature, which provides sophisticated validation rules for material properties to ensure data consistency and accuracy.

## Overview

Advanced Property Validation enables the definition and enforcement of complex validation rules for material properties. It helps maintain data quality by validating property values against defined constraints, ensuring that all property data meets the required standards.

Key capabilities include:

1. **Multiple Validation Types**: Support for various validation types including range, pattern, enumeration, dependency, custom, and composite validations
2. **Conditional Validation**: Ability to define validation rules that depend on the values of other properties
3. **Severity Levels**: Different severity levels for validation results (error, warning, info)
4. **Composite Rules**: Ability to combine multiple validation rules using logical operators (AND, OR, NOT)
5. **Real-time Validation**: Integration with property forms for real-time validation feedback

## Architecture

The Advanced Property Validation feature consists of the following components:

### Database Schema

- **validation_rules**: Stores validation rule definitions, including type-specific configuration
- **validation_rule_dependencies**: Stores relationships between composite validation rules and their component rules
- **validation_results**: Stores validation results for analytics purposes

For detailed information about the database schema, see [Validation Database Schema](./validation-database-schema.md).

### Types

The following validation rule types are supported:

1. **Range Validation**: Validates numeric values against minimum and maximum constraints
   - Parameters: min, max, step, unit

2. **Pattern Validation**: Validates string values against regular expression patterns
   - Parameters: pattern, flags

3. **Enumeration Validation**: Validates values against a list of allowed values
   - Parameters: allowedValues

4. **Dependency Validation**: Validates values based on the values of other properties
   - Parameters: condition (property, operator, value), requiredValue/requiredPattern/requiredRange

5. **Custom Validation**: Applies custom validation functions
   - Parameters: functionName, parameters

6. **Composite Validation**: Combines multiple validation rules with logical operators
   - Parameters: operator (AND, OR, NOT), rules

### API Endpoints

The following API endpoints are available for managing validation rules:

#### Validation Rules

- `GET /api/validation/rules`: Get validation rules with filtering options
- `GET /api/validation/rules/:id`: Get a validation rule by ID
- `POST /api/validation/rules`: Create a new validation rule
- `PUT /api/validation/rules/:id`: Update a validation rule
- `DELETE /api/validation/rules/:id`: Delete a validation rule

#### Validation

- `POST /api/validation/validate`: Validate a property value
- `POST /api/validation/validate-batch`: Validate multiple properties in batch

### Client Components

The following client components are available for working with validation rules:

- **ValidationRuleManager**: Admin component for managing validation rules
- **ValidationRuleForm**: Form for creating and editing validation rules
- **ValidationTester**: Component for testing validation rules with sample values
- **ValidationDisplay**: Component for displaying validation results

## Usage

### Creating a Validation Rule

Validation rules can be created through the admin interface or by using the API.

```typescript
// Example: Creating a range validation rule
const rangeRule = {
  name: 'Thickness Range',
  description: 'Validates that thickness is within the acceptable range',
  type: 'range',
  propertyName: 'thickness',
  materialType: 'tile',
  severity: 'error',
  message: 'Thickness must be between 5mm and 20mm',
  min: 5,
  max: 20,
  unit: 'mm'
};

const response = await fetch('/api/validation/rules', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(rangeRule)
});

const data = await response.json();
console.log('Created rule:', data.rule);
```

### Validating a Property Value

Property values can be validated using the validation API.

```typescript
// Example: Validating a property value
const validationRequest = {
  propertyName: 'thickness',
  value: 25,
  materialType: 'tile'
};

const response = await fetch('/api/validation/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(validationRequest)
});

const data = await response.json();
console.log('Validation passed:', data.isValid);
console.log('Validation results:', data.results);
```

### Batch Validation

Multiple properties can be validated in a single request.

```typescript
// Example: Batch validation
const batchValidationRequest = {
  materialType: 'tile',
  properties: {
    thickness: 15,
    width: 300,
    finish: 'matte'
  }
};

const response = await fetch('/api/validation/validate-batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(batchValidationRequest)
});

const data = await response.json();
console.log('All validations passed:', data.isValid);
console.log('Validation results:', data.results);
```

## Integration with Material Forms

The validation system can be integrated with material property forms to provide real-time validation feedback.

```tsx
import { useState, useEffect } from 'react';
import { TextField, FormHelperText } from '@mui/material';

// Example: Property field with validation
const PropertyField = ({ propertyName, value, onChange, materialType }) => {
  const [error, setError] = useState(null);

  // Validate on value change
  useEffect(() => {
    const validateProperty = async () => {
      try {
        const response = await fetch('/api/validation/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            propertyName,
            value,
            materialType
          })
        });

        const data = await response.json();

        if (!data.isValid) {
          // Find the first error message
          const errorResult = data.results.find(result => !result.isValid);
          setError(errorResult?.message || 'Invalid value');
        } else {
          setError(null);
        }
      } catch (err) {
        console.error('Validation error:', err);
      }
    };

    validateProperty();
  }, [propertyName, value, materialType]);

  return (
    <div>
      <TextField
        label={propertyName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={!!error}
      />
      {error && <FormHelperText error>{error}</FormHelperText>}
    </div>
  );
};
```

## Validation Rule Types

### Range Validation

Range validation rules validate numeric values against minimum and maximum constraints.

```typescript
// Example: Range validation rule
const rangeRule = {
  name: 'Temperature Range',
  type: 'range',
  propertyName: 'temperature',
  materialType: 'ceramic',
  severity: 'error',
  message: 'Temperature must be between 0°C and 100°C',
  min: 0,
  max: 100,
  step: 0.1,
  unit: '°C'
};
```

### Pattern Validation

Pattern validation rules validate string values against regular expression patterns.

```typescript
// Example: Pattern validation rule
const patternRule = {
  name: 'Color Code Format',
  type: 'pattern',
  propertyName: 'colorCode',
  materialType: 'paint',
  severity: 'error',
  message: 'Color code must be a valid hex color (e.g., #FF0000)',
  pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
};
```

### Enumeration Validation

Enumeration validation rules validate values against a list of allowed values.

```typescript
// Example: Enumeration validation rule
const enumRule = {
  name: 'Valid Finishes',
  type: 'enum',
  propertyName: 'finish',
  materialType: 'tile',
  severity: 'error',
  message: 'Finish must be one of: matte, glossy, satin, textured',
  allowedValues: ['matte', 'glossy', 'satin', 'textured']
};
```

### Dependency Validation

Dependency validation rules validate values based on the values of other properties.

```typescript
// Example: Dependency validation rule
const dependencyRule = {
  name: 'Slip Resistance for Outdoor Tiles',
  type: 'dependency',
  propertyName: 'slipResistance',
  materialType: 'tile',
  severity: 'error',
  message: 'Outdoor tiles must have a slip resistance rating of R10 or higher',
  condition: {
    propertyName: 'usage',
    operator: 'equals',
    value: 'outdoor'
  },
  requiredPattern: '^R(1[0-3]|9)$'
};
```

### Custom Validation

Custom validation rules apply custom validation functions.

```typescript
// Example: Custom validation rule
const customRule = {
  name: 'Valid Email',
  type: 'custom',
  propertyName: 'contactEmail',
  materialType: 'supplier',
  severity: 'error',
  message: 'Must be a valid email address',
  functionName: 'isEmail'
};
```

### Composite Validation

Composite validation rules combine multiple validation rules with logical operators.

```typescript
// Example: Composite validation rule
const compositeRule = {
  name: 'Outdoor Tile Requirements',
  type: 'composite',
  propertyName: 'isValid',
  materialType: 'tile',
  severity: 'error',
  message: 'Tile does not meet outdoor requirements',
  operator: 'and',
  rules: [
    'slip-resistance-rule-id',
    'frost-resistance-rule-id',
    'water-absorption-rule-id'
  ]
};
```

## Best Practices

### Creating Validation Rules

When creating validation rules, follow these best practices:

1. **Clear Names and Messages**: Use clear, descriptive names and error messages
2. **Appropriate Severity**: Use the appropriate severity level for each rule
3. **Reusable Rules**: Create reusable rules that can be applied to multiple material types
4. **Logical Grouping**: Group related rules using composite validation
5. **Consistent Validation**: Ensure consistent validation across similar properties

### Validation Rule Management

To maintain an organized validation rule system:

1. **Regular Review**: Regularly review and update validation rules
2. **Documentation**: Document the purpose and behavior of each rule
3. **Testing**: Test validation rules with various inputs to ensure they work as expected
4. **Versioning**: Consider versioning validation rules for backward compatibility

## Benefits

Advanced Property Validation provides several benefits:

1. **Data Quality**: Ensures that property data meets defined standards
2. **User Guidance**: Guides users to enter correct property values
3. **Consistency**: Maintains consistency across similar materials
4. **Error Prevention**: Prevents invalid data from entering the system
5. **Business Rules**: Enforces business rules and domain-specific constraints

## Future Enhancements

Potential future enhancements to the Advanced Property Validation feature:

1. **Rule Templates**: Create reusable validation rule templates
2. **Rule Import/Export**: Support for importing and exporting validation rules
3. **Validation Pipelines**: Define validation pipelines for complex validation scenarios
4. **Machine Learning Integration**: Use machine learning to suggest validation rules based on existing data
5. **Validation Analytics**: Provide analytics on validation rule effectiveness and common validation errors

## Conclusion

Advanced Property Validation provides a comprehensive system for ensuring data quality and consistency in material properties. By defining and enforcing validation rules, it helps maintain high-quality data that can be used reliably throughout the system.
