# MCP Integration for Medium-Priority APIs

This document describes the integration of medium-priority APIs with the Model Control Panel (MCP) middleware, including content processing, analytics, and search services.

## Overview

Building on the high-priority API integration, this phase extends the MCP middleware to handle medium-priority services that benefit from centralized management, credit tracking, and unified interfaces.

## Implementation Status

✅ **Completed**
- PDF Processing and OCR Services
- Analytics Services
- Search Services

🔄 **In Progress**
- Additional Content Processing Services
- Enhanced Analytics Features
- Advanced Search Capabilities

### Medium-Priority APIs Integrated with MCP

1. **Content Processing APIs**
   - PDF Processing and Text Extraction
   - OCR (Optical Character Recognition)
   - Image Recognition and Analysis
   - Data Extraction Services

2. **Analytics and Telemetry Services**
   - Usage Tracking APIs
   - Performance Monitoring Services

3. **Search Services**
   - External Search APIs
   - Specialized Search Engines

## Architecture

The MCP integration for medium-priority APIs follows the same client-server architecture as the high-priority integration:

1. **MCP Client** (`@kai/mcp-client`)
   - Extended with new methods for medium-priority services
   - Maintains consistent interface patterns across all service types

2. **MCP Client Service** (`mcpClientService.ts`)
   - Enhanced with service-specific methods for medium-priority APIs
   - Includes credit tracking for all operations
   - Provides fallback mechanisms to direct implementations

3. **Service Integration**
   - PDF and OCR services updated to use MCP when available
   - Analytics services enhanced with MCP integration
   - Search services configured to use MCP for external operations

## Credit System Integration

The credit system integration for medium-priority APIs follows the same pattern as high-priority APIs:

1. **Credit Checking**
   - Before making an API call, the system checks if the user has enough credits
   - Different operations have different credit costs

2. **Credit Usage Tracking**
   - After a successful API call, the system tracks the credit usage
   - Usage data includes operation-specific metrics

3. **Service Keys**
   - Each service has a unique key for credit tracking
   - Keys follow the format: `category.service` (e.g., `content.pdf-processing`)

## Implementation Details

### PDF Processing Integration

The PDF processing service has been enhanced to use MCP for PDF parsing, text extraction, and OCR operations:

```typescript
// Check if MCP is available and user ID is provided
const mcpAvailable = await isMCPAvailable();

if (mcpAvailable && userId) {
  try {
    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.PDF_PROCESSING,
      5 // Estimate 5 credits for PDF processing
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    // Use MCP for PDF processing
    const mcpResult = await mcpClientService.processPdf(
      userId,
      filePath,
      {
        extractImages: processingOptions.extractImages,
        extractText: processingOptions.extractText,
        associateTextWithImages: processingOptions.associateTextWithImages,
        outputDir: tempDir
      }
    );

    // Track credit usage
    await creditService.useServiceCredits(
      userId,
      MCPServiceKey.PDF_PROCESSING,
      5,
      'PDF processing',
      {
        catalogId,
        fileName: path.basename(filePath),
        pageCount: mcpResult.totalPages
      }
    );

    // Return results
    return {
      catalogId,
      totalPages: mcpResult.totalPages,
      processedPages: mcpResult.processedPages,
      materials: mcpResult.materials || [],
      errors: mcpResult.errors || []
    };
  } catch (mcpError) {
    // Handle errors and fallback to direct implementation
  }
}
```

### OCR Service Integration

The OCR service has been enhanced to use MCP for image text extraction:

```typescript
// Check if MCP is available and user ID is provided
const mcpAvailable = await isMCPAvailable();

if (mcpAvailable && userId) {
  try {
    // Check if user has enough credits
    const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
      userId,
      MCPServiceKey.OCR_PROCESSING,
      1 // 1 credit per image
    );

    if (!hasEnoughCredits) {
      throw new Error('Insufficient credits');
    }

    // Use MCP for OCR processing
    const mcpResult = await mcpClientService.performOcr(
      userId,
      imagePath,
      {
        language: options.language,
        ocrEngine: options.ocrEngine,
        preprocess: options.preprocess
      }
    );

    return {
      text: mcpResult.text,
      confidence: mcpResult.confidence
    };
  } catch (mcpError) {
    // Handle errors and fallback to direct implementation
  }
}
```

### Batch Processing

For batch operations, the system checks credit availability for the entire batch before processing:

```typescript
// Check if user has enough credits for all images
const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
  userId,
  MCPServiceKey.OCR_PROCESSING,
  imagePaths.length // 1 credit per image
);

if (!hasEnoughCredits) {
  throw new Error('Insufficient credits');
}

// Process images in batches
for (let i = 0; i < imagePaths.length; i += concurrency) {
  const batch = imagePaths.slice(i, i + concurrency);
  const batchPromises = batch.map(imagePath =>
    mcpClientService.performOcr(userId, imagePath, options)
      .then(mcpResult => {
        // Process result

        // Track credit usage for each image
        return creditService.useServiceCredits(
          userId,
          MCPServiceKey.OCR_PROCESSING,
          1,
          `${MCPServiceKey.OCR_PROCESSING} API usage`,
          {
            endpoint: 'content/ocr',
            imagePath
          }
        );
      })
  );

  await Promise.all(batchPromises);
}
```

## Service-Specific Details

### Content Processing APIs

- **PDF Processing**: Uses the `content/process-pdf` endpoint
  - Credit cost: 5 credits per PDF
  - Handles PDF parsing, text extraction, and image extraction
  - Supports associating text with images

- **OCR Processing**: Uses the `content/ocr` endpoint
  - Credit cost: 1 credit per image
  - Supports multiple OCR engines and languages
  - Includes preprocessing options for better results

### Analytics and Telemetry Services

- **Analytics Event Processing**: Uses the `analytics/event` endpoint
  - Credit cost: 1 credit per event
  - Handles event tracking and storage
  - Supports various event types (search, view, agent_prompt, etc.)

- **Analytics Querying**: Uses the `analytics/query` endpoint
  - Credit cost: 1 credit per query
  - Retrieves analytics events with filtering and pagination
  - Supports sorting and complex filtering

- **Analytics Trends**: Uses the `analytics/trends` endpoint
  - Credit cost: 2 credits per trends query
  - Generates time-based trend analysis
  - Supports different timeframes (day, week, month)

- **Analytics Statistics**: Uses the `analytics/stats` endpoint
  - Credit cost: 2 credits per stats query
  - Provides aggregated statistics across different dimensions
  - Includes counts, averages, and distributions

### Search Services

- **Vector Search**: Uses the `vector/search` endpoint
  - Credit cost: 1 credit per search
  - Performs semantic search across vector databases
  - Supports filtering and ranking options

- **External Search**: Uses the `search/external` endpoint
  - Credit cost: 2 credits per search
  - Integrates with external search engines
  - Normalizes results across different providers

## Error Handling and Fallbacks

All MCP integrations include robust error handling and fallback mechanisms:

1. **Credit Insufficiency**
   - When a user doesn't have enough credits, the system returns a 402 (Payment Required) error
   - The error includes a clear message about purchasing more credits

2. **MCP Unavailability**
   - When the MCP server is unavailable, the system falls back to direct implementations
   - Logs are generated to track fallback occurrences

3. **Service-Specific Errors**
   - Each service handles specific error cases appropriately
   - Detailed error information is logged for debugging

## Future Enhancements

1. **Additional Content Processing Services**
   - Add support for video processing and analysis
   - Implement document comparison and diff generation
   - Integrate with more specialized OCR engines

2. **Enhanced Analytics**
   - Implement real-time analytics processing
   - Add support for custom analytics pipelines
   - Develop predictive analytics capabilities

3. **Advanced Search Features**
   - Implement multi-modal search (text + image)
   - Add support for conversational search
   - Develop domain-specific search optimizations
