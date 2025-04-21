# Model Improvement System

This document provides an overview of the Model Improvement System, which uses collected response quality data to continuously improve model performance through fine-tuning, error pattern analysis, and improvement suggestions.

## Table of Contents

1. [Overview](#overview)
2. [System Components](#system-components)
3. [Setup and Configuration](#setup-and-configuration)
4. [Usage](#usage)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)

## Overview

The Model Improvement System is designed to continuously improve model performance by:

1. **Collecting User Feedback**: Gathering real user feedback on model responses
2. **Analyzing Error Patterns**: Identifying common error types and trends
3. **Fine-tuning Models**: Automatically fine-tuning models based on feedback
4. **Generating Improvement Suggestions**: Providing actionable suggestions for model improvements

The system is fully integrated with the existing application infrastructure, including the MCP server, credit system, and database.

## System Components

### 1. Feedback Collection

- **ResponseFeedback Component**: UI component for collecting user feedback
- **ResponseMessage Component**: Integration with chat UI
- **Response Quality Service**: Client-side service for sending feedback to the server

### 2. Error Pattern Analysis

- **Error Pattern Analysis Service**: Server-side service for analyzing error patterns
- **Error Trend Analysis**: Tracking error trends over time
- **Improvement Suggestion Generation**: Generating actionable suggestions for model improvements

### 3. Model Fine-tuning

- **Feedback-Based Training Service**: Server-side service for fine-tuning models based on feedback
- **Fine-tuning Job Management**: Creating, starting, and monitoring fine-tuning jobs
- **Dataset Preparation**: Automatically preparing datasets from problematic responses

### 4. API Integration

- **Response Quality API**: Endpoints for recording and retrieving feedback
- **Model Improvement API**: Endpoints for fine-tuning and error pattern analysis
- **MCP Integration**: Integration with the MCP server for model fine-tuning

## Setup and Configuration

### Prerequisites

- Supabase database
- MCP server with fine-tuning capabilities
- Credit system integration

### Database Setup

Run the database migrations to create the required tables:

```bash
# From the project root
cd packages/server
yarn run-script run-migrations
```

### MCP Server Configuration

Ensure the MCP server supports the required endpoints:

```bash
# From the project root
cd packages/server
yarn run-script check-mcp-endpoints
```

### MCP Server Integration

Ensure the MCP server is properly configured for model fine-tuning:

1. Add the `MODEL_TRAINING` service key to the MCP service keys
2. Implement the required fine-tuning endpoints in the MCP server

### Feedback Collection Integration

Integrate the feedback collection components with your chat UI:

```tsx
import ResponseMessage from '../components/chat/ResponseMessage';

// In your chat component
<ResponseMessage
  responseId="response-id"
  modelId="model-id"
  query="User query"
  response="Model response"
  timestamp={new Date()}
  feedbackVariant="thumbs" // or "stars" or "full"
/>
```

### Verification

Run the integration check script to verify that everything is properly set up:

```bash
# From the project root
cd packages/server
yarn run-script check-model-improvement-integration
```

## Usage

### Collecting Feedback

Feedback is collected automatically when users interact with the ResponseFeedback component. The feedback is stored in the database and used for error pattern analysis and model fine-tuning.

### Analyzing Error Patterns

Error patterns are analyzed automatically by the scheduled job that runs every Monday at 3:00 AM. You can also manually trigger the analysis:

```bash
# From the project root
cd packages/server
yarn run-script analyze-error-patterns
```

### Fine-tuning Models

Models are automatically fine-tuned when they meet the criteria defined in the fine-tuning trigger conditions. You can also manually trigger fine-tuning:

```bash
# From the project root
cd packages/server
yarn run-script fine-tune-model --model-id=<model-id>
```

### Viewing Results

You can view the results of the model improvement system in the admin panel:

1. **Response Quality Panel**: Shows quality metrics, error patterns, and problematic responses
2. **Fine-tuning Jobs Panel**: Shows fine-tuning jobs and their status
3. **Improvement Suggestions Panel**: Shows improvement suggestions for error patterns

## API Reference

### Response Quality API

- `GET /api/analytics/response-quality/metrics`: Get response quality metrics
- `GET /api/analytics/response-quality/problematic`: Get problematic responses
- `POST /api/analytics/response-quality/feedback`: Record response feedback
- `POST /api/analytics/response-quality/response`: Record model response with feedback

### Model Improvement API

- `GET /api/analytics/model-improvement/fine-tuning/jobs`: Get fine-tuning jobs
- `GET /api/analytics/model-improvement/fine-tuning/jobs/:jobId`: Get fine-tuning job by ID
- `POST /api/analytics/model-improvement/fine-tuning/check`: Check if a model should be fine-tuned
- `POST /api/analytics/model-improvement/fine-tuning/jobs`: Create a fine-tuning job
- `POST /api/analytics/model-improvement/fine-tuning/jobs/:jobId/start`: Start a fine-tuning job
- `POST /api/analytics/model-improvement/fine-tuning/jobs/:jobId/cancel`: Cancel a fine-tuning job
- `GET /api/analytics/model-improvement/error-patterns`: Analyze error patterns
- `GET /api/analytics/model-improvement/error-trends`: Get error trends
- `POST /api/analytics/model-improvement/improvement-suggestions`: Generate improvement suggestions

## Troubleshooting

### Database Issues

If you encounter database issues, run the database check script:

```bash
# From the project root
cd packages/server
yarn run-script check-db-tables
```

If tables are missing, run the migrations:

```bash
# From the project root
cd packages/server
yarn run-script run-migrations
```

### MCP Server Issues

If you encounter MCP server issues, check if the required endpoints are supported:

```bash
# From the project root
cd packages/server
yarn run-script check-mcp-endpoints
```

If endpoints are missing, update the MCP server to support the required endpoints.

### Credit System Issues

If you encounter credit system issues, check if the credit system is properly integrated:

```bash
# From the project root
cd packages/server
yarn run-script check-credit-integration
```

If there are issues, update the credit system configuration.

### Feedback Collection Issues

If you encounter feedback collection issues, check if the feedback components are properly integrated:

```bash
# From the project root
cd packages/server
yarn run-script check-feedback-integration
```

If there are issues, update the feedback component integration.
