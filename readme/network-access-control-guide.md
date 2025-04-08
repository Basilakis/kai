# Network Access Control Guide

## Overview

The Kai platform includes a comprehensive network access control system that allows administrators to define which API endpoints can be accessed from internal versus external networks. This system adds an additional layer of security beyond authentication and authorization, protecting sensitive operations from external access.

**Important Note**: All access controls are configured through the admin interface and stored in the database. No endpoints have hardcoded access restrictions.

## Key Features

1. **Internal Network Definition**: Define specific IP addresses and CIDR ranges as "internal networks"
2. **Configurable Endpoint Access**: Set access permissions for each API endpoint individually 
3. **Network-Based Rate Limiting**: Configure different rate limits for different networks
4. **Admin Panel Integration**: Manage all settings through a user-friendly admin interface

## Accessing Network Settings

Network access settings are available in the admin panel under **Settings** → **Network Access**. This section is only accessible to users with administrator privileges.

## Configuring Internal Networks

### What Are Internal Networks?

Internal networks are IP addresses or CIDR ranges that are considered trusted. Requests originating from these networks can access endpoints marked as "internal-only". Typical internal networks include:

- Corporate office networks
- VPN connections
- Development environments
- Cloud infrastructure in the same private network

### Adding Internal Networks

1. Navigate to **Settings** → **Network Access**
2. In the **Internal Networks** section, enter a CIDR range (e.g., `10.0.0.0/8`)
3. Click **Add**
4. The network will appear in the list of internal networks

### Example Internal Networks

| Network | Description |
|---------|-------------|
| 127.0.0.1/8 | Localhost |
| 10.0.0.0/8 | Private network class A |
| 172.16.0.0/12 | Private network class B |
| 192.168.0.0/16 | Private network class C |
| 203.0.113.0/24 | Office network (example) |

### Removing Internal Networks

To remove a network from the internal networks list:

1. Find the network in the list
2. Click the trash icon next to the network
3. The network will be removed immediately

## Configuring API Endpoint Access

### Access Types

Each API endpoint can be configured with the following access types:

- **Internal And External Access**: The endpoint can be accessed from any network (default for most endpoints)
- **Internal-Only Access**: The endpoint can only be accessed from defined internal networks
- **External-Only Access**: The endpoint can only be accessed from external networks (rare)

### Configuring Endpoint Access

1. Navigate to **Settings** → **Network Access**
2. In the **API Endpoint Access Control** section, you'll see a table of all API endpoints
3. Use the checkboxes to control access:
   - **Internal Access**: Check to allow access from internal networks
   - **External Access**: Check to allow access from external networks

### Filtering and Searching Endpoints

For easier management of large numbers of endpoints:

- Use the search box to find specific endpoints by path, method, or description
- Use the filters to show only internal-only or external-allowed endpoints

### Recommended Endpoint Security

While all endpoint access settings are configurable, we recommend the following security best practices:

- Restrict sensitive admin operations to internal-only access
- Allow public-facing endpoints (authentication, content access) from both internal and external networks
- Regularly review access settings, especially after adding new endpoints

## Rate Limiting

The network access control system also includes configurable rate limiting to prevent abuse while allowing appropriate access levels.

### Default Rate Limit

The system has a default rate limit that applies to all requests from non-specified networks. By default, this is set to 30 requests per minute, but it can be configured:

1. Navigate to **Settings** → **Network Access**
2. In the **Rate Limiting** section, adjust the **Default Rate Limit** value
3. Click **Save Network Settings**

### Custom Rate Limits

You can set custom rate limits for specific IP addresses or CIDR ranges:

1. Navigate to **Settings** → **Network Access**
2. In the **Custom Rate Limits** section:
   - Enter the IP or CIDR range (e.g., `10.0.0.0/8`)
   - Provide a description (e.g., "Internal Network")
   - Set requests per minute (e.g., 300)
   - Click **Add**

### Example Rate Limit Configuration

| Network | Description | Requests/Minute |
|---------|-------------|----------------|
| (Default) | All unspecified networks | 30 |
| 10.0.0.0/8 | Internal Network | 300 |
| 203.0.113.0/24 | Office Network | 100 |
| 8.8.8.8 | Specific External Partner | 50 |

### Rate Limit Categories

Different API endpoint categories have different multipliers applied to their rate limits:

| Category | Multiplier | Example (with 30 req/min default) |
|----------|------------|-----------------------------------|
| Standard API | 1x | 30 req/min |
| Authentication | 0.66x | 20 req/min |
| ML Processing | 0.33x | 10 req/min |
| Agent API | 1x | 30 req/min |
| PDF Processing | 0.16x | 5 req/10 min |

## Technical Implementation

### Network Detection

The system determines a request's network source as follows:

1. Extracts the client IP address from the request (considering proxy headers if configured)
2. Checks if the IP falls within any defined internal network CIDR ranges
3. Categorizes the request as either internal or external

### Rate Limit Application

Rate limits are applied as follows:

1. Check if the client IP matches any custom rate limit configuration
2. If found, apply the custom rate limit
3. Otherwise, apply the default rate limit
4. Adjust based on the endpoint category multiplier
5. Track request counts in a time-based window

### Failure Handling

If rate limits are exceeded, the API returns:

- HTTP 429 Too Many Requests status code
- Retry-After header with time (in seconds) until requests can resume
- JSON response with error details and retry information

## Security Considerations

### Defense in Depth

Network-based access control should be considered one layer in a defense-in-depth strategy:

- Authentication verifies the user's identity
- Authorization checks the user's permissions
- Network access control validates the request's origin
- Rate limiting prevents abuse

### Proxy Configurations

If your application is behind load balancers or proxies:

1. Configure `TRUST_PROXY=true` in environment settings
2. Ensure proxy headers (X-Forwarded-For) are properly set
3. Secure your proxy infrastructure against header injection

### VPN Considerations

If users connect through VPNs:

1. Add VPN IP ranges to the internal networks list
2. Consider session persistence for reliable rate limiting
3. Monitor for unusual access patterns that might indicate compromised VPN credentials

## Troubleshooting

### Access Denied Issues

If users report unexpected access denied errors:

1. Check if the user's IP address is correctly identified in logs
2. Verify internal network CIDR ranges are correctly defined
3. Ensure the endpoint has appropriate access settings (internal, external, or both)
4. Check proxy configurations if the application is behind proxies or load balancers

### Rate Limiting Issues

If users experience rate limiting problems:

1. Verify the user's IP address is correctly identified
2. Check if any custom rate limits apply to the user's network
3. Monitor system-wide rate limit counters to identify potential abuse
4. Consider increasing rate limits for legitimate high-volume use cases

## Best Practices

1. **Regular Reviews**: Periodically review internal network definitions and endpoint access settings

2. **Documentation**: Maintain documentation of which endpoints are internal-only and why

3. **Monitoring**: Set up alerts for repeated access attempts from unauthorized sources

4. **Testing**: Test both internal and external access to ensure settings work as expected

5. **Default to Restrictive**: Set sensitive endpoints to internal-only by default, only opening them when necessary

## Example Scenarios

### Setting Up Development Access

For a development team working both in-office and remotely:

1. Add the office network CIDR to internal networks (e.g., `203.0.113.0/24`)
2. Add the VPN IP range to internal networks (e.g., `198.51.100.0/24`)
3. Set admin functionality to internal-only access
4. Configure a higher rate limit for the development networks

### Protecting Sensitive Operations

To secure sensitive administrative operations:

1. Identify all endpoints that can modify system data or settings
2. Set these endpoints to internal-only access
3. Configure strict rate limits on these endpoints, even for internal access
4. Enable comprehensive logging for access attempts

### External API Partner Access

For third-party services that need higher rate limits:

1. Identify the IP addresses used by the partner service
2. Add a custom rate limit specific to those IPs
3. Monitor usage patterns to detect anomalies
4. Consider requiring additional authentication for sensitive operations

## Further Information

For more details on the API endpoints and their recommended access settings, please refer to the [API Reference](api-reference.md) documentation.

For technical implementation details, see the [Network Access Control Implementation](network-access-implementation-final.md) documentation.