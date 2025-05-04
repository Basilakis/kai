# Relationship-Aware Model Training and Search Enhancement

This document describes the Relationship-Aware Model Training and Search Enhancement features, which leverage the Property Relationship Graph to improve AI model training and search functionality.

## Overview

The Relationship-Aware Model Training and Search Enhancement features use the knowledge captured in the Property Relationship Graph to:

1. **Enhance AI Model Training**: Improve property prediction models by incorporating relationship data
2. **Enhance Search Functionality**: Improve search relevance and recommendations using relationship data

## Relationship-Aware Model Training

### Architecture

The Relationship-Aware Model Training feature consists of the following components:

#### Relationship-Aware Training Service

The `relationshipAwareTrainingService` is responsible for:

- Extracting features from property relationships for AI model training
- Generating training data with relationship-based features
- Training models with relationship-enhanced features
- Evaluating model performance and relationship contribution
- Managing training jobs and model registry

#### Relationship Feature Extractor

The service includes feature extraction capabilities:

- Extracting direct and indirect relationships from the Property Relationship Graph
- Weighting relationships based on strength and relevance
- Converting relationship data into model features
- Handling different relationship types appropriately

#### Model Training and Evaluation

The service handles model training and evaluation:

- Creating and training models with relationship features
- Evaluating model performance with and without relationship features
- Calculating feature importance and relationship contribution
- Providing detailed performance metrics and insights

#### API Endpoints

The following API endpoints are available for relationship-aware training:

- `POST /api/ai/relationship-aware-training/train`: Train a relationship-aware model
- `GET /api/ai/relationship-aware-training/job/:jobId`: Get training job status

### Key Features

1. **Relationship-Aware Feature Engineering**: The system extracts features from the Property Relationship Graph to enhance model training.
2. **Indirect Relationship Discovery**: The system can discover and utilize multi-hop relationships between properties.
3. **Relationship Strength Weighting**: Relationships are weighted based on their strength and relevance to the target property.
4. **Relationship Type Handling**: Different relationship types (correlation, dependency, compatibility, etc.) are handled appropriately.
5. **Performance Comparison**: The system compares model performance with and without relationship features.
6. **Feature Importance Analysis**: The system analyzes and visualizes the importance of different features, including relationship features.
7. **Relationship Contribution Metrics**: The system provides metrics on how much relationships contribute to model performance.
8. **Model Registry and Management**: Trained models are stored, versioned, and managed for future use.

### Usage Examples

#### Training a Relationship-Aware Model

```typescript
// Train a relationship-aware model to predict finish based on other properties
const result = await fetch('/api/ai/relationship-aware-training/train', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    materialType: 'tile',
    targetProperty: 'finish',
    options: {
      includeRelationships: true,
      relationshipTypes: ['correlates_with', 'depends_on', 'compatibility'],
      relationshipStrengthThreshold: 0.3,
      maxRelationshipDepth: 2,
      useTransferLearning: true,
      epochs: 50,
      batchSize: 32,
      learningRate: 0.001,
      validationSplit: 0.2
    }
  })
});

// Get training result
const data = await result.json();
console.log('Model ID:', data.result.modelId);
console.log('Accuracy:', data.result.accuracy);
console.log('Validation Accuracy:', data.result.validationAccuracy);
console.log('Baseline Accuracy:', data.result.baselineAccuracy);
console.log('Improvement:', data.result.improvementPercentage + '%');
```

#### Checking Training Job Status

```typescript
// Check training job status
const status = await fetch(`/api/ai/relationship-aware-training/job/${jobId}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
});

// Display job status
const data = await status.json();
console.log('Job Status:', data.status.status);
console.log('Progress:', data.status.progress * 100 + '%');
console.log('Created At:', new Date(data.status.createdAt).toLocaleString());
console.log('Updated At:', new Date(data.status.updatedAt).toLocaleString());
```

#### Using the Relationship-Aware Training Form

```tsx
import { RelationshipAwareTrainingForm } from '../components/RelationshipAwareTraining';

// In your component
const handleTrainingComplete = (result) => {
  console.log('Training completed:', result);
  // Do something with the result
};

// In your render method
return (
  <RelationshipAwareTrainingForm onTrainingComplete={handleTrainingComplete} />
);
```

#### Displaying Model Results

```tsx
import { RelationshipAwareModelResults } from '../components/RelationshipAwareTraining';

// In your component
const [modelResult, setModelResult] = useState(null);

// After training is complete
const handleTrainingComplete = (result) => {
  setModelResult(result);
};

// In your render method
return (
  <>
    <RelationshipAwareTrainingForm onTrainingComplete={handleTrainingComplete} />
    {modelResult && <RelationshipAwareModelResults result={modelResult} />}
  </>
);
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

1. **Improved AI Model Accuracy**: AI models can make better predictions by leveraging relationship data, with measurable improvements in accuracy.
2. **Enhanced Feature Engineering**: Relationship data provides valuable features that might not be captured in the raw material properties.
3. **Deeper Insights**: The system provides insights into which relationships are most important for predicting different properties.
4. **More Relevant Search**: Search results are more relevant due to relationship-based scoring and query expansion.
5. **Better Recommendations**: Users receive better recommendations based on relationship context and property correlations.
6. **Enhanced User Experience**: Users can find what they're looking for more easily and discover related materials.
7. **Continuous Improvement**: The feedback loop between AI models and relationship data creates a virtuous cycle of improvement.
8. **Data Quality Enhancement**: Anomaly detection helps identify data quality issues and inconsistencies.

## Future Enhancements

Potential future enhancements to these features:

1. **Multi-Property Prediction**: Predict multiple properties simultaneously using a single model
2. **Automated Relationship Discovery**: Automatically discover new relationships from data patterns
3. **Real-time Model Updates**: Update models in real-time as new relationship data becomes available
4. **Personalized Search**: Incorporate user preferences and behavior into relationship-based search
5. **User Feedback Integration**: Use explicit user feedback to improve relationship data and model training
6. **Advanced Visualization**: Provide more advanced visualizations of relationship impacts and model performance
7. **Multi-Modal Relationship Learning**: Incorporate image and text data into relationship learning
8. **Cross-Domain Relationships**: Extend relationship graph to include cross-domain relationships
9. **Explainable AI**: Provide more detailed explanations of how relationships influence predictions
10. **Distributed Training**: Support distributed training for larger models and datasets

## Conclusion

The Relationship-Aware Model Training and Search Enhancement features leverage the knowledge captured in the Property Relationship Graph to improve AI model training and search functionality. By incorporating relationship data, these features provide smarter predictions, more relevant search results, and better recommendations, enhancing the overall user experience.
