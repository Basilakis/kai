# Network Access Control Implementation Summary

## Overview

This document provides a technical overview of how network access control and rate limiting is implemented in the Kai platform. The system provides administrators with a flexible way to:

1. Define which IP addresses/CIDR ranges are considered "internal networks"
2. Configure which API endpoints are accessible from internal versus external networks
3. Set custom rate limits based on source networks

## Key Components

### 1. Database Models (NetworkAccess Model)

All network access settings are stored in the database, making them fully configurable without code changes:

- `internal_networks`: Stores CIDR ranges considered "internal" 
- `endpoint_access_rules`: Defines which endpoints can be accessed from internal/external networks
- `rate_limit_settings`: Stores the default rate limit configuration
- `custom_rate_limits`: Defines rate limits for specific IP addresses or CIDR ranges

### 2. Admin UI (NetworkAccessPanel Component)

The admin interface allows configuration of all network access settings through a user-friendly UI:

- **Internal Networks Management**: Add, view, and remove internal network CIDR ranges
- **API Endpoint Access Control**: Toggle internal/external access for each API endpoint
- **Rate Limiting Configuration**:
  - Set the default rate limit (requests per minute)
  - Define custom rate limits for specific networks
  - View and manage custom rate limits

### 3. Network Detection (Network Utils)

The system detects whether a request comes from an internal or external network:

```typescript
// Check if request is from an internal network
function isInternalRequest(req: Request): boolean {
  const clientIP = req.ip || req.socket.remoteAddress;
  const internalNetworks = getInternalNetworksFromDatabase();
  
  return internalNetworks.some(network => isInCIDR(clientIP, network));
}

// Check if IP is in a CIDR range
function isInCIDR(ip: string, cidr: string): boolean {
  // IP validation and CIDR matching logic
}
```

### 4. Authorization Middleware (Extended)

The authorization middleware has been enhanced to check network source alongside user roles:

```typescript
export const authorize = (options: { 
  roles?: string[], 
  accessType?: NetworkAccessType 
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Role-based check
    if (options.roles && !options.roles.includes(req.user.role)) {
      return next(new ApiError(403, `Role (${req.user.role}) is not authorized`));
    }
    
    // Network-based check
    if (options.accessType === NetworkAccessType.INTERNAL_ONLY && !isInternalRequest(req)) {
      return next(new ApiError(403, 'This endpoint is only accessible from internal networks'));
    }
    
    next();
  };
};
```

### 5. Rate Limiting Middleware (Extended)

The rate limiting middleware has been enhanced to apply different rate limits based on source network:

```typescript
function createRateLimiter(category: string) {
  return rateLimit({
    // Get the appropriate rate limit based on source IP
    max: (req, _res) => {
      const clientIP = req.ip || req.socket.remoteAddress;
      const rateLimit = getRateLimitForIP(clientIP, category);
      return rateLimit;
    },
    windowMs: 60 * 1000, // 1 minute
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
  });
}

function getRateLimitForIP(ip: string, category: string): number {
  // Check if IP has a custom rate limit
  const customLimit = findCustomRateLimitForIP(ip);
  if (customLimit) {
    return customLimit;
  }
  
  // Otherwise use the default rate limit with category multiplier
  const defaultLimit = getDefaultRateLimit();
  const categoryMultiplier = getCategoryMultiplier(category);
  return Math.floor(defaultLimit * categoryMultiplier);
}
```

## Database Schema

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

## Request Flow

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

## Default Configuration

The system comes with sensible defaults:

### Default Internal Networks
- 127.0.0.1/8 (Localhost)
- 10.0.0.0/8 (Private network class A)
- 172.16.0.0/12 (Private network class B)
- 192.168.0.0/16 (Private network class C)

### Default Rate Limits
- Default rate: 30 requests per minute
- Authentication endpoints: 20 requests per minute (0.66× multiplier)
- ML processing endpoints: 10 requests per minute (0.33× multiplier)
- Agent API endpoints: 30 requests per minute (1× multiplier)
- PDF processing endpoints: 5 requests per minute (0.16× multiplier)

## Security Considerations

1. **Defense in Depth**: Network controls complement (not replace) authentication and authorization
2. **Fail Securely**: Default to treating requests as external if source determination fails
3. **Proxy Awareness**: Properly configured to handle proxy headers for accurate client IP detection
4. **Comprehensive Logging**: All access attempts, especially denied ones, are logged for audit

## Future Enhancements

1. **Geo-Based Restrictions**: Add support for restricting access based on geographic location
2. **Time-Based Restrictions**: Add support for restricting access based on time of day
3. **Advanced Rate Limiting**: Add support for token bucket or leaky bucket algorithms
4. **Request Pattern Detection**: Add anomaly detection to identify unusual request patterns
5. **Dynamic Rate Limiting**: Adjust rate limits based on system load or other factors

## API Reference

For a complete list of API endpoints with their recommended network access settings, please refer to the [API Reference](api-reference.md) documentation.

For detailed information on the network access control system, see the [Network Access Control Guide](network-access-control-guide.md).