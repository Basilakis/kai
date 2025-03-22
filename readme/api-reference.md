# API Reference

This document provides a comprehensive reference for the Kai system API endpoints. The API follows RESTful principles and uses JSON for data exchange.

## Base URL

- Development: `http://localhost:3000/api/v1`
- Production: `https://api.kai-system.com/api/v1`

## Authentication

Most API endpoints require authentication. The API uses JWT (JSON Web Tokens) for authentication.

### Authentication Headers

```
Authorization: Bearer <token>
```

### Obtaining a Token

```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

### Refreshing a Token

```
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Error Handling

All API endpoints follow a consistent error format:

```json
{
  "error": true,
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    // Additional error details if available
  }
}
```

Common error codes:

- `AUTHENTICATION_REQUIRED`: Authentication is required
- `INVALID_CREDENTIALS`: Invalid email or password
- `INSUFFICIENT_PERMISSIONS`: User doesn't have required permissions
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `VALIDATION_ERROR`: Request validation failed
- `INTERNAL_ERROR`: Internal server error

## Rate Limiting

API requests are rate-limited to prevent abuse. The current limits are:

- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

Rate limit information is included in the response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1619431320
```

## API Endpoints

### Material Recognition

#### Recognize Material

```
POST /recognition/recognize
```

Recognizes a material from an uploaded image.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `image`: Image file (required)
  - `modelType`: Recognition model type (optional, default: "hybrid")
  - `confidenceThreshold`: Minimum confidence threshold (optional, default: 0.6)
  - `maxResults`: Maximum number of results (optional, default: 5)
  - `includeSimilar`: Whether to include similar materials (optional, default: true)

**Response:**
```json
{
  "matches": [
    {
      "materialId": "material-123",
      "name": "Ceramic Tile Alpha",
      "confidence": 0.95,
      "materialType": "tile",
      "manufacturer": "Example Tiles Inc.",
      "thumbnailUrl": "https://assets.kai-system.com/thumbnails/material-123.jpg"
    },
    {
      "materialId": "material-456",
      "name": "Ceramic Tile Beta",
      "confidence": 0.82,
      "materialType": "tile",
      "manufacturer": "Example Tiles Inc.",
      "thumbnailUrl": "https://assets.kai-system.com/thumbnails/material-456.jpg"
    }
  ],
  "metadata": {
    "processingTimeMs": 1245,
    "modelType": "hybrid",
    "confidenceThreshold": 0.6,
    "sourceImageHash": "a1b2c3d4e5f6..."
  }
}
```

#### Find Similar Materials

```
POST /recognition/similar
```

Finds materials similar to a given material ID or uploaded image.

**Request:**
- Content-Type: `multipart/form-data` or `application/json`
- Body (with image):
  - `image`: Image file (required if no materialId)
  - `numResults`: Maximum number of results (optional, default: 10)
  - `threshold`: Minimum similarity threshold (optional, default: 0.7)
  - `materialType`: Filter by material type (optional)
- Body (with materialId):
  ```json
  {
    "materialId": "material-123",
    "numResults": 10,
    "threshold": 0.7,
    "materialType": "tile"
  }
  ```

**Response:**
```json
{
  "results": [
    {
      "materialId": "material-456",
      "name": "Ceramic Tile Beta",
      "similarity": 0.95,
      "materialType": "tile",
      "manufacturer": "Example Tiles Inc.",
      "thumbnailUrl": "https://assets.kai-system.com/thumbnails/material-456.jpg"
    },
    {
      "materialId": "material-789",
      "name": "Ceramic Tile Gamma",
      "similarity": 0.82,
      "materialType": "tile",
      "manufacturer": "Example Tiles Inc.",
      "thumbnailUrl": "https://assets.kai-system.com/thumbnails/material-789.jpg"
    }
  ],
  "metadata": {
    "processingTimeMs": 876,
    "sourceMaterialId": "material-123",
    "threshold": 0.7
  }
}
```

### Knowledge Base

#### Search Materials

```
GET /materials/search
```

Searches for materials based on various criteria.

**Query Parameters:**
- `query`: Search query (optional)
- `materialType`: Material type(s) (optional)
- `tags`: Tags to filter by (optional, comma-separated)
- `collection`: Collection ID (optional)
- `manufacturer`: Manufacturer (optional)
- `limit`: Results per page (optional, default: 20)
- `skip`: Results to skip (pagination) (optional, default: 0)
- `sort`: Field to sort by (optional, default: "relevance")
- `order`: Sort order (optional, "asc" or "desc", default: "desc")
- `vectorSearch`: Use vector search (optional, "true" or "false", default: "false")
- `strategy`: Search strategy (optional, "text", "vector", "metadata", or "combined", default: "text")

**Response:**
```json
{
  "materials": [
    {
      "id": "material-123",
      "name": "Ceramic Tile Alpha",
      "description": "A high-quality ceramic tile for indoor use",
      "materialType": "tile",
      "manufacturer": "Example Tiles Inc.",
      "collectionId": "collection-abc",
      "collectionName": "Premium Collection",
      "color": {
        "name": "Beige",
        "hex": "#F5F5DC"
      },
      "dimensions": {
        "length": 300,
        "width": 300,
        "height": 10,
        "unit": "mm"
      },
      "tags": ["ceramic", "indoor", "premium"],
      "thumbnailUrl": "https://assets.kai-system.com/thumbnails/material-123.jpg",
      "createdAt": "2023-01-15T12:00:00Z",
      "updatedAt": "2023-02-20T09:30:00Z"
    },
    // Additional materials...
  ],
  "total": 127,
  "limit": 20,
  "skip": 0,
  "facets": {
    "materialTypes": [
      { "_id": "tile", "count": 85 },
      { "_id": "stone", "count": 25 },
      { "_id": "wood", "count": 17 }
    ],
    "manufacturers": [
      { "_id": "Example Tiles Inc.", "count": 50 },
      { "_id": "Stone Masters", "count": 25 },
      { "_id": "Wood Experts", "count": 17 }
    ],
    "colors": [
      { "_id": "Beige", "count": 30 },
      { "_id": "White", "count": 25 },
      { "_id": "Gray", "count": 20 }
    ],
    "tags": [
      { "_id": "indoor", "count": 70 },
      { "_id": "outdoor", "count": 57 },
      { "_id": "premium", "count": 45 }
    ]
  }
}
```

#### Get Material Details

```
GET /materials/:materialId
```

Retrieves detailed information about a specific material.

**URL Parameters:**
- `materialId`: ID of the material to retrieve

**Query Parameters:**
- `includeVersions`: Include version history (optional, "true" or "false", default: "false")
- `includeRelationships`: Include relationships (optional, "true" or "false", default: "false")

**Response:**
```json
{
  "id": "material-123",
  "name": "Ceramic Tile Alpha",
  "description": "A high-quality ceramic tile for indoor use",
  "materialType": "tile",
  "manufacturer": "Example Tiles Inc.",
  "collectionId": "collection-abc",
  "collectionName": "Premium Collection",
  "color": {
    "name": "Beige",
    "hex": "#F5F5DC",
    "rgb": [245, 245, 220]
  },
  "dimensions": {
    "length": 300,
    "width": 300,
    "height": 10,
    "unit": "mm"
  },
  "weight": 2.5,
  "finish": "Matte",
  "price": {
    "value": 45.99,
    "currency": "USD",
    "unit": "sqm"
  },
  "technicalProps": {
    "waterAbsorption": "< 0.5%",
    "slipResistance": "R9",
    "frostResistant": true,
    "peiRating": 4
  },
  "applications": ["floor", "wall", "indoor"],
  "tags": ["ceramic", "indoor", "premium", "beige"],
  "images": [
    {
      "url": "https://assets.kai-system.com/images/material-123-primary.jpg",
      "type": "primary",
      "alt": "Ceramic Tile Alpha - Primary View"
    },
    {
      "url": "https://assets.kai-system.com/images/material-123-secondary.jpg",
      "type": "secondary",
      "alt": "Ceramic Tile Alpha - Secondary View"
    },
    {
      "url": "https://assets.kai-system.com/images/material-123-texture.jpg",
      "type": "texture",
      "alt": "Ceramic Tile Alpha - Texture Detail"
    }
  ],
  "relationships": [
    {
      "id": "relationship-xyz",
      "targetMaterialId": "material-456",
      "targetMaterialName": "Ceramic Tile Beta",
      "relationshipType": "complementary",
      "strength": 0.85,
      "thumbnailUrl": "https://assets.kai-system.com/thumbnails/material-456.jpg"
    }
  ],
  "versions": [
    {
      "versionId": "version-123",
      "createdAt": "2023-02-20T09:30:00Z",
      "createdBy": "user-abc",
      "createdByName": "Admin User",
      "changeDescription": "Updated technical properties"
    },
    {
      "versionId": "version-456",
      "createdAt": "2023-01-15T12:00:00Z",
      "createdBy": "user-abc",
      "createdByName": "Admin User",
      "changeDescription": "Initial version"
    }
  ],
  "metadata": {
    "catalogId": "catalog-123",
    "catalogName": "Spring 2023 Catalog",
    "catalogPage": 42,
    "productCode": "CT-ALPHA-300",
    "lastImportDate": "2023-01-15T12:00:00Z",
    "importSource": "pdf"
  },
  "createdAt": "2023-01-15T12:00:00Z",
  "updatedAt": "2023-02-20T09:30:00Z",
  "createdBy": "user-abc",
  "createdByName": "Admin User"
}
```

#### Create Material

```
POST /materials
```

Creates a new material in the knowledge base.

**Request Body:**
```json
{
  "name": "Ceramic Tile Alpha",
  "description": "A high-quality ceramic tile for indoor use",
  "materialType": "tile",
  "manufacturer": "Example Tiles Inc.",
  "collectionId": "collection-abc",
  "color": {
    "name": "Beige",
    "hex": "#F5F5DC"
  },
  "dimensions": {
    "length": 300,
    "width": 300,
    "height": 10,
    "unit": "mm"
  },
  "weight": 2.5,
  "finish": "Matte",
  "price": {
    "value": 45.99,
    "currency": "USD",
    "unit": "sqm"
  },
  "technicalProps": {
    "waterAbsorption": "< 0.5%",
    "slipResistance": "R9",
    "frostResistant": true,
    "peiRating": 4
  },
  "applications": ["floor", "wall", "indoor"],
  "tags": ["ceramic", "indoor", "premium", "beige"]
}
```

**Response:**
```json
{
  "id": "material-123",
  "name": "Ceramic Tile Alpha",
  // All fields included in request plus:
  "createdAt": "2023-03-15T14:30:00Z",
  "updatedAt": "2023-03-15T14:30:00Z",
  "createdBy": "user-abc"
}
```

#### Update Material

```
PUT /materials/:materialId
```

Updates an existing material in the knowledge base.

**URL Parameters:**
- `materialId`: ID of the material to update

**Request Body:**
```json
{
  "name": "Ceramic Tile Alpha - Premium",
  "description": "Updated description",
  "technicalProps": {
    "waterAbsorption": "< 0.3%",
    "slipResistance": "R10",
    "frostResistant": true,
    "peiRating": 5
  },
  "tags": ["ceramic", "indoor", "premium", "beige", "updated"],
  "metadata": {
    "changeDescription": "Updated technical specifications"
  }
}
```

**Response:**
```json
{
  "id": "material-123",
  "name": "Ceramic Tile Alpha - Premium",
  // All fields with updated values
  "updatedAt": "2023-03-20T10:15:00Z"
}
```

#### Delete Material

```
DELETE /materials/:materialId
```

Deletes a material from the knowledge base.

**URL Parameters:**
- `materialId`: ID of the material to delete

**Response:**
```json
{
  "success": true,
  "message": "Material deleted successfully"
}
```

#### Get Collections

```
GET /collections
```

Retrieves a list of collections.

**Query Parameters:**
- `parentId`: Parent collection ID (optional)
- `includeEmpty`: Include collections with no materials (optional, "true" or "false", default: "false")
- `limit`: Results per page (optional, default: 20)
- `skip`: Results to skip (pagination) (optional, default: 0)
- `sort`: Field to sort by (optional, default: "name")
- `order`: Sort order (optional, "asc" or "desc", default: "asc")

**Response:**
```json
{
  "collections": [
    {
      "id": "collection-abc",
      "name": "Premium Collection",
      "description": "Our premium line of ceramic tiles",
      "manufacturer": "Example Tiles Inc.",
      "parentId": null,
      "materialCount": 25,
      "thumbnailUrl": "https://assets.kai-system.com/thumbnails/collection-abc.jpg",
      "createdAt": "2022-12-10T09:00:00Z",
      "updatedAt": "2023-02-15T11:30:00Z"
    },
    // Additional collections...
  ],
  "total": 15,
  "limit": 20,
  "skip": 0
}
```

### PDF Processing

#### Upload Catalog

```
POST /pdf/upload
```

Uploads a PDF catalog for processing.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: PDF file (required)
  - `name`: Catalog name (required)
  - `manufacturer`: Manufacturer name (optional)
  - `collectionId`: Collection ID to associate materials with (optional)
  - `options`: JSON string of processing options (optional)

**Response:**
```json
{
  "jobId": "pdf-job-123",
  "status": "queued",
  "fileName": "example-catalog.pdf",
  "fileSize": 15482625,
  "pageCount": 48,
  "options": {
    "extractImages": true,
    "extractText": true,
    "enhanceResolution": true,
    "associateTextWithImages": true,
    "extractStructuredData": true
  },
  "queuePosition": 3,
  "estimatedStartTime": "2023-03-20T10:30:00Z",
  "submittedAt": "2023-03-20T10:15:00Z"
}
```

#### Get Processing Status

```
GET /pdf/jobs/:jobId
```

Gets the status of a PDF processing job.

**URL Parameters:**
- `jobId`: ID of the processing job

**Response:**
```json
{
  "jobId": "pdf-job-123",
  "status": "processing",
  "progress": {
    "currentPage": 15,
    "totalPages": 48,
    "percentComplete": 31,
    "currentStage": "extracting_images",
    "stageProgress": 65,
    "elapsedTime": 180,
    "estimatedTimeRemaining": 400
  },
  "statistics": {
    "imagesExtracted": 87,
    "textRegionsExtracted": 142,
    "tablesDetected": 12,
    "materialsIdentified": 25
  },
  "startedAt": "2023-03-20T10:32:00Z",
  "lastUpdatedAt": "2023-03-20T10:35:00Z"
}
```

#### Get Processing Results

```
GET /pdf/jobs/:jobId/results
```

Gets the results of a completed PDF processing job.

**URL Parameters:**
- `jobId`: ID of the processing job

**Query Parameters:**
- `includeMaterials`: Include extracted materials (optional, "true" or "false", default: "true")
- `includeImages`: Include extracted images (optional, "true" or "false", default: "false")
- `includeText`: Include extracted text (optional, "true" or "false", default: "false")

**Response:**
```json
{
  "jobId": "pdf-job-123",
  "status": "completed",
  "fileName": "example-catalog.pdf",
  "fileSize": 15482625,
  "pageCount": 48,
  "statistics": {
    "processingTimeMs": 2541875,
    "imagesExtracted": 236,
    "textRegionsExtracted": 412,
    "tablesDetected": 32,
    "materialsIdentified": 78,
    "materialsImported": 78,
    "associations": 215
  },
  "materials": [
    {
      "id": "material-123",
      "name": "Ceramic Tile Alpha",
      "materialType": "tile",
      "productCode": "CT-ALPHA-300",
      "pageNumber": 12,
      "confidence": 0.95,
      "thumbnailUrl": "https://assets.kai-system.com/thumbnails/material-123.jpg"
    },
    // Additional materials...
  ],
  "images": [
    {
      "id": "image-123",
      "url": "https://assets.kai-system.com/images/pdf-job-123/image-123.jpg",
      "pageNumber": 12,
      "bbox": [100, 200, 500, 600],
      "materialId": "material-123",
      "type": "product",
      "confidence": 0.98
    },
    // Additional images...
  ],
  "textRegions": [
    {
      "id": "text-123",
      "content": "Ceramic Tile Alpha\nProduct Code: CT-ALPHA-300\nDimensions: 300x300x10mm",
      "pageNumber": 12,
      "bbox": [600, 200, 300, 150],
      "materialId": "material-123",
      "type": "product_description",
      "confidence": 0.92
    },
    // Additional text regions...
  ],
  "completedAt": "2023-03-20T11:15:00Z"
}
```

### Queue Management

#### Get Queue Status

```
GET /admin/queues
```

Gets the status of all processing queues.

**Response:**
```json
{
  "queues": [
    {
      "queueId": "pdf",
      "name": "PDF Processing Queue",
      "status": "active",
      "jobCount": {
        "waiting": 3,
        "processing": 2,
        "completed": 156,
        "failed": 12
      },
      "throughput": {
        "last1h": 5,
        "last24h": 87,
        "last7d": 412
      },
      "averageProcessingTime": 1245.5,
      "oldestJob": "2023-03-19T14:30:00Z"
    },
    {
      "queueId": "crawler",
      "name": "Web Crawler Queue",
      "status": "active",
      "jobCount": {
        "waiting": 1,
        "processing": 3,
        "completed": 87,
        "failed": 5
      },
      "throughput": {
        "last1h": 2,
        "last24h": 45,
        "last7d": 211
      },
      "averageProcessingTime": 2187.3,
      "oldestJob": "2023-03-20T08:15:00Z"
    }
  ]
}
```

#### Get Queue Jobs

```
GET /admin/queues/:queueId/jobs
```

Gets the jobs in a specific queue.

**URL Parameters:**
- `queueId`: ID of the queue

**Query Parameters:**
- `status`: Job status filter (optional, "waiting", "processing", "completed", "failed", or "all", default: "all")
- `limit`: Results per page (optional, default: 20)
- `skip`: Results to skip (pagination) (optional, default: 0)
- `sort`: Field to sort by (optional, default: "submittedAt")
- `order`: Sort order (optional, "asc" or "desc", default: "desc")

**Response:**
```json
{
  "jobs": [
    {
      "jobId": "pdf-job-123",
      "queueId": "pdf",
      "status": "processing",
      "priority": 5,
      "progress": 31,
      "data": {
        "fileName": "example-catalog.pdf",
        "fileSize": 15482625,
        "pageCount": 48
      },
      "submittedAt": "2023-03-20T10:15:00Z",
      "startedAt": "2023-03-20T10:32:00Z",
      "submittedBy": "user-abc",
      "submittedByName": "Admin User"
    },
    // Additional jobs...
  ],
  "total": 173,
  "limit": 20,
  "skip": 0
}
```

#### Get Job Details

```
GET /admin/queues/:queueId/jobs/:jobId
```

Gets detailed information about a specific job.

**URL Parameters:**
- `queueId`: ID of the queue
- `jobId`: ID of the job

**Response:**
```json
{
  "jobId": "pdf-job-123",
  "queueId": "pdf",
  "status": "processing",
  "priority": 5,
  "progress": {
    "currentPage": 15,
    "totalPages": 48,
    "percentComplete": 31,
    "currentStage": "extracting_images",
    "stageProgress": 65,
    "elapsedTime": 180,
    "estimatedTimeRemaining": 400
  },
  "data": {
    "fileName": "example-catalog.pdf",
    "fileSize": 15482625,
    "pageCount": 48,
    "options": {
      "extractImages": true,
      "extractText": true,
      "enhanceResolution": true,
      "associateTextWithImages": true,
      "extractStructuredData": true
    }
  },
  "statistics": {
    "imagesExtracted": 87,
    "textRegionsExtracted": 142,
    "tablesDetected": 12,
    "materialsIdentified": 25
  },
  "logs": [
    {
      "timestamp": "2023-03-20T10:32:00Z",
      "level": "info",
      "message": "Started processing job pdf-job-123"
    },
    {
      "timestamp": "2023-03-20T10:32:05Z",
      "level": "info",
      "message": "PDF validated, 48 pages detected"
    },
    {
      "timestamp": "2023-03-20T10:32:10Z",
      "level": "info",
      "message": "Started image extraction"
    },
    // Additional logs...
  ],
  "submittedAt": "2023-03-20T10:15:00Z",
  "startedAt": "2023-03-20T10:32:00Z",
  "lastUpdatedAt": "2023-03-20T10:35:00Z",
  "submittedBy": "user-abc",
  "submittedByName": "Admin User"
}
```

#### Cancel Job

```
POST /admin/queues/:queueId/jobs/:jobId/cancel
```

Cancels a job in the queue.

**URL Parameters:**
- `queueId`: ID of the queue
- `jobId`: ID of the job

**Response:**
```json
{
  "success": true,
  "message": "Job canceled successfully",
  "jobId": "pdf-job-123",
  "queueId": "pdf",
  "previousStatus": "processing",
  "currentStatus": "canceled",
  "canceledAt": "2023-03-20T10:40:00Z",
  "canceledBy": "user-xyz"
}
```

### Dataset Management API

#### Generate Synthetic Data

```
POST /api/admin/datasets/:id/synthetic
```

Generates synthetic data to balance or augment a class.

**URL Parameters:**
- `id`: Dataset ID

**Request Body:**
```json
{
  "targetClass": "chair",
  "targetCount": 200,
  "generationMethod": "random",
  "generationParams": {
    "variability": 0.8,
    "quality": 0.7
  }
}
```

**Response:**
```json
{
  "success": true,
  "classId": "class-1",
  "className": "chair",
  "originalCount": 120,
  "generatedCount": 80,
  "newCount": 200,
  "methods": {
    "generationMethod": "random",
    "params": {
      "variability": 0.8,
      "quality": 0.7
    }
  },
  "generatedImages": [
    {
      "id": "synth-1",
      "url": "https://storage.example.com/signed-url/synth_chair_001.jpg"
    },
    // Additional images...
  ]
}
```

#### Setup Incremental Learning Dataset

```
POST /api/admin/datasets/incremental
```

Sets up an incremental learning dataset.

**Request Body:**
```json
{
  "baseDatasetId": "dataset-123",
  "newClasses": [
    {
      "name": "desk",
      "description": "Work desks"
    },
    {
      "name": "lamp",
      "description": "Various types of lamps"
    }
  ],
  "newImagesPerClass": 100,
  "preserveOldClasses": true,
  "rebalance": false
}
```

**Response:**
```json
{
  "success": true,
  "datasetId": "dataset-127",
  "baseDatasetId": "dataset-123",
  "newClasses": [
    {
      "id": "class-16",
      "name": "desk",
      "description": "Work desks",
      "status": "pending"
    },
    {
      "id": "class-17",
      "name": "lamp",
      "description": "Various types of lamps",
      "status": "pending"
    }
  ],
  "preservedClasses": 15,
  "totalClasses": 17,
  "targetImagesPerClass": 100
}
```

#### Delete Dataset

```
DELETE /api/admin/datasets/:id
```

Deletes a dataset.

**URL Parameters:**
- `id`: Dataset ID

**Response:**
```json
{
  "success": true,
  "dataset": {
    "id": "dataset-123",
    "name": "Furniture Dataset",
    "deletedAt": "2023-04-03T10:15:00Z"
  }
}
```

#### Update Dataset

```
PUT /api/admin/datasets/:id
```

Updates a dataset.

**URL Parameters:**
- `id`: Dataset ID

**Request Body:**
```json
{
  "name": "Modern Furniture Dataset",
  "description": "Updated dataset containing modern furniture items",
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "dataset": {
    "id": "dataset-123",
    "name": "Modern Furniture Dataset",
    "description": "Updated dataset containing modern furniture items",
    "status": "active",
    "updatedAt": "2023-04-03T11:00:00Z"
  }
}
```

### Knowledge Base Bulk Operations

#### Bulk Import Materials

```
POST /api/admin/knowledge-base/bulk/materials/import
```

Imports multiple materials at once.

**Request Body:**
```json
{
  "materials": [
    {
      "name": "Ceramic Tile Alpha",
      "description": "A high-quality ceramic tile for indoor use",
      "materialType": "tile",
      "manufacturer": "Example Tiles Inc.",
      "collectionId": "collection-abc"
    },
    {
      "name": "Ceramic Tile Beta",
      "description": "A durable ceramic tile for outdoor use",
      "materialType": "tile",
      "manufacturer": "Example Tiles Inc.",
      "collectionId": "collection-abc"
    }
  ],
  "options": {
    "skipDuplicates": true,
    "updateExisting": false,
    "validateBeforeImport": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "imported": 2,
  "skipped": 0,
  "failed": 0,
  "materials": [
    {
      "id": "material-123",
      "name": "Ceramic Tile Alpha",
      "materialType": "tile",
      "manufacturer": "Example Tiles Inc.",
      "status": "imported"
    },
    {
      "id": "material-124",
      "name": "Ceramic Tile Beta",
      "materialType": "tile",
      "manufacturer": "Example Tiles Inc.",
      "status": "imported"
    }
  ]
}
```

#### Bulk Update Materials

```
POST /api/admin/knowledge-base/bulk/materials/update
```

Updates multiple materials at once.

**Request Body:**
```json
{
  "updates": [
    {
      "id": "material-123",
      "updates": {
        "description": "Updated description for Alpha tile",
        "price": {
          "value": 49.99,
          "currency": "USD",
          "unit": "sqm"
        }
      }
    },
    {
      "id": "material-124",
      "updates": {
        "description": "Updated description for Beta tile",
        "price": {
          "value": 54.99,
          "currency": "USD",
          "unit": "sqm"
        }
      }
    }
  ],
  "options": {
    "createRevision": true,
    "validateBeforeUpdate": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "updated": 2,
  "failed": 0,
  "materials": [
    {
      "id": "material-123",
      "name": "Ceramic Tile Alpha",
      "status": "updated",
      "revisionId": "revision-123"
    },
    {
      "id": "material-124",
      "name": "Ceramic Tile Beta",
      "status": "updated",
      "revisionId": "revision-124"
    }
  ]
}
```

#### Bulk Delete Materials

```
POST /api/admin/knowledge-base/bulk/materials/delete
```

Deletes multiple materials at once.

**Request Body:**
```json
{
  "materialIds": ["material-123", "material-124"],
  "options": {
    "permanentDelete": false,
    "cascade": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "deleted": 2,
  "failed": 0,
  "materials": [
    {
      "id": "material-123",
      "name": "Ceramic Tile Alpha",
      "status": "deleted"
    },
    {
      "id": "material-124",
      "name": "Ceramic Tile Beta",
      "status": "deleted"
    }
  ]
}
```

#### Bulk Export Materials

```
POST /api/admin/knowledge-base/bulk/materials/export
```

Exports multiple materials.

**Request Body:**
```json
{
  "materialIds": ["material-123", "material-124"],
  "format": "json",
  "options": {
    "includeRelationships": true,
    "includeVersions": false,
    "includeImages": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "exportId": "export-123",
  "format": "json",
  "url": "https://assets.kai-system.com/exports/export-123.json",
  "materialsCount": 2,
  "expiresAt": "2023-04-10T12:00:00Z"
}
```

#### Bulk Create Relationships

```
POST /api/admin/knowledge-base/bulk/relationships/create
```

Creates multiple relationships between materials.

**Request Body:**
```json
{
  "relationships": [
    {
      "sourceMaterialId": "material-123",
      "targetMaterialId": "material-124",
      "relationshipType": "complementary",
      "strength": 0.85,
      "metadata": {
        "notes": "These two materials work well together"
      }
    },
    {
      "sourceMaterialId": "material-123",
      "targetMaterialId": "material-125",
      "relationshipType": "alternative",
      "strength": 0.75,
      "metadata": {
        "notes": "Alternative option with similar properties"
      }
    }
  ],
  "options": {
    "bidirectional": true,
    "updateExisting": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "created": 4,
  "updated": 0,
  "failed": 0,
  "relationships": [
    {
      "id": "relationship-123",
      "sourceMaterialId": "material-123",
      "targetMaterialId": "material-124",
      "relationshipType": "complementary",
      "status": "created"
    },
    {
      "id": "relationship-124",
      "sourceMaterialId": "material-124",
      "targetMaterialId": "material-123",
      "relationshipType": "complementary",
      "status": "created"
    },
    {
      "id": "relationship-125",
      "sourceMaterialId": "material-123",
      "targetMaterialId": "material-125",
      "relationshipType": "alternative",
      "status": "created"
    },
    {
      "id": "relationship-126",
      "sourceMaterialId": "material-125",
      "targetMaterialId": "material-123",
      "relationshipType": "alternative",
      "status": "created"
    }
  ]
}
```

#### Material Revision Management

```
POST /api/admin/knowledge-base/materials/:materialId/revisions
```

Creates a new revision of a material.

**URL Parameters:**
- `materialId`: Material ID

**Request Body:**
```json
{
  "changes": {
    "description": "Updated description for ceramic tile",
    "price": {
      "value": 52.99,
      "currency": "USD",
      "unit": "sqm"
    }
  },
  "changeDescription": "Updated description and price",
  "preserveHistory": true
}
```

**Response:**
```json
{
  "success": true,
  "material": {
    "id": "material-123",
    "name": "Ceramic Tile Alpha",
    "description": "Updated description for ceramic tile",
    "price": {
      "value": 52.99,
      "currency": "USD",
      "unit": "sqm"
    },
    "updatedAt": "2023-04-04T09:30:00Z"
  },
  "revision": {
    "id": "revision-127",
    "materialId": "material-123",
    "versionNumber": 3,
    "changeDescription": "Updated description and price",
    "createdBy": "user-abc",
    "createdAt": "2023-04-04T09:30:00Z"
  }
}
```

#### Revert Material Version

```
POST /api/admin/knowledge-base/materials/:materialId/revert/:versionId
```

Reverts a material to a previous version.

**URL Parameters:**
- `materialId`: Material ID
- `versionId`: Version ID to revert to

**Request Body:**
```json
{
  "createNewRevision": true,
  "changeDescription": "Reverted to version from 2023-03-15"
}
```

**Response:**
```json
{
  "success": true,
  "material": {
    "id": "material-123",
    "name": "Ceramic Tile Alpha",
    "description": "A high-quality ceramic tile for indoor use",
    "price": {
      "value": 45.99,
      "currency": "USD",
      "unit": "sqm"
    },
    "updatedAt": "2023-04-04T10:00:00Z"
  },
  "revision": {
    "id": "revision-128",
    "materialId": "material-123",
    "versionNumber": 4,
    "changeDescription": "Reverted to version from 2023-03-15",
    "revertedFromVersion": "revision-125",
    "createdBy": "user-abc",
    "createdAt": "2023-04-04T10:00:00Z"
  }
}
```

#### Get Material Version History

```
GET /api/admin/knowledge-base/materials/:materialId/versions
```

Gets the version history for a material.

**URL Parameters:**
- `materialId`: Material ID

**Response:**
```json
{
  "material": {
    "id": "material-123",
    "name": "Ceramic Tile Alpha",
    "currentVersion": 4
  },
  "versions": [
    {
      "id": "revision-128",
      "versionNumber": 4,
      "changeDescription": "Reverted to version from 2023-03-15",
      "revertedFromVersion": "revision-125",
      "createdBy": "user-abc",
      "createdAt": "2023-04-04T10:00:00Z"
    },
    {
      "id": "revision-127",
      "versionNumber": 3,
      "changeDescription": "Updated description and price",
      "createdBy": "user-abc",
      "createdAt": "2023-04-04T09:30:00Z"
    },
    {
      "id": "revision-126",
      "versionNumber": 2,
      "changeDescription": "Updated technical properties",
      "createdBy": "user-abc",
      "createdAt": "2023-03-20T14:45:00Z"
    },
    {
      "id": "revision-125",
      "versionNumber": 1,
      "changeDescription": "Initial version",
      "createdBy": "user-abc",
      "createdAt": "2023-03-15T11:15:00Z"
    }
  ]
}
```

#### Search Indexes Management

```
POST /api/admin/knowledge-base/search-indexes
```

Creates a new search index.

**Request Body:**
```json
{
  "name": "Material Catalog Index",
  "description": "Full-text and vector search index for materials",
  "indexType": "hybrid",
  "options": {
    "includeFields": ["name", "description", "materialType", "manufacturer", "tags"],
    "vectorizeFields": ["name", "description", "tags"],
    "vectorDimension": 1536,
    "textWeights": {
      "name": 3.0,
      "description": 1.0,
      "tags": 2.0
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "index": {
    "id": "index-123",
    "name": "Material Catalog Index",
    "description": "Full-text and vector search index for materials",
    "indexType": "hybrid",
    "status": "creating",
    "createdAt": "2023-04-04T11:30:00Z"
  }
}
```

#### Get Search Indexes

```
GET /api/admin/knowledge-base/search-indexes
```

Gets a list of search indexes.

**Query Parameters:**
- `status`: Filter by status (optional, "creating", "ready", "updating", "error")

**Response:**
```json
{
  "indexes": [
    {
      "id": "index-123",
      "name": "Material Catalog Index",
      "description": "Full-text and vector search index for materials",
      "indexType": "hybrid",
      "status": "ready",
      "documentCount": 12458,
      "lastUpdated": "2023-04-04T12:00:00Z",
      "createdAt": "2023-04-04T11:30:00Z"
    },
    {
      "id": "index-122",
      "name": "Collection Search Index",
      "description": "Search index for collections",
      "indexType": "text",
      "status": "ready",
      "documentCount": 235,
      "lastUpdated": "2023-03-25T09:45:00Z",
      "createdAt": "2023-03-25T09:15:00Z"
    }
  ]
}
```

#### Rebuild Search Index

```
POST /api/admin/knowledge-base/search-indexes/:indexId/rebuild
```

Rebuilds a search index.

**URL Parameters:**
- `indexId`: Index ID

**Request Body:**
```json
{
  "optimizeForSearchQuality": true,
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "index": {
    "id": "index-123",
    "name": "Material Catalog Index",
    "status": "updating",
    "jobId": "job-456",
    "estimatedTimeToComplete": "10 minutes"
  }
}
```

#### Get Knowledge Base Statistics

```
GET /api/admin/knowledge-base/stats
```

Gets statistics about the knowledge base.

**Response:**
```json
{
  "materials": {
    "total": 12458,
    "byType": {
      "tile": 7845,
      "stone": 2532,
      "wood": 2081
    },
    "revisions": 25890,
    "averageRevisionsPerMaterial": 2.1
  },
  "collections": {
    "total": 235,
    "byManufacturer": {
      "Example Tiles Inc.": 45,
      "Stone Masters": 32,
      "Wood Experts": 28
    }
  },
  "relationships": {
    "total": 35628,
    "byType": {
      "complementary": 15246,
      "alternative": 12482,
      "related": 7900
    }
  },
  "searchIndexes": {
    "total": 10,
    "queries": {
      "last24h": 1245,
      "last7d": 7832,
      "averageResponseTimeMs": 120
    }
  },
  "activity": {
    "materialsCreatedLast7d": 325,
    "materialsUpdatedLast7d": 567,
    "collectionsCreatedLast7d": 12
  }
}
```

### User Management

#### Get User Profile

```
GET /users/profile
```

Gets the profile of the currently authenticated user.

**Response:**
```json
{
  "id": "user-abc",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "permissions": ["read:materials", "create:recognition"],
  "preferences": {
    "theme": "light",
    "language": "en",
    "notifications": {
      "email": true,
      "push": false
    }
  },
  "statistics": {
    "recognitionsCount": 25,
    "savedMaterialsCount": 12,
    "lastLoginAt": "2023-03-19T15:30:00Z"
  },
  "createdAt": "2022-10-15T09:00:00Z",
  "updatedAt": "2023-03-19T15:30:00Z"
}
```

#### Update User Profile

```
PUT /users/profile
```

Updates the profile of the currently authenticated user.

**Request Body:**
```json
{
  "name": "John Smith",
  "preferences": {
    "theme": "dark",
    "notifications": {
      "email": false,
      "push": true
    }
  }
}
```

**Response:**
```json
{
  "id": "user-abc",
  "email": "user@example.com",
  "name": "John Smith",
  "role": "user",
  "preferences": {
    "theme": "dark",
    "language": "en",
    "notifications": {
      "email": false,
      "push": true
    }
  },
  "updatedAt": "2023-03-20T11:45:00Z"
}
```

#### Get User Favorites

```
GET /users/favorites
```

Gets the favorite materials of the currently authenticated user.

**Query Parameters:**
- `limit`: Results per page (optional, default: 20)
- `skip`: Results to skip (pagination) (optional, default: 0)

**Response:**
```json
{
  "favorites": [
    {
      "materialId": "material-123",
      "name": "Ceramic Tile Alpha",
      "materialType": "tile",
      "manufacturer": "Example Tiles Inc.",
      "thumbnailUrl": "https://assets.kai-system.com/thumbnails/material-123.jpg",
      "addedAt": "2023-03-15T10:30:00Z"
    },
    // Additional favorites...
  ],
  "total": 12,
  "limit": 20,
  "skip": 0
}
```

#### Add to Favorites

```
POST /users/favorites/:materialId
```

Adds a material to the user's favorites.

**URL Parameters:**
- `materialId`: ID of the material to add to favorites

**Response:**
```json
{
  "success": true,
  "message": "Material added to favorites",
  "materialId": "material-456",
  "addedAt": "2023-03-20T11:50:00Z"
}
```

#### Remove from Favorites

```
DELETE /users/favorites/:materialId
```

Removes a material from the user's favorites.

**URL Parameters:**
- `materialId`: ID of the material to remove from favorites

**Response:**
```json
{
  "success": true,
  "message": "Material removed from favorites",
  "materialId": "material-123",
  "removedAt": "2023-03-20T11:55:00Z"
}
```

### Admin APIs

#### Get System Statistics

```
GET /admin/statistics
```

Gets system-wide statistics.

**Response:**
```json
{
  "users": {
    "total": 1547,
    "active": 875,
    "newLast7d": 125
  },
  "materials": {
    "total": 12458,
    "byType": {
      "tile": 7845,
      "stone": 2532,
      "wood": 2081
    },
    "addedLast7d": 325
  },
  "collections": {
    "total": 235,
    "byManufacturer": {
      "Example Tiles Inc.": 45,
      "Stone Masters": 32,
      "Wood Experts": 28
    }
  },
  "recognition": {
    "total": 35628,
    "successRate": 92.5,
    "averageConfidence": 0.87,
    "last7d": 2145
  },
  "pdf": {
    "totalProcessed": 847,
    "pagesProcessed": 45628,
    "materialsExtracted": 12458,
    "last7d": 32
  },
  "storage": {
    "totalSizeGB": 256.8,
    "imageCount": 45782,
    "pdfCount": 847
  },
  "performance": {
    "averageResponseTimeMs": 245,
    "p95ResponseTimeMs": 587,
    "cpuUtilization": 42.5,
    "memoryUtilization": 65.8
  }
}
```

#### Get User List

```
GET /admin/users
```

Gets a list of users (admin only).

**Query Parameters:**
- `query`: Search query for name or email (optional)
- `role`: Filter by role (optional)
- `status`: Filter by status (optional, "active", "inactive", or "all", default: "all")
- `limit`: Results per page (optional, default: 20)
- `skip`: Results to skip (pagination) (optional, default: 0)
- `sort`: Field to sort by (optional, default: "createdAt")
- `order`: Sort order (optional, "asc" or "desc", default: "desc")

**Response:**
```json
{
  "users": [
    {
      "id": "user-abc",
      "email": "user@example.com",
      "name": "John Smith",
      "role": "user",
      "status": "active",
      "lastLoginAt": "2023-03-19T15:30:00Z",
      "recognitionsCount": 25,
      "createdAt": "2022-10-15T09:00:00Z",
      "updatedAt": "2023-03-19T15:30:00Z"
    },
    // Additional users...
  ],
  "total": 1547,
  "limit": 20,
  "skip": 0
}
```

#### Update User Role

```
PUT /admin/users/:userId/role
```

Updates a user's role (admin only).

**URL Parameters:**
- `userId`: ID of the user to update

**Request Body:**
```json
{
  "role": "admin",
  "permissions": ["read:all", "write:all", "admin:all"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "User role updated successfully",
  "userId": "user-abc",
  "previousRole": "user",
  "currentRole": "admin",
  "updatedAt": "2023-03-20T12:05:00Z",
  "updatedBy": "user-xyz"
}
```

## Webhook API

### Register Webhook

```
POST /webhooks
```

Registers a new webhook to receive event notifications.

**Request Body:**
```json
{
  "url": "https://example.com/webhook",
  "events": ["material.created", "material.updated", "recognition.completed"],
  "secret": "your-webhook-secret",
  "description": "My application webhook"
}
```

**Response:**
```json
{
  "id": "webhook-123",
  "url": "https://example.com/webhook",
  "events": ["material.created", "material.updated", "recognition.completed"],
  "status": "active",
  "createdAt": "2023-03-20T12:10:00Z"
}
```

### Webhook Events

Webhooks deliver events in the following format:

```json
{
  "id": "event-123",
  "type": "material.created",
  "createdAt": "2023-03-20T14:30:00Z",
  "data": {
    // Event-specific data
  },
  "signature": "sha256-signature"
}
```

Available event types:

1. **Material Events**
   - `material.created`: A new material was created
   - `material.updated`: A material was updated
   - `material.deleted`: A material was deleted

2. **Recognition Events**
   - `recognition.completed`: A recognition job was completed
   - `recognition.failed`: A recognition job failed

3. **PDF Events**
   - `pdf.job.queued`: A PDF job was queued
   - `pdf.job.started`: A PDF job started processing
   - `pdf.job.completed`: A PDF job was completed
   - `pdf.job.failed`: A PDF job failed

4. **Collection Events**
   - `collection.created`: A new collection was created
   - `collection.updated`: A collection was updated
   - `collection.deleted`: A collection was deleted

5. **User Events**
   - `user.registered`: A new user registered
   - `user.login`: A user logged in

## SDK & Client Libraries

The Kai API is accessible through official SDK libraries:

- [JavaScript/TypeScript SDK](https://github.com/kai-system/kai-js)
- [Python SDK](https://github.com/kai-system/kai-python)
- [Java SDK](https://github.com/kai-system/kai-java)

Example usage in JavaScript:

```javascript
import { KaiClient } from '@kai/sdk';

// Initialize client
const kai = new KaiClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.kai-system.com/api/v1' // Optional
});

// Recognize material from image
const recognizeImage = async (imagePath) => {
  try {
    const result = await kai.recognition.recognizeMaterial(imagePath, {
      modelType: 'hybrid',
      confidenceThreshold: 0.6,
      maxResults: 5
    });
    
    console.log('Recognition results:', result.matches);
  } catch (error) {
    console.error('Recognition failed:', error);
  }
};

// Search materials
const searchMaterials = async (query) => {
  try {
    const result = await kai.materials.search({
      query,
      materialType: 'tile',
      limit: 10,
      strategy: 'combined'
    });
    
    console.log(`Found ${result.total} materials matching "${query}"`);
    console.log('Top results:', result.materials);
  } catch (error) {
    console.error('Search failed:', error);
  }
};