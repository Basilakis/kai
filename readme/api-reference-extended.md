# Kai API Reference

## Overview

This document provides comprehensive documentation for the Kai API, including all available endpoints, authentication methods, access control mechanisms, and usage examples.

The Kai API follows RESTful principles and uses JSON for request and response bodies. All endpoints are prefixed with `/api`.

## Table of Contents

- [Authentication](#authentication)
- [Authorization](#authorization)
  - [Role-Based Access Control](#role-based-access-control)
  - [Network-Based Access Control](#network-based-access-control)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Authentication](#authentication-endpoints)
  - [Users](#user-endpoints)
  - [Materials](#material-endpoints)
  - [Catalogs](#catalog-endpoints)
  - [Recognition](#recognition-endpoints)
  - [Search](#search-endpoints)
  - [Analytics](#analytics-endpoints)
  - [Admin](#admin-endpoints)
  - [AI](#ai-endpoints)
  - [Agents](#agent-endpoints)
  - [3D Designer](#3d-designer-endpoints)
  - [Subscription](#subscription-endpoints)

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

Internal-only endpoints include:
- Data deletion endpoints
- Configuration update endpoints
- System maintenance operations

Attempting to access internal-only endpoints from external networks will result in a 403 Forbidden error.

## Error Handling

The API returns consistent error responses in the following format:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400
}
```

Common error codes:

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions or network restriction |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server-side issue |

## Endpoints

### Authentication Endpoints

#### Login

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

#### Register

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

#### Logout

```http
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### User Endpoints

#### Get Current User Profile

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

#### Update User Profile

```http
PUT /api/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "Updated Name",
  "company": "Company Name",
  "phone": "+1234567890"
}
```

Response:

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "123",
    "email": "user@example.com",
    "name": "Updated Name",
    "company": "Company Name",
    "phone": "+1234567890"
  }
}
```

### Material Endpoints

#### Get All Materials

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

#### Get Material by ID

```http
GET /api/materials/mat-123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "mat-123",
    "name": "Marble Tile",
    "category": "tile",
    "description": "Premium quality marble tile for flooring",
    "imageUrl": "https://example.com/images/marble-tile.jpg",
    "metadata": {
      "color": "white",
      "finish": "polished",
      "size": "12x12",
      "material": "marble",
      "usage": "floor,wall"
    },
    "similar": [
      {
        "id": "mat-124",
        "name": "Similar Marble Tile",
        "imageUrl": "https://example.com/images/similar-marble-tile.jpg"
      }
    ]
  }
}
```

#### Create Material

```http
POST /api/materials
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "New Marble Tile",
  "category": "tile",
  "description": "Premium quality marble tile for flooring",
  "imageUrl": "https://example.com/images/new-marble-tile.jpg",
  "metadata": {
    "color": "beige",
    "finish": "polished",
    "size": "24x24",
    "material": "marble",
    "usage": "floor"
  }
}
```

Response:

```json
{
  "success": true,
  "message": "Material created successfully",
  "data": {
    "id": "mat-125",
    "name": "New Marble Tile",
    "category": "tile",
    "description": "Premium quality marble tile for flooring",
    "imageUrl": "https://example.com/images/new-marble-tile.jpg",
    "metadata": {
      "color": "beige",
      "finish": "polished",
      "size": "24x24",
      "material": "marble",
      "usage": "floor"
    }
  }
}
```

### Recognition Endpoints

#### Recognize Material

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

### Analytics Endpoints

#### Track User Activity

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

#### Get Admin Dashboard Stats

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

#### Clear Analytics Data (Internal Only)

```http
DELETE /api/admin/analytics/data
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response (from internal network):

```json
{
  "success": true,
  "message": "Analytics data cleared successfully"
}
```

Response (from external network):

```json
{
  "success": false,
  "error": "This resource is only accessible from internal networks",
  "statusCode": 403
}
```

### AI Endpoints

#### Generate Material Description

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

#### Chat with Material Expert

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

#### Generate Room Layout

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

#### Get Subscription Tiers

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

#### Update User Subscription

```http
POST /api/subscriptions/update
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "tierId": "tier-pro",
  "paymentMethodId": "pm_123456789"
}
```

Response:

```json
{
  "success": true,
  "message": "Subscription updated successfully",
  "data": {
    "subscription": {
      "tier": "Professional",
      "startDate": "2023-07-15T00:00:00.000Z",
      "expiresAt": "2024-07-15T00:00:00.000Z",
      "status": "active"
    }
  }
}
```

## Rate Limiting

The API implements rate limiting to protect the service from abuse:

| Endpoint Category | Rate Limit |
|-------------------|------------|
| Authentication | 20 requests/minute |
| Material Recognition | 10 requests/minute |
| Agent APIs | 30 requests/minute |
| PDF Processing | 5 requests/10 minutes |
| General API | 100 requests/minute |

When rate limits are exceeded, you'll receive a 429 response:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded, please try again later",
  "retryAfter": 60
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

### Testing Network Access

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

## SDK Examples

### JavaScript/TypeScript

```typescript
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

## Conclusion

This API reference provides a comprehensive overview of the Kai API, including authentication, authorization, and all available endpoints. For specific implementation details or questions, please contact api-support@example.com.