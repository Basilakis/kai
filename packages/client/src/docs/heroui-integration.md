# HeroUI Integration Guide

This document outlines the integration of HeroUI into the Kai application. HeroUI is being used for both frontend and backend UI components to provide a consistent design system across the application.

## Overview

HeroUI has been integrated into the project to standardize the UI components and provide a consistent look and feel. The integration is set up to:

1. Allow gradual adoption (existing components will be updated later)
2. Ensure new components use HeroUI from the start
3. Maintain a consistent theme across the application

## Files and Structure

The HeroUI integration consists of the following files:

- `src/theme/heroui-theme.ts` - Contains the HeroUI theme configuration
- `src/providers/HeroUIProvider.tsx` - Provider component that wraps the application with HeroUI theme
- `gatsby-browser.js` and `gatsby-ssr.js` - Wrap the application with the HeroUIProvider
- `src/components/examples/HeroUIExample.tsx` - Example component showcasing HeroUI usage

## Usage Guidelines

### For New Components

All new components should use HeroUI components and styling. Here's a basic example:

```tsx
import React from 'react';
import { Button, Card, TextField } from '@heroui/react';

const MyNewComponent: React.FC = () => {
  return (
    <Card>
      <h2>My New Component</h2>
      <TextField label="Example Input" />
      <Button variant="contained">Submit</Button>
    </Card>
  );
};

export default MyNewComponent;
```

### Theme Access

You can access the HeroUI theme in your components:

```tsx
import React from 'react';
import { useTheme } from '@heroui/react';

const MyComponent: React.FC = () => {
  const theme = useTheme();
  
  return (
    <div style={{ color: theme.colors.primary.main }}>
      Themed content
    </div>
  );
};
```

### Common Components

Here are some commonly used HeroUI components:

- `Button` - For actions and triggers
- `Card` - For containing related content
- `TextField` - For text input
- `Select` - For dropdown selection
- `Alert` - For notifications and messages
- `Modal` - For dialogs and popups
- `Table` - For tabular data

### Existing Components

Existing components will continue to use their current styling (Material-UI or styled-components) until they are updated to use HeroUI. Do not modify existing component styling unless specifically tasked with updating them to use HeroUI.

## Backend Integration

For backend admin interfaces, HeroUI is also available via the `@heroui/node` package. Backend templates should follow the same design system for consistency.

## Best Practices

1. **Consistency**: Follow the HeroUI component patterns for consistent user experience
2. **Theme Variables**: Use theme variables instead of hardcoded values for colors, spacing, etc.
3. **Responsive Design**: Ensure components work across different screen sizes
4. **Accessibility**: Maintain accessibility standards when using HeroUI components

## Reference Example

See `src/components/examples/HeroUIExample.tsx` for a reference implementation showing how HeroUI components and styling should be used.

## Resources

- [HeroUI Documentation](https://www.heroui.com/docs) - Official documentation for HeroUI components and API
- [Theme Customization](https://www.heroui.com/docs/guide/customization) - How to customize the HeroUI theme