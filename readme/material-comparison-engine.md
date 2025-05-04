# Material Comparison Engine

The Material Comparison Engine enables sophisticated comparison between materials based on their properties, helping users find alternatives or compare options.

## Features

### Similarity Calculation

- **Property-Based Comparison**: Compares materials based on their property values
- **Weighted Algorithms**: Prioritizes important properties in the comparison
- **Normalized Values**: Normalizes property values to ensure fair comparison
- **Overall Similarity Score**: Calculates a weighted average of all property similarities

### Comparison Views

- **Side-by-Side Comparison**: Displays properties of two materials side by side
- **Visual Indicators**: Uses color coding to highlight similarities and differences
- **Property Importance**: Marks properties as high, medium, or low importance
- **Sortable Results**: Allows sorting by property name, similarity, or importance
- **Filtering**: Filters properties by importance level

### Batch Comparison

- **Multiple Material Selection**: Compares multiple materials at once
- **Comparison Matrix**: Shows similarity scores between all selected materials
- **Detailed View**: Provides detailed comparison for any pair of materials
- **Export Options**: Exports comparison results for reporting

### Similar Materials

- **Find Alternatives**: Finds materials similar to a selected material
- **Similarity Threshold**: Filters results by minimum similarity score
- **Material Type Filter**: Filters results by material type
- **Detailed Comparison**: Shows detailed comparison between the source material and any similar material

### Comparison Presets

- **Custom Weights**: Creates custom weighting schemes for different comparison scenarios
- **Default Presets**: Provides default presets for common comparison scenarios
- **Material-Specific Presets**: Creates presets specific to certain material types
- **Property Inclusion/Exclusion**: Includes or excludes specific properties from comparison

## Technical Implementation

### Backend

- **Comparison Service**: Handles material comparison logic
- **Similarity Algorithms**: Implements algorithms for different property types (numeric, string, boolean, array)
- **Normalization**: Normalizes property values based on their expected ranges
- **Preset Management**: Manages comparison presets

### Database

- **Comparison Results**: Stores comparison results for future reference
- **Comparison Presets**: Stores user-defined comparison presets
- **Default Weights**: Stores default weights for different material types

### Frontend

- **Comparison View**: Displays detailed comparison between materials
- **Batch Comparison**: Enables comparison of multiple materials
- **Similar Materials View**: Displays materials similar to a selected material
- **Preset Management**: Manages comparison presets

## Usage

### Comparing Two Materials

1. Navigate to a material detail page
2. Click "Compare with Another Material"
3. Select another material to compare with
4. View the detailed comparison

### Finding Similar Materials

1. Navigate to a material detail page
2. Click "Find Similar Materials"
3. Adjust similarity threshold and material type filter as needed
4. View the list of similar materials
5. Click on any similar material to see a detailed comparison

### Batch Comparison

1. Navigate to the Batch Comparison page
2. Select multiple materials to compare
3. Optionally select a comparison preset
4. Click "Compare Materials"
5. View the comparison matrix
6. Click on any pair to see a detailed comparison

### Managing Comparison Presets

1. Navigate to the Batch Comparison page
2. Click "Comparison Presets"
3. Create, edit, or delete presets
4. Adjust property weights as needed
5. Save the preset for future use

## Benefits

- **Find Alternatives**: Helps users find alternative materials with similar properties
- **Compare Options**: Makes it easier to compare options for a project
- **Identify Differences**: Highlights subtle differences between similar materials
- **Support Substitution**: Supports substitution workflows when materials are unavailable
- **Batch Processing**: Enables efficient comparison of multiple materials at once
