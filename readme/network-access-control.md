# Network Access Control System

## Overview

The Network Access Control system in the Kai platform provides a robust security layer that restricts sensitive operations to internal networks only. This document explains the concepts, configuration options, implementation details, and best practices for the system.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Administrator Configuration](#administrator-configuration)
   - [Admin Panel Interface](#admin-panel-interface)
   - [Internal Networks Management](#internal-networks-management)
   - [API Endpoint Access Control](#api-endpoint-access-control)
   - [Rate Limiting Configuration](#rate-limiting-configuration)
3. [Technical Implementation](#technical-implementation)
   - [Database Schema](#database-schema)
   - [Network Source Detection](#network-source-detection)
   - [Authorization Middleware](#authorization-middleware)
   - [Rate Limiting Implementation](#rate-limiting-implementation)
4. [Usage Examples](#usage-examples)
5. [Best Practices](#best-practices)
6. [Developer Guidelines](#developer-guidelines)
7. [Troubleshooting](#troubleshooting)
8. [Security Considerations](#security-considerations)
9. [API Reference](#api-reference)

## Core Concepts

### Access Types

Endpoints in the Kai API are classified into three main access types:

1. **ANY** / **EXTERNAL_ALLOWED**: Accessible from both internal and external networks
   - Example: User authentication, material search, recognition
   - Standard user-facing functionality

2. **INTERNAL_ONLY**: Restricted to requests originating from authorized internal networks
   - Example: Deleting analytics data, system backup operations, configuration updates
   - Provides protection for sensitive administrative functions

3. **EXTERNAL_ONLY**: Only accessible from external networks (rare)
   - Example: Special public-only interfaces

### Network Classification

Requests are classified as internal or external based on the source IP address:

- **Internal**: IP addresses within configured CIDR ranges (e.g., corporate networks, VPNs)
- **External**: All other IP addresses (public internet)

## Administrator Configuration

### 100% Dynamic Configuration

**Important: No API endpoints have hardcoded access restrictions in the codebase.** All access controls are fully configurable through the admin interface, including:

- Operations that might seem sensitive (like "update analytics", "clear data", or "system settings")
- Admin operations that would typically be internal-only
- Public-facing endpoints that need wide accessibility

The classifications shown in the API documentation represent recommended default settings only and can be modified at any time through the admin interface.

### Admin Panel Interface

The admin panel provides a user-friendly interface for managing API access control. To access the admin panel, navigate to `/admin/network-access` in the application.

The admin panel consists of three main sections:

1. **Internal Networks**: Define CIDR ranges that should be considered internal networks
2. **API Endpoint Access Control**: Configure which endpoints can be accessed from internal or external networks
3. **Rate Limits**: Set default and custom rate limits for different networks

### Internal Networks Management

#### What Are Internal Networks?

Internal networks are IP addresses or CIDR ranges that are considered trusted. Requests originating from these networks can access endpoints marked as "internal-only". Typical internal networks include:

- Corporate office networks
- VPN connections
- Development environments
- Cloud infrastructure in the same private network

#### Adding Internal Networks

1. Navigate to **Settings** → **Network Access**
2. In the **Internal Networks** section, enter a CIDR range (e.g., `10.0.0.0/8`)
3. Provide an optional description for reference
4. Click **Add**
5. The network will appear in the list of internal networks

#### Example Internal Networks

| Network | Description |
|---------|-------------|
| 127.0.0.1/8 | Localhost |
| 10.0.0.0/8 | Private network class A |
| 172.16.0.0/12 | Private network class B |
| 192.168.0.0/16 | Private network class C |
| 203.0.113.0/24 | Office network (example) |

#### Removing Internal Networks

To remove a network from the internal networks list:

1. Find the network in the list
2. Click the trash icon next to the network
3. The network will be removed immediately

### API Endpoint Access Control

#### Configuring Endpoint Access

1. Navigate to **Settings** → **Network Access**
2. In the **API Endpoint Access Control** section, you'll see a table of all API endpoints
3. Use the checkboxes to control access:
   - **Internal Access**: Check to allow access from internal networks
   - **External Access**: Check to allow access from external networks

#### Filtering and Searching Endpoints

For easier management of large numbers of endpoints:

- Use the search box to find specific endpoints by path, method, or description
- Use the filters to show only internal-only or external-allowed endpoints

#### Recommended Endpoint Security

While all endpoint access settings are configurable, we recommend the following security best practices:

- Restrict sensitive admin operations to internal-only access
- Allow public-facing endpoints (authentication, content access) from both internal and external networks
- Regularly review access settings, especially after adding new endpoints

### Rate Limiting Configuration

#### Default Rate Limit

The system has a default rate limit that applies to all requests from non-specified networks. By default, this is set to 30 requests per minute, but it can be configured:

1. Navigate to **Settings** → **Network Access**
2. In the **Rate Limiting** section, adjust the **Default Rate Limit** value
3. Click **Save Network Settings**

#### Custom Rate Limits

You can set custom rate limits for specific IP addresses or CIDR ranges:

1. Navigate to **Settings** → **Network Access**
2. In the **Custom Rate Limits** section:
   - Enter the IP or CIDR range (e.g., `10.0.0.0/8`)
   - Provide a description (e.g., "Internal Network")
   - Set requests per minute (e.g., 300)
   - Click **Add**

#### Example Rate Limit Configuration

| Network | Description | Requests/Minute |
|---------|-------------|----------------|
| (Default) | All unspecified networks | 30 |
| 10.0.0.0/8 | Internal Network | 300 |
| 203.0.113.0/24 | Office Network | 100 |
| 8.8.8.8 | Specific External Partner | 50 |

#### Category-Specific Rate Limits

Different endpoint categories have different default rate limits:

| Category | Default Limit | Internal Multiplier | Notes |
|----------|---------------|---------------------|-------|
| Standard API | 100 req/min | Configurable | General API endpoints |
| Authentication | 20 req/min | 2x | More strict to prevent brute force |
| ML Processing | 10 req/min | Configurable | Resource-intensive operations |
| Agent API | 30 req/min | Configurable | AI agent interactions |
| PDF Processing | 5 req/10 min | Configurable | Very resource-intensive |

## Technical Implementation

### Core Components

1. **UI Components**
   - Network Access Panel in the admin dashboard
   - Internal networks configuration
   - API endpoint access controls
   - Rate limit management

2. **Server-Side Models**
   - `InternalNetwork` - Stores CIDR ranges for internal networks
   - `EndpointAccessRule` - Maps endpoints to their access permissions
   - `RateLimitSettings` - Stores default rate limits
   - `CustomRateLimit` - Stores network-specific rate limits

3. **Middleware**
   - Authorization middleware with network source checks
   - Rate limiting middleware with source-based limits

### Database Schema

```sql
-- Internal Networks
CREATE TABLE internal_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidr VARCHAR(255) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Endpoint Access Rules
CREATE TABLE endpoint_access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  allow_internal BOOLEAN DEFAULT TRUE,
  allow_external BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(path, method)
);

-- Rate Limit Settings
CREATE TABLE rate_limit_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_requests_per_minute INTEGER NOT NULL DEFAULT 30,
  auth_multiplier FLOAT NOT NULL DEFAULT 0.66,
  ml_multiplier FLOAT NOT NULL DEFAULT 0.33,
  agent_multiplier FLOAT NOT NULL DEFAULT 1.0,
  pdf_multiplier FLOAT NOT NULL DEFAULT 0.16,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Custom Rate Limits
CREATE TABLE custom_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network VARCHAR(255) NOT NULL,
  description VARCHAR(255),
  requests_per_minute INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(network)
);
```

### Network Source Detection

The system uses the client's IP address to determine if a request is coming from an internal or external network:

```typescript
function isInternalRequest(req: Request): boolean {
  const clientIP = req.ip || req.socket.remoteAddress;
  
  // Get internal networks from database
  const internalNetworks = getInternalNetworksFromDatabase();
  
  // Check if the IP matches any internal network
  return internalNetworks.some(network => isInCIDR(clientIP, network.cidr));
}

// Check if IP is in a CIDR range
function isInCIDR(ip: string, cidr: string): boolean {
  // IP validation and CIDR matching logic
}
```

### Authorization Middleware

The authorization middleware is extended to check network source alongside user roles:

```typescript
export const authorize = (options: { 
  roles?: string[], 
  accessType?: NetworkAccessType 
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // First check user authentication (done by preceding authMiddleware)
    
    // Then check role-based permissions
    if (options.roles && !hasRequiredRole(req.user, options.roles)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }
    
    // Then check network-based access
    if (options.accessType === NetworkAccessType.INTERNAL_ONLY) {
      // Get endpoint rule from database
      const endpointRule = await getEndpointRule(req.path, req.method);
      
      // If rule exists, check if external access is allowed
      if (endpointRule && !endpointRule.allowExternal && !isInternalRequest(req)) {
        return next(new AuthorizationError('This endpoint is only accessible from internal networks'));
      }
    }
    
    next();
  };
};
```

### Rate Limiting Implementation

The rate-limiting middleware dynamically applies limits based on the source network:

```typescript
export const createRateLimiter = (options: RateLimiterOptions) => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: async (req) => {
      const clientIP = req.ip || req.socket.remoteAddress;
      
      // Get rate limit settings
      const settings = await getRateLimitSettings();
      
      // Check for custom rate limit for this IP
      const customLimit = await getCustomRateLimit(clientIP);
      if (customLimit) {
        return customLimit.requestsPerMinute;
      }
      
      // Apply category-specific multiplier
      const baseLimit = settings.defaultRequestsPerMinute;
      switch (options.category) {
        case 'auth':
          return baseLimit * settings.authMultiplier;
        case 'search':
          return baseLimit * settings.searchMultiplier;
        case 'admin':
          return baseLimit * settings.adminMultiplier;
        case 'api':
          return baseLimit * settings.apiMultiplier;
        default:
          return baseLimit * settings.standardMultiplier;
      }
    },
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
};
```

### Request Flow

When a request reaches the server:

1. **IP Source Detection**:
   - Extract the client IP (considering proxy headers if configured)
   - Check if the IP falls within any defined internal network CIDR ranges
   - Categorize the request as either internal or external

2. **Network Access Check**:
   - For endpoints marked as internal-only, verify the request comes from an internal network
   - For endpoints marked as external-only, verify the request comes from an external network
   - Deny access with 403 Forbidden if the network source doesn't match requirements

3. **Rate Limit Application**:
   - Check if the client IP matches any custom rate limit configuration
   - If found, apply the custom rate limit
   - If not, apply the default rate limit with appropriate category multiplier
   - Track request counts in a sliding 1-minute window
   - Return 429 Too Many Requests if the limit is exceeded

### Default Configuration

The system is deployed with sensible defaults:

1. **Default Internal Networks**
   - 127.0.0.1/8 (Localhost)
   - 10.0.0.0/8 (Private Class A)
   - 172.16.0.0/12 (Private Class B)
   - 192.168.0.0/16 (Private Class C)

2. **Default Rate Limits**
   - Default: 30 requests per minute
   - Internal networks: 300 requests per minute

3. **Default Access Rules**
   - Public endpoints: Internal & External access
   - Admin endpoints: Internal-only access
   - Sensitive operations: Internal-only access

### Environment Configuration

For deployment environments, network settings can be configured via environment variables:

```
# .env file
INTERNAL_NETWORKS=127.0.0.1/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
TRUST_PROXY=true
```

## Usage Examples

### Example 1: Protecting Sensitive Operations

By default, sensitive operations like clearing analytics data are recommended to be internal-only. However, if your organization needs to allow trusted external partners to perform these operations:

1. Navigate to Settings > Network Access in the admin panel
2. Find the "Clear analytics data" endpoint (`/api/admin/analytics/data`)
3. Enable the "External Access" toggle
4. Click "Save Network Settings"

The endpoint will immediately become accessible from external networks (subject to proper authentication and authorization).

### Example 2: Restricting Public Endpoints

Conversely, you may want to restrict normally public endpoints to internal access only:

1. Navigate to Settings > Network Access in the admin panel
2. Find the endpoint you want to restrict (e.g., `/api/materials`)
3. Disable the "External Access" toggle
4. Click "Save Network Settings"

The endpoint will immediately become inaccessible from external networks.

### Example 3: Setting Up Development Access

For a development team working both in-office and remotely:

1. Add the office network CIDR to internal networks (e.g., `203.0.113.0/24`)
2. Add the VPN IP range to internal networks (e.g., `198.51.100.0/24`)
3. Set admin functionality to internal-only access
4. Configure a higher rate limit for the development networks

### Example 4: External API Partner Access

For third-party services that need higher rate limits:

1. Identify the IP addresses used by the partner service
2. Add a custom rate limit specific to those IPs
3. Monitor usage patterns to detect anomalies
4. Consider requiring additional authentication for sensitive operations

## Best Practices

1. **Use Defense in Depth**
   - Network access controls should complement, not replace, proper authentication and authorization
   - Important operations should require both proper permissions AND appropriate network source

2. **Don't Block by Default**
   - Let administrators control access through the admin panel
   - Register all endpoints with the access control system
   - Use appropriate access types for sensitive operations
   - Document the access requirements for each endpoint

3. **Review Access Settings Regularly**
   - Audit network access settings periodically as part of security review
   - Temporary access changes should be reverted when no longer needed

4. **Document Custom Configurations**
   - Keep notes on why certain endpoints differ from the recommended access settings
   - Include review dates for sensitive access changes

5. **Default to Restrictive**
   - Set sensitive endpoints to internal-only by default, only opening them when necessary
   - Use internal-only for:
     - Data deletion operations
     - System configuration changes
     - User management operations
     - Backup/restore operations

6. **Run the Setup Script**
   - Run the setup script after adding new endpoints
   - Check the Admin Panel to verify that your endpoints appear

## Developer Guidelines

### Adding New Endpoints

When adding new API endpoints, follow these steps to ensure they are properly registered with the access control system:

1. Create your route file and define your endpoints as usual
2. Use the `authorize` middleware with the appropriate `NetworkAccessType`:

```typescript
// Example: Internal-only endpoint
router.post('/admin/sensitive-operation', 
  authMiddleware, 
  authorize({ 
    roles: ['admin'], 
    accessType: NetworkAccessType.INTERNAL_ONLY 
  }), 
  asyncHandler(adminController.performSensitiveOperation)
);

// Example: External-allowed endpoint
router.get('/public-data', 
  authMiddleware, 
  authorize({ 
    roles: ['user'], 
    accessType: NetworkAccessType.EXTERNAL_ALLOWED 
  }), 
  asyncHandler(publicController.getPublicData)
);
```

3. Run the setup script to register the endpoint:

```bash
# From the project root
cd packages/server
yarn run-script setup-api-access-control
```

4. Verify that your endpoint appears in the admin panel

### Recommended Access Types

| Endpoint Category | Recommended Access Type | Rationale |
|-------------------|-------------------------|-----------|
| User authentication | External | Required for initial access |
| Data viewing | External | Core application functionality |
| Data creation/updating | External | Core application functionality |
| Admin dashboards | External | Allow admins to access from anywhere |
| System configuration | Internal | Protect sensitive configuration |
| Data deletion | Internal | Protect against data loss |
| Backup/restore | Internal | Protect system integrity |
| User management | Internal | Protect user security |

### Scripts and Utilities

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

## Troubleshooting

### Common Issues

#### Access Denied Unexpectedly

**Symptoms**:
- User receives "Network Access Denied" error
- Endpoint is inaccessible from expected location

**Potential Causes and Solutions**:
1. **Client IP not recognized as internal**
   - Verify the client IP address in logs
   - Check that the client's network is included in the internal networks configuration
   - Add the client's network to the internal networks list if appropriate

2. **Endpoint access configuration**
   - Verify the endpoint's access type configuration
   - Check that the endpoint is configured to allow access from the client's network
   - Update the endpoint's access configuration if necessary

3. **Proxy configuration**
   - If behind a proxy, verify that the TRUST_PROXY setting is enabled
   - Check that the X-Forwarded-For header is properly set
   - Verify that trusted proxies are correctly configured

#### Rate Limiting Issues

**Symptoms**:
- User receives "Too Many Requests" error
- Multiple users sharing an IP address hit limits too quickly

**Potential Causes and Solutions**:
1. **Default rate limit too low**
   - Increase the default rate limit in the admin panel
   - Configure custom rate limits for specific networks
   - Adjust category multipliers for specific endpoint types

2. **Multiple users sharing an IP**
   - Set up custom rate limits for shared IPs
   - Consider implementing user-based rate limiting
   - Use token bucket algorithm for more sophisticated rate limiting

3. **Legitimate high volume usage**
   - Identify high-volume use cases
   - Configure custom rate limits for specific networks
   - Consider implementing API keys for fine-grained control

#### Configuration Not Taking Effect

**Symptoms**:
- Changes to network access settings do not take effect
- Rate limit changes are not applied

**Potential Causes and Solutions**:
1. **Caching issues**
   - Verify that the configuration has been properly saved
   - Check that the cache is properly invalidated
   - Restart the server if necessary

2. **Environment variables overriding settings**
   - Check environment variables in deployment environments
   - Ensure that INTERNAL_NETWORKS is not overriding database settings
   - Update environment variables if necessary

### Diagnostic Utilities

1. **Network Test Endpoint**: In development mode, use the `/api/admin/network-test` endpoint to verify network detection

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

2. **Logging**: Enable detailed logging for network access and rate limiting:

```typescript
// In your .env file
LOG_LEVEL=debug
NETWORK_ACCESS_LOGGING=true
RATE_LIMIT_LOGGING=true
```

3. **Check for unregistered endpoints**:

```bash
# From the project root
cd packages/server
yarn run-script check-unregistered-endpoints
```

## Security Considerations

### Defense in Depth

Network-based access control should be considered one layer in a defense-in-depth strategy:

- Authentication verifies the user's identity
- Authorization checks the user's permissions
- Network access control validates the request's origin
- Rate limiting prevents abuse

Even if a user has proper credentials, they cannot access internal-only endpoints from external networks.

### IP Spoofing Protection

The system is designed to properly handle proxy headers while protecting against IP spoofing:

- X-Forwarded-For headers are only trusted when the TRUST_PROXY setting is enabled
- Only trusted proxies can set the X-Forwarded-For header
- The system validates the client IP address before using it for access control

### Fail-Secure Default

The system defaults to treating requests as external if network determination fails, providing a fail-secure approach:

- Errors in network detection result in treating the request as external
- Sensitive endpoints are protected by default
- Critical endpoints are recommended to be internal-only

### Comprehensive Logging

All access attempts are logged, especially denied attempts:

- Logs include source IP, requested endpoint, and reason for denial
- Rate limit breaches are logged with details
- Security events are flagged for monitoring

## Testing

### Testing Network Access Controls

1. **Internal Network Tests**:
   - Test from within the internal network
   - Verify access to both internal-only and external-allowed endpoints

2. **External Network Tests**:
   - Test from external networks (e.g., public internet)
   - Verify access to external-allowed endpoints
   - Verify denial of access to internal-only endpoints

3. **Edge Cases**:
   - Test with VPN connections
   - Test with various proxy configurations
   - Test boundary conditions of CIDR ranges

## API Reference

For a complete list of API endpoints and their recommended access settings, refer to the [API Reference](./api-reference.md) documentation.

## Extending the System

The network access control system is designed to be extensible:

1. **Additional Access Types**:
   - The system can be extended to support more granular access types beyond internal/external

2. **Dynamic Configuration**:
   - Advanced implementations could adjust access rules based on time of day, system load, etc.

3. **Integration with Security Systems**:
   - The system can be integrated with threat detection systems
   - Could implement automatic blacklisting of suspicious IPs

4. **Future Enhancements**:
   - Geo-Based Restrictions: Add support for restricting access based on geographic location
   - Time-Based Restrictions: Add support for restricting access based on time of day
   - Advanced Rate Limiting: Add support for token bucket or leaky bucket algorithms
   - Request Pattern Detection: Add anomaly detection to identify unusual request patterns
   - Dynamic Rate Limiting: Adjust rate limits based on system load or other factors