# Network Access Control Implementation

## Overview

This document details the implementation of the network access control system in the Kai platform. The system allows administrators to:

1. Define which IP addresses/ranges are considered "internal" networks
2. Configure which API endpoints are accessible from internal vs. external networks
3. Set custom rate limits based on source network

This implementation provides a flexible, database-driven approach with no hardcoded restrictions, allowing complete configurability through the admin interface.

## Architecture

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

## Database Schema

### Internal Networks

```typescript
interface InternalNetwork {
  id: string;
  cidr: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Endpoint Access Rules

```typescript
interface EndpointAccessRule {
  id: string;
  path: string;
  method: string;
  allowInternal: boolean;
  allowExternal: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Rate Limit Settings

```typescript
interface RateLimitSettings {
  id: string;
  defaultRequestsPerMinute: number;
  standardMultiplier: number;
  authMultiplier: number;
  searchMultiplier: number;
  adminMultiplier: number;
  apiMultiplier: number;
  updatedAt: Date;
}
```

### Custom Rate Limits

```typescript
interface CustomRateLimit {
  id: string;
  network: string; // CIDR or single IP
  description: string;
  requestsPerMinute: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Network Source Detection

The system uses the client's IP address to determine if a request is coming from an internal or external network:

```typescript
function isInternalRequest(req: Request): boolean {
  const clientIP = req.ip || req.socket.remoteAddress;
  
  // Get internal networks from database
  const internalNetworks = getInternalNetworksFromDatabase();
  
  // Check if the IP matches any internal network
  return internalNetworks.some(network => isInCIDR(clientIP, network.cidr));
}
```

## Authorization Middleware

The authorization middleware is extended to check network source:

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

## Rate Limiting Implementation

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

## Admin UI Implementation

The NetworkAccessPanel component provides a user-friendly interface for configuring all aspects of network access control:

1. **Internal Networks Management**
   - List of current internal network CIDR ranges
   - Form to add new internal networks
   - Option to remove existing networks

2. **API Endpoint Access Control**
   - Table of all API endpoints
   - Toggles for internal/external access
   - Search and filtering capabilities

3. **Rate Limit Configuration**
   - Default rate limit setting
   - Custom rate limits for specific networks
   - Form to add/remove custom rate limits

## Default Configuration

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

## API Endpoints

See [API Endpoints Reference](./api-endpoints-reference.md) for a complete list of all API endpoints with their default access settings and rate limits.

## Security Considerations

1. **Defense in Depth**
   - Network restrictions complement (not replace) authentication and authorization
   - All endpoints still require proper authentication and authorization

2. **Proxy Awareness**
   - System is configured to properly handle proxied requests
   - X-Forwarded-For headers are trusted when appropriate

3. **Fail-Secure Defaults**
   - System defaults to treating requests as external if source cannot be determined
   - Errors in CIDR validation result in requests being treated as external

4. **Logging and Monitoring**
   - All access attempts from unauthorized networks are logged
   - Rate limit threshold breaches are monitored and reported

## How to Modify the System

### Adding New Endpoints

When adding new API endpoints, engineers should:

1. Define the endpoint in the appropriate controller and route file
2. Add the endpoint to the `initalEndpointRules` array in `migrations/network-access.ts`
3. Add documentation to [API Endpoints Reference](./api-endpoints-reference.md)

### Configuring Default Rate Limits

The default rate limits can be adjusted in the settings panel or by modifying the `initialRateLimitSettings` object in `migrations/network-access.ts`.

### Testing Network Restrictions

To test internal-only endpoints:
1. Configure 127.0.0.1/8 as an internal network
2. Make requests from localhost to test internal access
3. Use a proxy or VPN to make requests from external IPs

## Conclusion

This implementation provides a flexible, configurable approach to network-based access control with no hardcoded restrictions. All aspects of the system can be configured through the admin interface without requiring code changes or redeployment.