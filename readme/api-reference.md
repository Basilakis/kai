# Kai API Reference

## Overview

This document provides comprehensive documentation for the Kai API, including all available endpoints, authentication methods, access control mechanisms, rate limiting, and usage examples.

The Kai API follows RESTful principles and uses JSON for request and response bodies. All endpoints are prefixed with `/api`.

## Table of Contents

- [Authentication](#authentication)
- [Authorization](#authorization)
  - [Role-Based Access Control](#role-based-access-control)
  - [Network-Based Access Control](#network-based-access-control)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Users](#user-endpoints)
  - [Materials](#material-endpoints)
  - [Catalogs](#catalog-endpoints)
  - [Recognition](#recognition-endpoints)
  - [Search](#search-endpoints)
  - [MoodBoard](#moodboard-endpoints)
  - [Analytics](#analytics-endpoints)
  - [Admin](#admin-endpoints)
  - [AI](#ai-endpoints)
  - [Agents](#agent-endpoints)
  - [3D Designer](#3d-designer-endpoints)
  - [Subscription](#subscription-endpoints)
- [Network Access Control Implementation](#network-access-control-implementation)
- [Scripts and Utilities](#scripts-and-utilities)
- [Best Practices](#best-practices)
- [SDK Examples](#sdk-examples)

## Authentication

The Kai API uses JWT (JSON Web Tokens) for authentication. To access protected endpoints, you must include an authorization token in the request headers.

### Getting a Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

### Using a Token

Include the token in the Authorization header for subsequent requests:

```http
GET /api/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Authorization

The Kai API implements multiple layers of authorization to secure endpoints.

### Role-Based Access Control

Users have roles (e.g., `admin`, `user`) that determine their access level. Some endpoints are restricted to specific roles.

Example:
- Admin routes (`/api/admin/*`) require the `admin` role
- User management requires appropriate permissions

### Network-Based Access Control

Some sensitive operations are restricted to internal network access only. This ensures that critical endpoints cannot be accessed from external networks, adding an additional security layer.

> **IMPORTANT**: No API endpoints have hardcoded access restrictions. All endpoint access controls are configured through the admin panel and stored in the database.

#### Network Access Types

API endpoints can have one of the following access types:

1. **ANY**: Accessible from both internal and external networks (default for most endpoints)
2. **INTERNAL_ONLY**: Only accessible from internal networks
3. **EXTERNAL_ALLOWED**: Explicitly allows external access (same as ANY)

These access types are defined in the `NetworkAccessType` enum in `packages/server/src/utils/network.ts`.

#### Internal Networks

Internal networks are defined by CIDR ranges (e.g., `10.0.0.0/8`, `192.168.0.0/16`). Requests originating from these networks can access endpoints marked as "internal-only".

#### Access Verification

The system verifies network access as follows:

1. Determines the client's IP address (considering proxy headers if configured)
2. Checks if the IP falls within any defined internal network ranges
3. Verifies if the requested endpoint is allowed for the client's network location

**Important Note**: The "Default Access" column in endpoint tables shows the recommended access type for each endpoint, but these are not hardcoded restrictions. All access settings are fully configurable through the admin panel.

#### Admin Panel

The admin panel provides a user-friendly interface for managing API access control:

1. **Internal Networks**: Define CIDR ranges that should be considered internal networks
2. **API Endpoint Access Control**: Configure which endpoints can be accessed from internal or external networks
3. **Rate Limits**: Set default and custom rate limits for different networks

To access the admin panel, navigate to `/admin/network-access` in the application.

#### Testing Network Access

For development and testing purposes, you can:

1. Use the loopback address (127.0.0.1) which is always considered internal
2. Configure custom CIDR ranges for your development environment
3. Use the `/api/admin/network-test` endpoint (in development mode) to verify network detection

```http
GET /api/admin/network-test
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:

```json
{
  "success": true,
  "data": {
    "ip": "192.168.1.100",
    "isInternal": true,
    "matchedNetwork": "192.168.0.0/16"
  }
}
```

## Error Handling

All API endpoints return consistent error responses with the following format:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "details": {
    // Additional error details if available
  }
}
```

Common HTTP status codes:

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions or network restriction |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server-side issue |

## Rate Limiting

The Kai platform implements a tiered rate limiting system to prevent abuse while allowing different levels of access for different clients.

### Default Rate Limit

By default, most API endpoints are limited to 30 requests per minute. This is configurable through the admin panel.

### Custom Rate Limits

Administrators can configure custom rate limits for specific IP addresses or CIDR ranges. For example:

- Internal networks (10.0.0.0/8): 300 requests per minute
- Office network (203.0.113.0/24): 100 requests per minute
- Specific partners (8.8.8.8): 50 requests per minute

### Category-Specific Rate Limits

Different endpoint categories have different default rate limits:

| Category | Default Limit | Internal Multiplier | Notes |
|----------|---------------|---------------------|-------|
| Standard API | 100 req/min | Configurable | General API endpoints |
| Authentication | 20 req/min | 2x | More strict to prevent brute force |
| ML Processing | 10 req/min | Configurable | Resource-intensive operations |
| Agent API | 30 req/min | Configurable | AI agent interactions |
| PDF Processing | 5 req/10 min | Configurable | Very resource-intensive |

When a rate limit is exceeded, the API returns a 429 Too Many Requests response with a Retry-After header:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded, please try again later",
  "retryAfter": 60
}
```

## API Endpoints

This section lists all available API endpoints, grouped by category. For each endpoint, we provide method, path, description, and default access recommendation.

### Authentication Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| POST | /api/auth/register | Register a new user | EXTERNAL_ALLOWED |
| POST | /api/auth/login | Log in and get a token | EXTERNAL_ALLOWED |
| POST | /api/auth/refresh | Refresh an auth token | EXTERNAL_ALLOWED |
| POST | /api/auth/logout | Log out (invalidate token) | EXTERNAL_ALLOWED |
| GET | /api/auth/me | Get current user info | EXTERNAL_ALLOWED |

#### Login Example

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "role": "user"
  }
}
```

#### Register Example

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securepassword",
  "name": "New User"
}
```

Response:

```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "124",
    "email": "newuser@example.com",
    "role": "user"
  }
}
```

### User Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| GET | /api/users/profile | Get current user profile | EXTERNAL_ALLOWED |
| PUT | /api/users/profile | Update user profile | EXTERNAL_ALLOWED |

#### Get Current User Profile Example

```http
GET /api/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "123",
    "email": "user@example.com",
    "name": "User Name",
    "role": "user",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "subscription": {
      "tier": "basic",
      "expiresAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Material Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| GET | /api/materials | Get all materials | EXTERNAL_ALLOWED |
| GET | /api/materials/:id | Get material by ID | EXTERNAL_ALLOWED |
| POST | /api/materials | Create a new material | EXTERNAL_ALLOWED |
| PUT | /api/materials/:id | Update a material | EXTERNAL_ALLOWED |
| DELETE | /api/materials/:id | Delete a material | EXTERNAL_ALLOWED |
| GET | /api/materials/favorites | Get user's favorite materials | EXTERNAL_ALLOWED |
| POST | /api/materials/:id/favorite | Add material to favorites | EXTERNAL_ALLOWED |
| DELETE | /api/materials/:id/favorite | Remove material from favorites | EXTERNAL_ALLOWED |

#### Get All Materials Example

```http
GET /api/materials?page=1&limit=10&category=tile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:

```json
{
  "success": true,
  "count": 120,
  "page": 1,
  "limit": 10,
  "data": [
    {
      "id": "mat-123",
      "name": "Marble Tile",
      "category": "tile",
      "imageUrl": "https://example.com/images/marble-tile.jpg",
      "metadata": {
        "color": "white",
        "finish": "polished",
        "size": "12x12"
      }
    },
    // More materials...
  ]
}
```

### Catalog Endpoints

These endpoints manage material catalogs, which are collections of related materials.

### Recognition Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| POST | /api/recognition | Recognize material from image | EXTERNAL_ALLOWED |
| GET | /api/recognition/history | Get recognition history | EXTERNAL_ALLOWED |
| POST | /api/recognition/feedback | Submit recognition feedback | EXTERNAL_ALLOWED |

#### Recognize Material Example

```http
POST /api/recognition
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data
```

Form data:
- `image`: Image file
- `modelType` (optional): "standard", "enhanced", or "hybrid"
- `maxResults` (optional): Number of results to return (default: 5)

Response:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "materialId": "mat-123",
        "name": "Marble Tile",
        "confidence": 0.94,
        "imageUrl": "https://example.com/images/marble-tile.jpg",
        "metadata": {
          "color": "white",
          "finish": "polished"
        }
      },
      // More results...
    ],
    "processingTime": 1.2
  }
}
```

### Search Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| GET | /api/search | Search for materials | EXTERNAL_ALLOWED |
| GET | /api/search/autocomplete | Get search suggestions | EXTERNAL_ALLOWED |
| POST | /api/search/vector | Vector similarity search | EXTERNAL_ALLOWED |
| GET | /api/search/recent | Get recent searches | EXTERNAL_ALLOWED |

### MoodBoard Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| GET | /api/boards | Get all boards for current user | EXTERNAL_ALLOWED |
| GET | /api/boards/:boardId | Get board by ID | EXTERNAL_ALLOWED |
| POST | /api/boards | Create a new board | EXTERNAL_ALLOWED |
| PUT | /api/boards/:boardId | Update board details | EXTERNAL_ALLOWED |
| DELETE | /api/boards/:boardId | Delete a board | EXTERNAL_ALLOWED |
| GET | /api/boards/:boardId/items | Get all items in a board | EXTERNAL_ALLOWED |
| POST | /api/boards/:boardId/items | Add an item to a board | EXTERNAL_ALLOWED |
| PUT | /api/boards/:boardId/items/:itemId | Update item details | EXTERNAL_ALLOWED |
| DELETE | /api/boards/:boardId/items/:itemId | Remove an item from a board | EXTERNAL_ALLOWED |
| GET | /api/users/:userId/boards | Get public boards for a user | EXTERNAL_ALLOWED |

### Analytics Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| POST | /api/analytics/event | Track an analytics event | EXTERNAL_ALLOWED |
| POST | /api/analytics/pageview | Track a page view | EXTERNAL_ALLOWED |
| POST | /api/analytics/user-activity | Track user activity | EXTERNAL_ALLOWED |
| GET | /api/admin/analytics/events | Get analytics events | INTERNAL_ONLY |
| GET | /api/admin/analytics/trends | Get analytics trends | INTERNAL_ONLY |
| DELETE | /api/admin/analytics/data | Clear analytics data | INTERNAL_ONLY |
| POST | /api/admin/analytics/rebuild-index | Rebuild search index | INTERNAL_ONLY |

#### Track User Activity Example

```http
POST /api/analytics/user-activity
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "eventType": "view_material",
  "materialId": "mat-123",
  "data": {
    "timeSpent": 45,
    "viewedImages": 3
  }
}
```

Response:

```json
{
  "success": true,
  "message": "Activity logged successfully"
}
```

### Admin Endpoints

These endpoints require admin role and some are restricted to internal networks only.

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| GET | /api/admin/users | Get all users | INTERNAL_ONLY |
| GET | /api/admin/users/:id | Get user by ID | INTERNAL_ONLY |
| PUT | /api/admin/users/:id | Update a user | INTERNAL_ONLY |
| DELETE | /api/admin/users/:id | Delete a user | INTERNAL_ONLY |
| GET | /api/admin/settings | Get system settings | INTERNAL_ONLY |
| PUT | /api/admin/settings | Update system settings | INTERNAL_ONLY |
| GET | /api/admin/jobs | Get processing jobs | INTERNAL_ONLY |
| POST | /api/admin/jobs/:id/cancel | Cancel a job | INTERNAL_ONLY |
| GET | /api/admin/dashboard | Get admin dashboard stats | INTERNAL_ONLY |

#### Get Admin Dashboard Stats Example

```http
GET /api/admin/dashboard
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1250,
      "active": 850,
      "new": 120
    },
    "materials": {
      "total": 15000,
      "views": 25600,
      "searches": 8500
    },
    "recognition": {
      "requests": 3500,
      "successRate": 0.92
    }
  }
}
```

#### Network Access Management

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| GET | /api/admin/network/internal | Get internal networks | INTERNAL_ONLY |
| POST | /api/admin/network/internal | Add internal network | INTERNAL_ONLY |
| DELETE | /api/admin/network/internal/:id | Remove internal network | INTERNAL_ONLY |
| GET | /api/admin/network/endpoints | Get endpoint access rules | INTERNAL_ONLY |
| POST | /api/admin/network/endpoints | Add endpoint access rule | INTERNAL_ONLY |
| PUT | /api/admin/network/endpoints/:id | Update endpoint access | INTERNAL_ONLY |

#### Rate Limit Management

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| GET | /api/admin/rate-limits/settings | Get rate limit settings | INTERNAL_ONLY |
| PUT | /api/admin/rate-limits/settings | Update rate limit settings | INTERNAL_ONLY |
| GET | /api/admin/rate-limits/custom | Get custom rate limits | INTERNAL_ONLY |
| POST | /api/admin/rate-limits/custom | Add custom rate limit | INTERNAL_ONLY |
| PUT | /api/admin/rate-limits/custom/:id | Update custom rate limit | INTERNAL_ONLY |
| DELETE | /api/admin/rate-limits/custom/:id | Remove custom rate limit | INTERNAL_ONLY |

### AI Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| POST | /api/ai/generate-description | Generate material description | EXTERNAL_ALLOWED |

#### Generate Material Description Example

```http
POST /api/ai/generate-description
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "materialId": "mat-123",
  "tone": "professional",
  "length": "medium"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "description": "This premium quality marble tile features a stunning white polished finish that adds elegance to any space. Perfect for luxury residential or commercial flooring applications, the 12\"x12\" dimensions provide versatility for various design patterns."
  }
}
```

### Agent Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| POST | /api/agents/material-expert/chat | Chat with material expert | EXTERNAL_ALLOWED |

#### Chat with Material Expert Example

```http
POST /api/agents/material-expert/chat
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "message": "What's the best material for a kitchen floor?",
  "sessionId": "session-456"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "reply": "For kitchen floors, I recommend porcelain or ceramic tiles due to their durability and water resistance. Porcelain is particularly good because it's less porous than ceramic, making it more stain-resistant and easier to clean. Natural stone like granite is also excellent but requires more maintenance. Would you like me to suggest some specific options?",
    "suggestedMaterials": [
      {
        "id": "mat-456",
        "name": "Premium Porcelain Tile",
        "imageUrl": "https://example.com/images/porcelain-tile.jpg"
      }
    ]
  }
}
```

### 3D Designer Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| POST | /api/3d-designer/generate-layout | Generate room layout | EXTERNAL_ALLOWED |
| POST | /api/3d-designer/scene | Create a new 3D scene | EXTERNAL_ALLOWED |
| GET | /api/3d-designer/scene/:id | Get scene by ID | EXTERNAL_ALLOWED |
| PUT | /api/3d-designer/scene/:id | Update a scene | EXTERNAL_ALLOWED |
| DELETE | /api/3d-designer/scene/:id | Delete a scene | EXTERNAL_ALLOWED |
| POST | /api/3d-designer/render | Render a scene | EXTERNAL_ALLOWED |
| POST | /api/3d-designer/export | Export a scene | EXTERNAL_ALLOWED |

#### Generate Room Layout Example

```http
POST /api/3d-designer/generate-layout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "roomType": "kitchen",
  "dimensions": {
    "width": 4.5,
    "length": 6.2,
    "height": 2.8
  },
  "style": "modern"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "layoutId": "layout-789",
    "previewUrl": "https://example.com/layouts/preview-789.jpg",
    "modelUrl": "https://example.com/layouts/model-789.gltf"
  }
}
```

### Subscription Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| GET | /api/subscriptions/tiers | Get subscription tiers | EXTERNAL_ALLOWED |
| POST | /api/subscriptions/update | Update user subscription | EXTERNAL_ALLOWED |

#### Get Subscription Tiers Example

```http
GET /api/subscriptions/tiers
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "tier-basic",
      "name": "Basic",
      "price": 9.99,
      "features": [
        "Material recognition (50/month)",
        "Basic search",
        "Standard API access"
      ]
    },
    {
      "id": "tier-pro",
      "name": "Professional",
      "price": 29.99,
      "features": [
        "Material recognition (500/month)",
        "Advanced search with filters",
        "Enhanced API access",
        "Material expert agent"
      ]
    },
    {
      "id": "tier-enterprise",
      "name": "Enterprise",
      "price": 99.99,
      "features": [
        "Unlimited material recognition",
        "Advanced search with custom filters",
        "Full API access",
        "All AI agents",
        "Custom branding"
      ]
    }
  ]
}
```

## Network Access Control Implementation

Network access controls are implemented using IP address detection to differentiate between internal and external requests. The system uses CIDR notation to define internal networks.

### Configuration

Internal networks are defined using the `INTERNAL_NETWORKS` environment variable as a comma-separated list of CIDR ranges:

```
INTERNAL_NETWORKS=127.0.0.1/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

### Implementation Details

Network-based access control is implemented alongside other authorization mechanisms:

1. Authentication verifies user identity
2. Role-based access control verifies user permissions
3. Network-based access control verifies request source
4. Subscription-based access control verifies feature access

This layered approach ensures that sensitive operations are protected by multiple security mechanisms.

### Protected Endpoints

The following endpoints are protected by network-based access control:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/analytics/data` | DELETE | Clear analytics data |
| `/api/admin/backup` | POST | Create database backup |
| `/api/admin/restore` | POST | Restore from backup |
| `/api/admin/settings` | PUT | Update system settings |
| `/api/admin/training/:jobId/stop` | POST | Stop ML training job |

## Scripts and Utilities

The following scripts are available to help manage API access control:

1. **setup-api-access-control.ts**: Sets up the API access control system by checking for unregistered endpoints and registering them
2. **check-unregistered-endpoints.ts**: Scans the codebase for API endpoints and checks if they are registered
3. **register-api-endpoints.ts**: Registers API endpoints with the network access control system

To run these scripts:

```bash
# From the project root
cd packages/server
yarn run-script setup-api-access-control
yarn run-script check-unregistered-endpoints
yarn run-script register-api-endpoints
```

## Adding New API Endpoints

When adding new API endpoints, follow these steps to ensure they are properly registered with the access control system:

1. Create your route file and define your endpoints as usual
2. Use the `authorize` middleware with the appropriate `NetworkAccessType`:

```typescript
router.get(
  '/your-endpoint',
  authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }),
  asyncHandler(async (req, res) => {
    // Your handler code
  })
);
```

3. Run the setup script to register the endpoint:

```bash
# From the project root
cd packages/server
yarn run-script setup-api-access-control
```

4. Verify that your endpoint appears in the admin panel

**Important**: Do not block endpoints by default. Let administrators control access through the admin panel.

## Best Practices

1. **Don't Block by Default**: Let administrators control access through the admin panel
2. **Register All Endpoints**: Make sure all endpoints are registered with the access control system
3. **Use Appropriate Access Types**: Use `INTERNAL_ONLY` for sensitive operations, `ANY` for public endpoints
4. **Document Access Requirements**: Document the access requirements for each endpoint
5. **Run the Setup Script**: Run the setup script after adding new endpoints
6. **Check the Admin Panel**: Verify that your endpoints appear in the admin panel

By following these best practices, you can ensure that your API endpoints are properly secured while allowing appropriate access.

## SDK Examples

### JavaScript/TypeScript

```javascript
import KaiClient from '@kai/client';

// Initialize client
const client = new KaiClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.example.com'
});

// Authentication
async function login() {
  try {
    const { token, user } = await client.auth.login({
      email: 'user@example.com',
      password: 'password'
    });
    
    // Store token for subsequent requests
    client.setToken(token);
    
    return user;
  } catch (error) {
    console.error('Login failed:', error.message);
  }
}

// Material recognition
async function recognizeMaterial(imageFile) {
  try {
    const result = await client.recognition.recognize({
      image: imageFile,
      modelType: 'enhanced',
      maxResults: 5
    });
    
    return result.results;
  } catch (error) {
    console.error('Recognition failed:', error.message);
  }
}

// Admin operations (internal network only)
async function clearAnalyticsData() {
  try {
    await client.admin.analytics.clearData();
    console.log('Analytics data cleared successfully');
  } catch (error) {
    if (error.statusCode === 403) {
      console.error('Network access denied: This operation requires internal network access');
    } else {
      console.error('Operation failed:', error.message);
    }
  }
}
```

### Python

```python
from kai_client import KaiClient

# Initialize client
client = KaiClient(
    api_key='your-api-key',
    base_url='https://api.example.com'
)

# Authentication
def login():
    try:
        response = client.auth.login(
            email='user@example.com',
            password='password'
        )
        
        # Store token for subsequent requests
        client.set_token(response['token'])
        
        return response['user']
    except Exception as e:
        print(f"Login failed: {str(e)}")

# Material recognition
def recognize_material(image_path):
    try:
        with open(image_path, 'rb') as image_file:
            result = client.recognition.recognize(
                image=image_file,
                model_type='enhanced',
                max_results=5
            )
        
        return result['results']
    except Exception as e:
        print(f"Recognition failed: {str(e)}")

# Admin operations (internal network only)
def clear_analytics_data():
    try:
        client.admin.analytics.clear_data()
        print("Analytics data cleared successfully")
    except Exception as e:
        if getattr(e, 'status_code', None) == 403:
            print("Network access denied: This operation requires internal network access")
        else:
            print(f"Operation failed: {str(e)}")
```

For more examples, including implementation in other languages, rate limit handling, and error management, please refer to our [Developer Guide](../docs/developer-guide.md).