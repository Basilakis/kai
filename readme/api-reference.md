# Kai API Reference

## Overview

This document provides a comprehensive reference for all API endpoints in the Kai platform. It includes details on authentication, authorization, network access controls, rate limiting, and endpoint-specific information.

## Table of Contents

- [Authentication](#authentication)
- [Network Access Control](#network-access-control)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-endpoints)
  - [Materials](#materials-endpoints)
  - [Analytics](#analytics-endpoints)
  - [Search](#search-endpoints)
  - [Recognition](#recognition-endpoints)
  - [3D Designer](#3d-designer-endpoints)
  - [Admin](#admin-endpoints)
- [Error Handling](#error-handling)
- [Example Code](#example-code)

## Authentication

All API endpoints require authentication unless specifically noted. Authentication is performed using JWT tokens.

```
Authorization: Bearer <your_token>
```

## Network Access Control

> **IMPORTANT**: No API endpoints have hardcoded access restrictions. All endpoint access controls are configured through the admin panel and stored in the database.

The Kai platform implements a network-based access control system that allows administrators to configure which endpoints can be accessed from internal vs. external networks. This provides an additional layer of security for sensitive operations.

### Internal Networks

Internal networks are defined by CIDR ranges (e.g., `10.0.0.0/8`, `192.168.0.0/16`). Requests originating from these networks can access endpoints marked as "internal-only".

### Access Types

Each endpoint has a configurable access type:

- **ANY** - Accessible from any network (default for most endpoints)
- **INTERNAL_ONLY** - Only accessible from defined internal networks
- **EXTERNAL_ONLY** - Only accessible from external networks (rare)

**Note**: Access types shown in this documentation are default recommendations only. Actual access restrictions are fully configurable through the admin panel.

### Access Verification

The system verifies network access as follows:

1. Determines the client's IP address (considering proxy headers if configured)
2. Checks if the IP falls within any defined internal network ranges
3. Verifies if the requested endpoint is allowed for the client's network location

**Important Note**: All endpoint access restrictions are configurable through the admin interface. This documentation shows the recommended default access settings, but administrators can modify these settings based on specific requirements. Even sensitive operations like "update analytics" have no hardcoded restrictions and can be configured for external access if needed.

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

When a rate limit is exceeded, the API returns a 429 Too Many Requests response with a Retry-After header.

## API Endpoints

This section lists all available API endpoints, grouped by category. For each endpoint, we provide:

- HTTP method and path
- Description
- Default access recommendation
- Required parameters
- Response format

> **Note about Access Recommendations**: The "Default Access" column shows the recommended access type for each endpoint, but these are not hardcoded restrictions. All access settings are fully configurable through the admin panel.

### Authentication Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| POST | /api/auth/register | Register a new user | EXTERNAL_ALLOWED |
| POST | /api/auth/login | Log in and get a token | EXTERNAL_ALLOWED |
| POST | /api/auth/refresh | Refresh an auth token | EXTERNAL_ALLOWED |
| POST | /api/auth/logout | Log out (invalidate token) | EXTERNAL_ALLOWED |
| GET | /api/auth/me | Get current user info | EXTERNAL_ALLOWED |

### Materials Endpoints

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

### Analytics Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| POST | /api/analytics/event | Track an analytics event | EXTERNAL_ALLOWED |
| POST | /api/analytics/pageview | Track a page view | EXTERNAL_ALLOWED |
| GET | /api/admin/analytics/events | Get analytics events | INTERNAL_ONLY |
| GET | /api/admin/analytics/trends | Get analytics trends | INTERNAL_ONLY |
| DELETE | /api/admin/analytics/data | Clear analytics data | INTERNAL_ONLY |
| POST | /api/admin/analytics/rebuild-index | Rebuild search index | INTERNAL_ONLY |

### Search Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| GET | /api/search | Search for materials | EXTERNAL_ALLOWED |
| GET | /api/search/autocomplete | Get search suggestions | EXTERNAL_ALLOWED |
| POST | /api/search/vector | Vector similarity search | EXTERNAL_ALLOWED |
| GET | /api/search/recent | Get recent searches | EXTERNAL_ALLOWED |

### Recognition Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| POST | /api/recognition | Recognize material from image | EXTERNAL_ALLOWED |
| GET | /api/recognition/history | Get recognition history | EXTERNAL_ALLOWED |
| POST | /api/recognition/feedback | Submit recognition feedback | EXTERNAL_ALLOWED |

### 3D Designer Endpoints

| Method | Endpoint | Description | Default Access |
|--------|----------|-------------|----------------|
| POST | /api/3d-designer/scene | Create a new 3D scene | EXTERNAL_ALLOWED |
| GET | /api/3d-designer/scene/:id | Get scene by ID | EXTERNAL_ALLOWED |
| PUT | /api/3d-designer/scene/:id | Update a scene | EXTERNAL_ALLOWED |
| DELETE | /api/3d-designer/scene/:id | Delete a scene | EXTERNAL_ALLOWED |
| POST | /api/3d-designer/render | Render a scene | EXTERNAL_ALLOWED |
| POST | /api/3d-designer/export | Export a scene | EXTERNAL_ALLOWED |

### Admin Endpoints

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

## Error Handling

All API endpoints return consistent error responses with the following format:

```json
{
  "success": false,
  "error": "Error message",
  "details": {
    // Additional error details if available
  }
}
```

Common HTTP status codes:

- 400: Bad Request - Invalid input
- 401: Unauthorized - Missing or invalid authentication
- 403: Forbidden - Insufficient permissions or network restrictions
- 404: Not Found - Resource not found
- 429: Too Many Requests - Rate limit exceeded
- 500: Internal Server Error - Server-side error

## Example Code

### JavaScript/TypeScript

```javascript
// Authentication
async function login(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error);
  }
  
  // Store token
  localStorage.setItem('token', data.token);
  return data.user;
}

// API call with authentication
async function getMaterials() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/materials', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error);
  }
  
  return data.materials;
}

// Material recognition
async function recognizeMaterial(imageFile) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('image', imageFile);
  
  const response = await fetch('/api/recognition', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error);
  }
  
  return data.results;
}
```

### Python

```python
import requests

base_url = 'https://api.example.com'
token = None

def login(email, password):
    global token
    response = requests.post(
        f'{base_url}/api/auth/login',
        json={'email': email, 'password': password}
    )
    data = response.json()
    
    if not data.get('success'):
        raise Exception(data.get('error', 'Login failed'))
        
    token = data['token']
    return data['user']

def get_materials():
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f'{base_url}/api/materials', headers=headers)
    data = response.json()
    
    if not data.get('success'):
        raise Exception(data.get('error', 'Failed to get materials'))
        
    return data['materials']

def recognize_material(image_path):
    headers = {'Authorization': f'Bearer {token}'}
    files = {'image': open(image_path, 'rb')}
    
    response = requests.post(
        f'{base_url}/api/recognition',
        headers=headers,
        files=files
    )
    data = response.json()
    
    if not data.get('success'):
        raise Exception(data.get('error', 'Recognition failed'))
        
    return data['results']
```

For more examples, including implementation in other languages, rate limit handling, and error management, please refer to our [Developer Guide](../docs/developer-guide.md).