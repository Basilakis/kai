# Multilingual Property Dictionaries

This document describes the Multilingual Property Dictionaries feature, which enables cross-language search, identification, and localized property display in the KAI platform.

## Overview

The Multilingual Property Dictionaries feature provides a comprehensive system for managing property names and values in multiple languages. This enables:

1. **Cross-language search and identification**: Users can search for properties using terms in their preferred language.
2. **Localized property display**: Property names and values can be displayed in the user's preferred language.
3. **Consistent terminology**: Ensures consistent translation of technical terms across the platform.

## Architecture

The Multilingual Property Dictionaries feature consists of the following components:

### Database Schema

- **language_codes**: Stores supported languages with their codes, names, and native names.
- **property_name_translations**: Stores translations of property names in different languages.
- **property_value_translations**: Stores translations of property values in different languages.

### API Endpoints

The following API endpoints are available for managing multilingual property dictionaries:

#### Language Management

- `GET /api/multilingual/languages`: Get all language codes.
- `GET /api/multilingual/languages/:code`: Get a language code by code.
- `POST /api/multilingual/languages`: Create a new language code (admin only).
- `PUT /api/multilingual/languages/:code`: Update a language code (admin only).

#### Property Name Translations

- `GET /api/multilingual/property-names`: Get property name translations.
- `GET /api/multilingual/property-names/:id`: Get a property name translation by ID.
- `POST /api/multilingual/property-names`: Create a new property name translation.
- `PUT /api/multilingual/property-names/:id`: Update a property name translation.
- `DELETE /api/multilingual/property-names/:id`: Delete a property name translation.

#### Property Value Translations

- `GET /api/multilingual/property-values`: Get property value translations.
- `GET /api/multilingual/property-values/:id`: Get a property value translation by ID.
- `POST /api/multilingual/property-values`: Create a new property value translation.
- `PUT /api/multilingual/property-values/:id`: Update a property value translation.
- `DELETE /api/multilingual/property-values/:id`: Delete a property value translation.

#### Multilingual Property Operations

- `GET /api/multilingual/properties`: Get multilingual properties.
- `GET /api/multilingual/property-values/:propertyName`: Get multilingual property values.
- `POST /api/multilingual/material-properties`: Get multilingual material properties.
- `POST /api/multilingual/translate-property-name`: Translate a property name.
- `POST /api/multilingual/translate-property-value`: Translate a property value.

### Client Components

The following client components are available for working with multilingual property dictionaries:

- **LanguageSelector**: Allows users to select their preferred language.
- **MultilingualPropertyDisplay**: Displays a property name and value in the user's selected language.
- **MultilingualMaterialProperties**: Displays all properties of a material in the user's selected language.

### Admin Components

The following admin components are available for managing multilingual property dictionaries:

- **MultilingualDictionaryManager**: Allows administrators to manage property name and value translations.

## Usage

### Setting Up Languages

Before using the multilingual property dictionaries, you need to set up the languages you want to support. This can be done through the admin interface or by using the API.

```typescript
// Example: Adding a new language
const newLanguage = {
  code: 'fr',
  name: 'French',
  nativeName: 'Français',
  isActive: true
};

await fetch('/api/multilingual/languages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(newLanguage)
});
```

### Adding Property Name Translations

Property name translations can be added through the admin interface or by using the API.

```typescript
// Example: Adding a property name translation
const propertyNameTranslation = {
  propertyName: 'finish',
  languageCode: 'fr',
  translation: 'Finition',
  description: 'Surface finish of the material'
};

await fetch('/api/multilingual/property-names', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(propertyNameTranslation)
});
```

### Adding Property Value Translations

Property value translations can be added through the admin interface or by using the API.

```typescript
// Example: Adding a property value translation
const propertyValueTranslation = {
  propertyName: 'finish',
  propertyValue: 'matte',
  languageCode: 'fr',
  translation: 'Mat',
  description: 'Non-glossy finish'
};

await fetch('/api/multilingual/property-values', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(propertyValueTranslation)
});
```

### Displaying Properties in the User's Language

The `MultilingualPropertyDisplay` component can be used to display properties in the user's selected language.

```tsx
import MultilingualPropertyDisplay from '../components/multilingual/MultilingualPropertyDisplay';

// Example: Displaying a property in the user's language
<MultilingualPropertyDisplay
  propertyName="finish"
  propertyValue="matte"
  variant="label"
  showOriginal={true}
/>
```

### Displaying All Material Properties in the User's Language

The `MultilingualMaterialProperties` component can be used to display all properties of a material in the user's selected language.

```tsx
import MultilingualMaterialProperties from '../components/multilingual/MultilingualMaterialProperties';

// Example: Displaying all material properties in the user's language
<MultilingualMaterialProperties
  materialId="123"
  properties={% raw %}{{
    finish: 'matte',
    color: 'white',
    size: '60x60'
  }}{% endraw %}
  showOriginal={true}
/>
```

### Changing the User's Language

The `LanguageSelector` component can be used to allow users to change their preferred language.

```tsx
import LanguageSelector from '../components/language/LanguageSelector';

// Example: Adding a language selector to the header
<LanguageSelector variant="dropdown" />
```

## Integration with Other Features

### Search Integration

The multilingual property dictionaries are integrated with the search system to enable cross-language search. When a user searches for a property in their preferred language, the search system will also look for the corresponding property in other languages.

### Material Metadata Panel Integration

The multilingual property dictionaries are integrated with the Material Metadata Panel to display property names and values in the user's preferred language.

### Property Relationship Graph Integration

The multilingual property dictionaries are integrated with the Property Relationship Graph to display relationship names and values in the user's preferred language.

## Best Practices

### Adding New Properties

When adding new properties to the system, make sure to add translations for all supported languages. This ensures a consistent user experience across languages.

### Updating Translations

When updating translations, make sure to update them for all supported languages. This ensures that users of all languages have access to the latest information.

### Testing Translations

Test the application with different language settings to ensure that all translations are displayed correctly and that the application functions as expected in all languages.

## Conclusion

The Multilingual Property Dictionaries feature provides a comprehensive system for managing property names and values in multiple languages. This enables cross-language search, identification, and localized property display, enhancing the user experience for non-English speakers and ensuring consistent terminology across the platform.
