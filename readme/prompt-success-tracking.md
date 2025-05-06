# Prompt Success Tracking

This document describes the enhanced prompt success tracking system, which helps improve prompt quality over time by collecting detailed feedback and automatically detecting success based on user behavior.

## Overview

The prompt success tracking system consists of several components:

1. **Database Schema**: Tables for storing success tracking data, analytics, and monitoring alerts
2. **Backend Services**: APIs for collecting and analyzing success data
3. **Client-Side Utilities**: Tools for tracking user behavior and collecting feedback
4. **Admin UI**: Dashboard for monitoring prompt performance
5. **Grafana Integration**: Real-time monitoring of prompt success metrics

## Database Schema

The system uses the following tables:

- `system_prompt_success_tracking`: Stores individual success tracking records
- `prompt_usage_analytics`: Aggregates daily analytics for each prompt
- `prompt_monitoring_alerts`: Stores alerts for prompts that fall below thresholds
- `prompt_monitoring_settings`: Stores alert settings for each prompt

## Success Tracking Features

### Detailed Feedback Options

The system collects detailed feedback from users:

- **Success/Failure**: Basic indication of whether the prompt was helpful
- **Rating**: Numeric rating from 1-5 stars
- **Categories**: Categorization of feedback (Accuracy, Relevance, Clarity, etc.)
- **Tags**: Specific tags for common issues (Missing Information, Too Technical, etc.)
- **Comments**: Free-form text feedback

### Automatic Success Detection

The system can automatically detect whether a prompt was successful based on user behavior:

- **Time Spent**: How long the user spent on the page after receiving the response
- **Scroll Depth**: How far the user scrolled through the response
- **Clicked Links**: Whether the user clicked on links in the response
- **Copied Text**: Whether the user copied text from the response
- **Follow-up Questions**: Whether the user asked follow-up questions

The system uses a scoring algorithm to determine success:

```typescript
const score = (
  (timeSpentOnPage > 10000 ? 1 : 0) +
  (scrollDepth > 0.5 ? 1 : 0) +
  (clickedLinks > 0 ? 1 : 0) +
  (copiedText ? 1 : 0) +
  (followupQuestions > 0 ? 1 : 0)
);

// If score is 3 or higher, consider it successful
isSuccessful = score >= 3;
```

### Analytics and Monitoring

The system provides analytics and monitoring features:

- **Success Rate**: Percentage of successful prompt uses over time
- **Usage Trends**: Number of prompt uses over time
- **Average Ratings**: Average user ratings for each prompt
- **Response Time**: Average response time for each prompt
- **Feedback Categories**: Distribution of feedback categories
- **Feedback Tags**: Most common feedback tags

### Alerts

The system can generate alerts when prompts fall below certain thresholds:

- **Low Success Rate**: Alert when success rate falls below a threshold
- **Low Rating**: Alert when average rating falls below a threshold
- **High Response Time**: Alert when response time exceeds a threshold
- **High Failure Rate**: Alert when failure rate exceeds a threshold

## Using the Success Tracking System

### Backend Integration

To track prompt success in your backend code:

```typescript
// When rendering a prompt
const { content, trackingId } = await promptService.renderPrompt({
  promptId: 'your-prompt-id',
  data: { /* your data */ },
  trackSuccess: true
});

// Later, update the tracking record with success/failure
await promptService.updatePromptTrackingRecord(
  trackingId,
  {
    isSuccessful: true,
    feedbackRating: 5,
    feedbackCategory: 'Accuracy',
    feedbackTags: ['Helpful', 'Well Explained']
  }
);

// Or use auto-detection
await promptService.autoDetectPromptSuccess(
  trackingId,
  responseTimeMs,
  {
    timeSpentOnPage: 15000,
    scrollDepth: 0.8,
    clickedLinks: 2,
    copiedText: true,
    followupQuestions: 1
  }
);
```

### Client-Side Integration

To track prompt success in your client-side code:

```typescript
// Import the prompt service
import { promptService } from '../services/promptService';

// Render a prompt
const { content, trackingId } = await promptService.renderPrompt({
  promptId: 'your-prompt-id',
  data: { /* your data */ },
  trackSuccess: true
});

// Later, submit feedback
await promptService.submitFeedback(
  trackingId,
  true, // isSuccessful
  'Great response!', // feedback
  5, // rating
  'Accuracy', // category
  ['Helpful', 'Well Explained'] // tags
);

// Or use auto-detection
await promptService.autoDetectSuccess(trackingId);
```

### Using the Feedback Component

To add a feedback component to your UI:

```tsx
import PromptFeedback from '../components/feedback/PromptFeedback';

// In your component
return (
  <div>
    <p>AI Response: {aiResponse}</p>
    <PromptFeedback
      trackingId={trackingId}
      onFeedbackSubmitted={(isSuccessful) => {
        console.log('Feedback submitted:', isSuccessful);
      }}
    />
  </div>
);
```

For a compact version:

```tsx
<PromptFeedback
  trackingId={trackingId}
  compact={true}
/>
```

## Monitoring Dashboard

The system includes a monitoring dashboard in the admin UI:

1. Navigate to "Prompt Monitoring" in the admin sidebar
2. View active alerts, success rates, and analytics
3. Configure alert settings for each prompt

## Grafana Integration

The system integrates with Grafana for real-time monitoring:

1. Navigate to "Grafana Dashboards" in the admin sidebar
2. Select the "Prompt Monitoring Dashboard"
3. View real-time metrics for prompt success

The Grafana dashboard includes:

- Success rate over time
- Usage trends
- Average ratings
- Response time trends
- Active alerts
- Feedback categories and tags

## Best Practices

1. **Collect Feedback Consistently**: Add feedback components to all AI responses
2. **Use Auto-Detection**: Enable auto-detection for all prompts to collect passive feedback
3. **Monitor Alerts**: Regularly check for alerts and address issues promptly
4. **Analyze Trends**: Use the analytics to identify trends and improve prompts
5. **A/B Test Prompts**: Create multiple versions of prompts and compare success rates
6. **Set Appropriate Thresholds**: Configure alert thresholds based on your requirements
7. **Review Feedback**: Regularly review user feedback to improve prompts

## Troubleshooting

- **Missing Tracking Data**: Ensure tracking IDs are being generated and passed correctly
- **Auto-Detection Not Working**: Check that event listeners are being attached correctly
- **Alerts Not Triggering**: Verify that alert settings are configured correctly
- **Analytics Not Updating**: Check that the analytics aggregation function is running

## Conclusion

The enhanced prompt success tracking system provides valuable insights into prompt performance and helps improve prompt quality over time. By collecting detailed feedback and automatically detecting success based on user behavior, you can continuously optimize your AI interactions.
