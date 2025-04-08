# Network Access Control System

## Overview

The Network Access Control system in the Kai platform provides a robust security layer that restricts sensitive operations to internal networks only. This document explains how the system works, how to configure it, and implementation details for developers.

## Core Concepts

### Access Types

Endpoints in the Kai API are classified into two main access types:

1. **Internal-Only**: Restricted to requests originating from authorized internal networks
   - Example: Deleting analytics data, system backup operations, configuration updates
   - Provides protection for sensitive administrative functions

2. **External-Allowed**: Accessible from both internal and external networks
   - Example: User authentication, material search, recognition
   - Standard user-facing functionality

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

### Admin Configuration Interface

Administrators can configure network access through the Network Access tab in the admin settings panel:

1. **Internal Networks Management**
   - Define which CIDR ranges are considered "internal" networks
   - Add, edit, or remove internal network definitions
   - Provide descriptions for each network range

2. **Endpoint Access Control Table**
   - Complete table of all API endpoints with toggles for internal and external access
   - Search and filter capabilities to quickly find specific endpoints
   - Bulk update options for changing multiple endpoint settings at once

3. **Real-time Updates**
   - All changes take effect immediately without requiring server restarts
   - No code deployment needed to change access settings

## How It Works

### Technical Implementation

1. **Database-Driven Configuration**
   - Internal network definitions stored in `internal_networks` table
   - Endpoint access rules stored in `endpoint_access_rules` table
   - Default settings provided for new installations

2. **Request Processing**
   - Each incoming request is checked against the defined internal networks
   - The endpoint being accessed is matched against the configured rules
   - Access is granted or denied based on the current configuration

3. **No Hardcoded Restrictions**
   - No endpoint has its access level hardcoded in the source code
   - The middleware simply enforces whatever rules are in the database
   - Default settings are applied only during initial setup

### Example Configuration

#### Internal Networks

| CIDR Range | Description |
|------------|-------------|
| 127.0.0.1/8 | Localhost |
| 10.0.0.0/8 | Corporate Office Network |
| 172.16.0.0/12 | Development VPN |
| 192.168.0.0/16 | Remote Worker VPN |

#### Example Endpoint Configuration

| Endpoint | Method | Description | Internal Access | External Access |
|----------|--------|-------------|-----------------|-----------------|
| /api/analytics/track | POST | Track analytics event | Enabled | Enabled |
| /api/admin/analytics/data | DELETE | Clear analytics data | Enabled | Disabled* |
| /api/materials | GET | Get all materials | Enabled | Enabled |

\* *This setting can be changed through the admin interface if needed*

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

## Best Practices

1. **Use Defense in Depth**
   - Network access controls should complement, not replace, proper authentication and authorization
   - Important operations should require both proper permissions AND appropriate network source

2. **Review Access Settings Regularly**
   - Audit network access settings periodically as part of security review
   - Temporary access changes should be reverted when no longer needed

3. **Document Custom Configurations**
   - Keep notes on why certain endpoints differ from the recommended access settings
   - Include review dates for sensitive access changes

## Troubleshooting

### Access Denied Issues

If users report "Network Access Denied" errors:

1. Check if they are connecting from an internal or external network
2. Review the endpoint's current access settings in the admin panel
3. Consider temporarily adding their network to the internal networks list if appropriate
4. Check logs for the specific request details

### Admin Dashboard

Administrators can configure network access settings through the Admin Dashboard:

1. Navigate to **Settings** > **Network Access**
2. Configure internal networks:
   - Add CIDR ranges for corporate networks, VPNs, etc.
   - Provide descriptions for easy identification
   - Remove ranges that should no longer be considered internal

3. Configure endpoint access permissions:
   - View all API endpoints in a searchable, filterable table
   - Toggle internal/external access for each endpoint
   - Bulk update options for multiple endpoints

### Environment Configuration

For deployment environments, network settings can be configured via environment variables:

```
# .env file
INTERNAL_NETWORKS=127.0.0.1/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
TRUST_PROXY=true
```

## Implementation Details

### Technical Architecture

The network access control system is implemented as part of the authentication and authorization middleware:

1. **Request Processing Flow**:
   - Request arrives at the server
   - IP address is extracted (with proxy handling if needed)
   - IP is checked against configured internal network ranges
   - Request is marked as internal or external
   - Endpoint access restrictions are checked
   - Request is allowed or denied based on network source and endpoint configuration

2. **Database Schema**:
   - `internal_networks` table: Stores CIDR ranges and descriptions
   - `endpoint_access_rules` table: Maps endpoints to access types

### Security Considerations

1. **Defense in Depth**:
   - Network access control complements authentication and authorization
   - Even if a user has proper credentials, they cannot access internal-only endpoints from external networks

2. **IP Spoofing Protection**:
   - System properly handles X-Forwarded-For headers when trusted proxies are used
   - Configuration option to specify which proxies to trust

3. **Fail-Secure Default**:
   - System defaults to treating requests as external if network determination fails
   - Critical endpoints are protected by default configuration

4. **Comprehensive Logging**:
   - All access attempts are logged, especially denied attempts
   - Logs include source IP, requested endpoint, and reason for denial

## Developer Guidelines

### Adding New Endpoints

When adding new API endpoints, determine the appropriate access type:

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

## Troubleshooting

### Common Issues

1. **Access Denied Unexpectedly**:
   - Verify the client IP address in logs
   - Check that the client's network is included in the internal networks configuration
   - Verify the endpoint's access type configuration

2. **Internal Networks Not Recognized**:
   - Check the CIDR format and syntax
   - Verify proxy settings if behind a load balancer or proxy

3. **Configuration Not Taking Effect**:
   - Check that the configuration has been properly saved
   - Verify environment variables in deployment environments
   - Restart services if necessary

## API Reference

For a complete list of API endpoints and their access types, refer to the [API Reference Documentation](./api-reference.md).

## Extending the System

The network access control system is designed to be extensible:

1. **Additional Access Types**:
   - The system can be extended to support more granular access types beyond internal/external

2. **Dynamic Configuration**:
   - Advanced implementations could adjust access rules based on time of day, system load, etc.

3. **Integration with Security Systems**:
   - The system can be integrated with threat detection systems
   - Could implement automatic blacklisting of suspicious IPs