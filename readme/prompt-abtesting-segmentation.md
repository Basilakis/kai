# Prompt A/B Testing and User Segmentation

This document describes the A/B testing and user segmentation features for prompt success tracking, which help optimize prompts for different user segments and compare different prompt variations.

## Overview

The A/B testing and user segmentation system consists of several components:

1. **Database Schema**: Tables for storing A/B test experiments, variants, and user segments
2. **Backend Services**: APIs for managing experiments and segments
3. **Client-Side Integration**: Tools for assigning users to experiments and segments
4. **Admin UI**: Dashboard for creating and monitoring experiments and segments
5. **Analytics**: Tools for analyzing experiment results and segment performance

## A/B Testing

### Concepts

- **Experiment**: A test comparing multiple variants of a prompt
- **Variant**: A specific version of a prompt being tested
- **Control**: The baseline variant to compare against
- **Traffic Allocation**: Percentage of users included in the experiment
- **Assignment**: Assignment of a user to a specific variant

### Creating an Experiment

To create an A/B test experiment:

1. Define the experiment name, description, and traffic allocation
2. Create at least two variants (one control and one or more test variants)
3. Set the weight for each variant (determines the probability of assignment)
4. Activate the experiment

Example:

```typescript
const experimentId = await promptService.createABExperiment({
  name: 'Product Description Prompt Test',
  description: 'Testing different prompt formats for product descriptions',
  trafficAllocation: 50, // 50% of users will be included
  isActive: true,
  variants: [
    {
      promptId: 'original-prompt-id',
      variantName: 'Control',
      isControl: true,
      weight: 1
    },
    {
      promptId: 'new-prompt-id',
      variantName: 'Test Variant',
      isControl: false,
      weight: 1
    }
  ]
});
```

### Using A/B Testing in Your Application

To use A/B testing in your application:

```typescript
// Render a prompt with A/B testing
const { content, variantId, experimentId } = await promptService.renderPrompt({
  promptId: 'original-prompt-id', // Will be replaced with variant if user is in experiment
  data: { /* your data */ },
  userId: 'user-123',
  sessionId: 'session-456',
  abTestingEnabled: true
});

// Later, track success
await promptService.updatePromptTrackingRecord(trackingId, {
  isSuccessful: true,
  // Other feedback data
});
```

### Analyzing Experiment Results

To analyze experiment results:

```typescript
const results = await promptService.getExperimentResults(
  experimentId,
  startDate,
  endDate
);

// Compare success rates
const controlVariant = results.find(r => r.isControl);
const testVariants = results.filter(r => !r.isControl);

for (const variant of testVariants) {
  const improvement = variant.successRate - controlVariant.successRate;
  console.log(`${variant.variantName}: ${improvement.toFixed(2)}% improvement`);
}
```

## User Segmentation

### Concepts

- **Segment**: A group of users with similar characteristics
- **Segment Type**: The type of segmentation (demographic, behavioral, etc.)
- **Segment Criteria**: Rules for assigning users to segments
- **Segment Assignment**: Assignment of a user to a specific segment

### Creating a Segment

To create a user segment:

1. Define the segment name, description, and type
2. Define the segment criteria
3. Activate the segment

Example:

```typescript
const segmentId = await promptService.createUserSegment({
  name: 'Power Users',
  description: 'Users who use the application frequently',
  segmentType: 'behavioral',
  segmentCriteria: {
    usageFrequency: 'high',
    minSessionsPerWeek: 5
  },
  isActive: true
});
```

### Using Segmentation in Your Application

To use segmentation in your application:

```typescript
// Render a prompt with segmentation
const { content } = await promptService.renderPrompt({
  promptId: 'prompt-id',
  data: { /* your data */ },
  userId: 'user-123',
  sessionId: 'session-456'
  // Segment will be automatically detected
});

// Or specify a segment explicitly
const { content } = await promptService.renderPrompt({
  promptId: 'prompt-id',
  data: { /* your data */ },
  segmentId: 'segment-id'
});
```

### Analyzing Segment Performance

To analyze segment performance:

```typescript
const analytics = await promptService.getPromptUsageAnalytics(
  promptId,
  startDate,
  endDate,
  segmentId
);

// Calculate success rate
const totalUses = analytics.reduce((sum, a) => sum + a.totalUses, 0);
const successfulUses = analytics.reduce((sum, a) => sum + a.successfulUses, 0);
const successRate = totalUses > 0 ? (successfulUses / totalUses) * 100 : 0;

console.log(`Success rate for segment: ${successRate.toFixed(2)}%`);
```

### Comparing Segments

To compare multiple segments:

```typescript
const results = await promptService.compareSegments(
  [segmentId1, segmentId2],
  promptId,
  startDate,
  endDate
);

// Compare success rates
for (const result of results) {
  console.log(`${result.segmentName}: ${result.successRate.toFixed(2)}%`);
}
```

## Enhanced Auto-Detection

The enhanced auto-detection system uses sophisticated behavior analysis to determine whether a prompt was successful.

### Tracked Behaviors

The system tracks the following user behaviors:

- **Basic Metrics**:
  - Time spent on page
  - Scroll depth
  - Clicked links
  - Copied text
  - Follow-up questions

- **Enhanced Metrics**:
  - Interaction count
  - Interaction duration
  - Interaction patterns
  - Follow-up sentiment
  - Keyboard and mouse activity
  - Page focus/blur events
  - Visibility changes

### Interaction Patterns

The system tracks specific interaction patterns that indicate success or failure:

- **Positive Patterns**:
  - Highlighting text
  - Saving the response
  - Sharing the response
  - Expanding details

- **Negative Patterns**:
  - Closing immediately
  - Retrying the query
  - Reporting an issue
  - Requesting an alternative

### Sentiment Analysis

The system performs simple sentiment analysis on follow-up questions to determine user satisfaction:

```typescript
// Simple sentiment analysis
const positiveWords = ['thanks', 'good', 'great', 'helpful', 'useful'];
const negativeWords = ['not', 'wrong', 'bad', 'unclear', 'confusing'];

// Calculate sentiment score between -1 and 1
const sentimentScore = (positiveCount - negativeCount) / total;
```

### Using Enhanced Auto-Detection

To use enhanced auto-detection in your application:

```typescript
// Create a success tracker
const tracker = createPromptSuccessTracker(trackingId, responseTimeMs);

// Record a follow-up question with text
tracker.recordFollowupQuestion('Thanks, that was very helpful!');

// Auto-detect success
await tracker.autoDetectSuccess();
```

## Admin UI

The admin UI provides tools for managing A/B tests and user segments:

### A/B Testing Dashboard

- Create and manage experiments
- View experiment results
- Compare variant performance
- End experiments and promote winning variants

### Segmentation Dashboard

- Create and manage user segments
- View segment analytics
- Compare segment performance
- Optimize prompts for specific segments

## Best Practices

1. **Start with Clear Hypotheses**: Define clear hypotheses for A/B tests
2. **Use Meaningful Segments**: Create segments that represent distinct user groups
3. **Test One Variable at a Time**: Change only one aspect of the prompt in each variant
4. **Run Tests Long Enough**: Allow tests to run until statistical significance is achieved
5. **Monitor Segment Performance**: Regularly check how prompts perform across segments
6. **Iterate Based on Results**: Use test results to improve prompts over time
7. **Combine A/B Testing with Segmentation**: Test different variants for different segments

## Troubleshooting

- **No Variant Assignment**: Check that the experiment is active and traffic allocation is sufficient
- **Segment Not Detected**: Verify that segment criteria are correctly defined
- **Low Statistical Significance**: Increase test duration or traffic allocation
- **Inconsistent Results**: Check for external factors affecting test results

## Conclusion

The A/B testing and user segmentation system provides powerful tools for optimizing prompts for different user groups and comparing different prompt variations. By combining these features with enhanced auto-detection, you can continuously improve the quality and effectiveness of your AI interactions.
