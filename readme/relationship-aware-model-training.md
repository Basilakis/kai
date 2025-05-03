# Relationship-Aware Model Training and Search Enhancement

This document describes the Relationship-Aware Model Training and Search Enhancement features, which leverage the Property Relationship Graph to improve AI model training and search functionality.

## Overview

The Relationship-Aware Model Training and Search Enhancement features use the knowledge captured in the Property Relationship Graph to:

1. **Enhance AI Model Training**: Improve property prediction models by incorporating relationship data
2. **Enhance Search Functionality**: Improve search relevance and recommendations using relationship data

## Relationship-Aware Model Training

### Architecture

The Relationship-Aware Model Training feature consists of the following components:

#### Relationship Feature Extractor

The `relationshipFeatureExtractor` is responsible for:

- Extracting features from property relationships for AI model training
- Generating training data with relationship-based features
- Enhancing model predictions with relationship data

#### Property Prediction Service

The `propertyPredictionService` is responsible for:

- Training models to predict property values based on other properties
- Using TensorFlow.js for model creation and training
- Integrating relationship features into the prediction process

#### API Endpoints

The following API endpoints are available for property prediction:

- `POST /api/ai/property-prediction/train`: Train a model to predict a property
- `POST /api/ai/property-prediction/predict`: Predict a property value using a trained model

### Key Features

1. **Relationship-Aware Feature Engineering**: The system extracts features from the Property Relationship Graph to enhance model training.
2. **Synthetic Training Data Generation**: The system can generate synthetic training data based on relationship knowledge.
3. **Enhanced Prediction Confidence**: Predictions are enhanced with relationship data to improve confidence.
4. **Model Persistence and Management**: Trained models are stored and managed for future use.

### Usage Examples

#### Training a Model

```typescript
// Train a model to predict finish based on other properties
const modelId = await fetch('/api/ai/property-prediction/train', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    materialType: 'tile',
    targetProperty: 'finish',
    options: {
      sampleSize: 1000,
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2
    }
  })
});
```

#### Predicting a Property Value

```typescript
// Predict finish based on other properties
const prediction = await fetch('/api/ai/property-prediction/predict', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    modelId: 'model-id',
    properties: {
      material: 'porcelain',
      color: 'white',
      rRating: 'R11'
    }
  })
});

// Display predictions
const result = await prediction.json();
console.log('Predicted finishes:');
result.predictions.forEach(pred => {
  console.log(`- ${pred.value} (probability: ${pred.probability.toFixed(2)})`);
});
```

## Relationship-Enhanced Search

### Architecture

The Relationship-Enhanced Search feature consists of the following components:

#### Relationship Enhanced Search Service

The `relationshipEnhancedSearch` service is responsible for:

- Expanding search queries using relationship data
- Calculating relationship-based relevance scores
- Reranking search results based on relationship relevance
- Generating related search suggestions

#### API Endpoints

The following API endpoints are available for relationship-enhanced search:

- `POST /api/search/relationship-enhanced`: Perform a search with relationship-based reranking
- `POST /api/search/expand-query`: Expand a search query using relationship data
- `POST /api/search/related-searches`: Generate related search suggestions

#### UI Components

The following UI components are available for relationship-enhanced search:

- `RelationshipEnhancedSearchProvider`: Context provider for relationship-enhanced search
- `RelatedSearches`: Component for displaying related search suggestions
- `RelationshipEnhancedResults`: Component for displaying search results with relationship scores

### Key Features

1. **Query Expansion**: The system expands search queries based on correlations and compatibility relationships.
2. **Relevance Scoring**: Search results are scored based on relationship strength and compatibility.
3. **Result Reranking**: Search results are reranked based on relationship relevance.
4. **Related Search Suggestions**: The system generates related search suggestions based on property relationships.

### Usage Examples

#### Performing a Relationship-Enhanced Search

```typescript
// Perform a relationship-enhanced search
const results = await fetch('/api/search/relationship-enhanced', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    materialType: 'tile',
    query: {
      material: 'porcelain',
      finish: 'matte'
    },
    results: originalResults // Results from a standard search
  })
});

// Display reranked results
const data = await results.json();
console.log('Reranked results:');
data.results.forEach(result => {
  console.log(`- ${result.properties.name} (score: ${result.finalScore.toFixed(2)})`);
});
```

#### Expanding a Search Query

```typescript
// Expand a search query using relationship data
const expandedQuery = await fetch('/api/search/expand-query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    materialType: 'tile',
    query: {
      material: 'porcelain',
      finish: 'matte'
    }
  })
});

// Use expanded query for search
const data = await expandedQuery.json();
console.log('Expanded query:', data.expandedQuery);
```

#### Getting Related Search Suggestions

```typescript
// Get related search suggestions
const relatedSearches = await fetch('/api/search/related-searches', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    materialType: 'tile',
    query: {
      material: 'porcelain',
      finish: 'matte'
    }
  })
});

// Display related search suggestions
const data = await relatedSearches.json();
console.log('Related searches:');
data.relatedSearches.forEach(suggestion => {
  console.log(`- ${suggestion.property}: ${suggestion.value} (confidence: ${suggestion.confidence.toFixed(2)})`);
});
```

## Integration with Other Features

### Property Relationship Graph Integration

Both features are tightly integrated with the Property Relationship Graph:

1. **Model Training**: Uses relationship data to enhance feature engineering and prediction
2. **Search Enhancement**: Uses relationship data to improve relevance and recommendations

### Material Metadata Panel Integration

The Property Prediction feature can be integrated with the Material Metadata Panel to:

1. **Auto-fill Properties**: Automatically fill in predicted property values
2. **Validate Properties**: Validate property values against predictions

### Search Interface Integration

The Relationship-Enhanced Search feature can be integrated with the search interface to:

1. **Display Related Searches**: Show related search suggestions
2. **Highlight Relationship Scores**: Display relationship scores for search results
3. **Explain Relevance**: Explain why certain results are relevant

## Benefits

These features provide several benefits:

1. **Smarter Predictions**: AI models can make better predictions by leveraging relationship data
2. **More Relevant Search**: Search results are more relevant due to relationship-based scoring
3. **Better Recommendations**: Users receive better recommendations based on relationship data
4. **Enhanced User Experience**: Users can find what they're looking for more easily

## Future Enhancements

Potential future enhancements to these features:

1. **Multi-Property Prediction**: Predict multiple properties simultaneously
2. **Personalized Search**: Incorporate user preferences into relationship-based search
3. **Feedback Loop**: Use user feedback to improve relationship data
4. **Advanced Visualization**: Visualize relationship-based search results

## Conclusion

The Relationship-Aware Model Training and Search Enhancement features leverage the knowledge captured in the Property Relationship Graph to improve AI model training and search functionality. By incorporating relationship data, these features provide smarter predictions, more relevant search results, and better recommendations, enhancing the overall user experience.
