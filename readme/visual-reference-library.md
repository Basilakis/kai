# Visual Reference Library

This document describes the Visual Reference Library feature, which provides a comprehensive system for managing visual references for material properties and characteristics.

## Overview

The Visual Reference Library is a centralized repository of visual references for material properties, finishes, textures, and other characteristics. It enables:

1. **Visual Property Documentation**: Documenting material properties with visual examples
2. **AI Training Support**: Providing labeled visual data for AI model training
3. **User Education**: Helping users understand material properties through visual examples
4. **Consistent Terminology**: Ensuring consistent visual representation of properties across the platform
5. **Material-Specific Training**: Training models for specific material types and properties
6. **Property Recognition**: Automatically recognizing properties from images

## Architecture

The Visual Reference Library feature consists of the following components:

### Database Schema

- **visual_references**: Stores metadata about visual references, including property associations
- **visual_reference_images**: Stores images associated with visual references
- **visual_reference_tags**: Stores tags for visual references to improve searchability
- **visual_reference_annotations**: Stores annotations for visual references to highlight specific features

### API Endpoints

The following API endpoints are available for managing the Visual Reference Library:

#### Visual References

- `GET /api/visual-references`: Get visual references with filtering options
- `GET /api/visual-references/:id`: Get a visual reference by ID
- `POST /api/visual-references`: Create a new visual reference
- `PUT /api/visual-references/:id`: Update a visual reference
- `DELETE /api/visual-references/:id`: Delete a visual reference

#### Visual Reference Images

- `GET /api/visual-references/:id/images`: Get images for a visual reference
- `POST /api/visual-references/:id/images`: Add an image to a visual reference
- `DELETE /api/visual-references/images/:id`: Delete an image from a visual reference

#### Visual Reference Annotations

- `GET /api/visual-references/:id/annotations`: Get annotations for a visual reference
- `POST /api/visual-references/:id/annotations`: Add an annotation to a visual reference
- `PUT /api/visual-references/annotations/:id`: Update an annotation
- `DELETE /api/visual-references/annotations/:id`: Delete an annotation

#### Visual Reference Search

- `POST /api/visual-references/search`: Search for visual references
- `GET /api/visual-references/property/:propertyName`: Get visual references for a property
- `GET /api/visual-references/property/:propertyName/value/:propertyValue`: Get visual references for a property value

### Client Components

The following client components are available for working with the Visual Reference Library:

- **VisualReferenceGallery**: Displays a gallery of visual references
- **VisualReferenceViewer**: Displays a visual reference with annotations
- **VisualReferenceSelector**: Allows users to select visual references for a property
- **VisualReferenceUploader**: Allows users to upload new visual references

### Admin Components

The following admin components are available for managing the Visual Reference Library:

- **VisualReferenceManager**: Allows administrators to manage visual references
- **VisualReferenceAnnotator**: Allows administrators to annotate visual references

## Usage

### Adding a Visual Reference

Visual references can be added through the admin interface or by using the API.

```typescript
// Example: Adding a new visual reference
const newReference = {
  title: 'Matte Finish on Porcelain Tile',
  description: 'Example of a matte finish on porcelain tile, showing the non-reflective surface',
  propertyName: 'finish',
  propertyValue: 'matte',
  materialType: 'tile',
  tags: ['matte', 'porcelain', 'finish', 'non-reflective'],
  source: 'internal',
  isPublic: true
};

const response = await fetch('/api/visual-references', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(newReference)
});

const data = await response.json();
const referenceId = data.reference.id;

// Upload an image for the visual reference
const formData = new FormData();
formData.append('image', imageFile);
formData.append('caption', 'Close-up of matte finish on porcelain tile');
formData.append('isPrimary', 'true');

await fetch(`/api/visual-references/${referenceId}/images`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### Adding Annotations

Annotations can be added to highlight specific features in a visual reference.

```typescript
// Example: Adding an annotation to a visual reference image
const newAnnotation = {
  imageId: 'image-id',
  x: 150,
  y: 200,
  width: 100,
  height: 50,
  text: 'Note the non-reflective surface characteristic of matte finishes',
  type: 'rectangle'
};

await fetch(`/api/visual-references/${referenceId}/annotations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(newAnnotation)
});
```

### Displaying Visual References

The `VisualReferenceGallery` component can be used to display visual references for a property.

```tsx
import VisualReferenceGallery from '../components/visual-reference/VisualReferenceGallery';

// Example: Displaying visual references for a property
<VisualReferenceGallery
  propertyName="finish"
  propertyValue="matte"
  materialType="tile"
  maxItems={6}
  showAnnotations={true}
/>
```

### Viewing a Visual Reference

The `VisualReferenceViewer` component can be used to display a specific visual reference with annotations.

```tsx
import VisualReferenceViewer from '../components/visual-reference/VisualReferenceViewer';

// Example: Displaying a specific visual reference
<VisualReferenceViewer
  referenceId="reference-id"
  showAnnotations={true}
  enableZoom={true}
/>
```

## Integration with Other Features

### Material Metadata Panel Integration

The Visual Reference Library is integrated with the Material Metadata Panel to display visual references for properties.

```tsx
// In MaterialMetadataPanel.tsx

// Display visual references for a property
const renderPropertyField = (property: string, value: string) => {
  return (
    <Box>
      <TextField
        label={property}
        value={value}
        onChange={(e) => handlePropertyChange(property, e.target.value)}
      />
      <IconButton
        onClick={() => setShowVisualReferences({ property, value })}
        title="View visual references"
      >
        <ImageIcon />
      </IconButton>

      {showVisualReferences?.property === property && (
        <Dialog open={true} onClose={() => setShowVisualReferences(null)}>
          <DialogTitle>Visual References for {property}: {value}</DialogTitle>
          <DialogContent>
            <VisualReferenceGallery
              propertyName={property}
              propertyValue={value}
              materialType={materialType}
              showAnnotations={true}
            />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};
```

### Property Relationship Graph Integration

The Visual Reference Library can be integrated with the Property Relationship Graph to display visual examples of property relationships.

### AI Training Integration

The Visual Reference Library provides labeled visual data for AI model training, particularly for visual property identification.

## Best Practices

### Adding Visual References

When adding visual references, follow these best practices:

1. **Clear Images**: Use high-quality, clear images that clearly demonstrate the property
2. **Multiple Angles**: Include multiple angles or examples when relevant
3. **Proper Lighting**: Ensure proper lighting to accurately represent the property
4. **Consistent Scale**: Include scale references when size or dimension is important
5. **Detailed Annotations**: Add annotations to highlight specific features
6. **Comprehensive Metadata**: Include detailed metadata to improve searchability

### Organizing Visual References

To maintain an organized Visual Reference Library:

1. **Consistent Naming**: Use consistent naming conventions for properties and values
2. **Comprehensive Tagging**: Add relevant tags to improve searchability
3. **Proper Categorization**: Categorize references by material type and property
4. **Regular Updates**: Regularly update references to ensure they remain accurate and relevant

## Benefits

The Visual Reference Library provides several benefits:

1. **Improved Understanding**: Users can better understand material properties through visual examples
2. **Enhanced AI Training**: AI models can be trained with labeled visual data
3. **Consistent Terminology**: Visual references ensure consistent understanding of property terms
4. **Better Documentation**: Properties are documented with visual examples for clarity

## Property-Specific Training Implementation

The Visual Reference Library now includes a comprehensive property-specific training implementation that enables training models to recognize specific material properties from visual references.

### Property-Specific Training Module

The property-specific training module provides functions for training models to recognize specific material properties from visual references.

#### Features

- Material-specific model training
- Support for different model types (classification, regression, detection)
- Transfer learning with pre-trained models
- Data augmentation for improved model performance
- Comprehensive training metrics and evaluation

#### Training Process

1. **Dataset Preparation**: Organize visual references by property value
2. **Model Selection**: Choose appropriate model architecture based on property type
3. **Training**: Train model with transfer learning and data augmentation
4. **Evaluation**: Evaluate model performance with validation data
5. **Deployment**: Save model for use in prediction

### Dataset Structure

The Visual Reference Library organizes visual references in a structured way to facilitate training and prediction.

#### Organization

- **Material Type**: References are organized by material type (tile, wood, lighting, etc.)
- **Property Name**: Within each material type, references are organized by property name (color, texture, finish, etc.)
- **Property Value**: Within each property, references are organized by property value (red, glossy, matte, etc.)

### New API Endpoints

The Visual Reference Library now provides the following additional API endpoints:

#### Get Properties with Visual References

```
GET /api/ai/visual-reference/properties
```

Returns a list of properties with visual references, optionally filtered by material type.

#### Train Model for Property

```
POST /api/ai/visual-reference/train
```

Trains a model for a specific property and material type.

#### Predict Property Value

```
POST /api/ai/visual-reference/predict
```

Predicts a property value from an image using a trained model.

### Database Schema

The Visual Reference Library now uses the following additional database schema:

#### VisualPropertyReference

- `id`: UUID primary key
- `propertyName`: Name of the property
- `materialType`: Type of material
- `displayName`: Display name for the property
- `description`: Description of the property
- `previewImage`: Path to a preview image
- `modelPath`: Path to the trained model
- `modelAccuracy`: Accuracy of the trained model
- `lastTrainedAt`: When the model was last trained
- `createdAt`: When the reference was created
- `updatedAt`: When the reference was last updated

#### VisualPropertyReferenceItem

- `id`: UUID primary key
- `referenceId`: Reference to VisualPropertyReference
- `imagePath`: Path to the image file
- `propertyValue`: Value of the property
- `metadata`: Additional metadata (JSON)
- `createdAt`: When the item was created
- `updatedAt`: When the item was last updated

## Crawler Integration

The Visual Reference Library now integrates with the platform's existing crawler services to automatically collect visual references from websites.

### Integration Features

- **Import from Crawler Jobs**: Import images from completed crawler jobs as visual references
- **Auto-Classification**: Automatically classify imported images based on their visual characteristics
- **Selective Import**: Control which images to import and how many
- **Metadata Preservation**: Preserve source information as metadata for each reference

### Import Process

1. **Select Crawler Job**: Choose a completed crawler job that contains images
2. **Configure Import Options**: Specify property name, material type, and classification options
3. **Import Images**: The system downloads images from the crawler results and imports them as visual references
4. **Auto-Classification**: If enabled, the system analyzes each image to determine its properties
5. **Reference Creation**: The system creates visual reference items with appropriate metadata

### Benefits

- **Efficient Data Collection**: Quickly build comprehensive visual reference libraries
- **Consistent Quality**: Ensure consistent quality and format of visual references
- **Automated Classification**: Reduce manual tagging effort with auto-classification
- **Traceability**: Maintain links to source data for reference

## Advanced Features

The Visual Reference Library now includes several advanced features:

### Model Comparison

The Model Comparison feature allows administrators to:

- Compare different models for the same property
- Visualize performance metrics side by side
- Identify disagreement examples between models
- Get recommendations for the best model to use
- Create and manage multiple model versions

### Active Learning

The Active Learning system improves models over time by:

- Identifying uncertain samples where the model lacks confidence
- Collecting human feedback on these samples
- Incorporating this feedback into the training data
- Retraining models with the enhanced dataset
- Measuring improvement metrics

### Cross-Property Models

Cross-Property Models can recognize multiple properties at once:

- Train a single model to detect multiple properties simultaneously
- More efficient than using separate models for each property
- Share learned features across related properties
- Reduce overall computational requirements
- Provide consistent predictions across properties

### Specialized Crawlers

Specialized Crawlers are designed for specific property types:

- Configure crawlers with property-specific extraction rules
- Target websites that specialize in certain material properties
- Extract structured data along with images
- Automatically classify and categorize crawled content
- Seamlessly import results into the Visual Reference Library

## Future Enhancements

Potential future enhancements to the Visual Reference Library:

1. **3D References**: Add support for 3D models as visual references
2. **Video References**: Add support for video demonstrations
3. **AR Integration**: Integrate with AR to visualize properties in real-world contexts
4. **User Contributions**: Allow users to contribute visual references with moderation
5. **AI-Generated Annotations**: Use AI to automatically generate annotations
6. **Cross-Material Transfer Learning**: Use knowledge from one material type to improve models for other types
7. **User Feedback Loop**: Incorporate user feedback to improve model accuracy
8. **Federated Learning**: Enable distributed training across multiple instances

## Conclusion

The Visual Reference Library provides a comprehensive system for managing visual references for material properties and characteristics. By providing visual examples, it improves understanding, enhances AI training, ensures consistent terminology, and provides better documentation for material properties. The new property-specific training implementation enables automatic recognition of properties from images, further enhancing the platform's capabilities.
