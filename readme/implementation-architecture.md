# Network Access Control System - Architecture Overview

## System Architecture

The network access control system has been implemented as a fully configurable, database-driven solution with the following key components:

```
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│  Admin Interface  │────>│   Database Layer  │<────│  API Middleware   │
│                   │     │                   │     │                   │
│ • Network Config  │     │ • Internal IPs    │     │ • Request Source  │
│ • Endpoint Access │<───>│ • Endpoint Rules  │<───>│ • Access Control  │
│ • Rate Limits     │     │ • Rate Limits     │     │ • Rate Limiting   │
└───────────────────┘     └───────────────────┘     └───────────────────┘
```

### 1. Admin Interface

The **NetworkAccessPanel** component provides administrators with a comprehensive UI to configure:

- **Internal Networks**: Define which CIDR ranges/IPs are considered "internal"
- **API Endpoint Access**: Toggle internal/external access for each endpoint  
- **Rate Limits**: Configure default and custom rate limits based on source networks

This interface is accessible through **Settings → Network Access** in the admin panel.

### 2. Database Layer

All configuration is stored in the database to enable runtime changes without code modifications:

- **Internal Networks Table**: Lists CIDR ranges considered internal
- **Endpoint Access Rules Table**: Maps endpoints to their access permissions
- **Rate Limit Settings Table**: Stores default and custom rate limit configurations

### 3. API Middleware Layer

The middleware layer enforces the configured rules:

- **Source Detection**: Identifies if a request comes from an internal network
- **Access Control**: Validates if the requested endpoint allows access from the source
- **Rate Limiting**: Applies appropriate rate limits based on source network

## Request Flow

When a request arrives at the API:

1. The **source IP** is extracted and checked against the list of internal networks
2. The **requested endpoint** is matched against the endpoint access rules
3. Access is granted or denied based on the endpoint's configuration for the source type
4. If access is granted, **rate limits** are applied based on the source network
5. Finally, normal authentication and authorization checks are performed

## Key Features

### Fully Configurable Access Controls

All access control settings are stored in the database and configurable through the admin interface:

- No endpoints have hardcoded access restrictions
- Changes take effect immediately without requiring code changes or deployment
- Full audit trail of configuration changes

### Network-Based Rate Limiting

The system includes sophisticated rate limiting based on network source:

- **Default Rate Limit**: Applied to all unrecognized networks (default: 30 req/min)
- **Custom Rate Limits**: Higher limits for internal networks, lower for specific external IPs
- **Per-Endpoint Category Limits**: Different rate limits for different endpoint categories

### Admin Interface Integration

The admin interface seamlessly integrates with existing admin panels:

- **Network Configuration Tab**: Manage internal network CIDR ranges
- **API Endpoint Table**: Searchable table with toggles for internal/external access
- **Rate Limit Configuration**: UI for managing default and custom rate limits

## Configuration Examples

### Define Internal Networks

```
127.0.0.1/8     (Localhost)
10.0.0.0/8      (Private network)
172.16.0.0/12   (Private network)
192.168.0.0/16  (Private network)
203.0.113.0/24  (Office network)
```

### API Endpoint Configuration

| Endpoint | Method | Default Access | Description |
|----------|--------|---------------|-------------|
| `/api/users` | GET | Internal Only | List all users |
| `/api/analytics/data` | DELETE | Internal Only | Clear analytics data |
| `/api/materials` | GET | Internal & External | Get materials list |

### Rate Limit Configuration

| Network | Description | Requests/Minute |
|---------|-------------|----------------|
| Default | All undefined networks | 30 |
| 10.0.0.0/8 | Internal Network | 300 |
| 203.0.113.0/24 | Office Network | 100 |
| 8.8.8.8 | Specific External IP | 10 |

## Implementation Details

The entire system is implemented with minimal changes to the existing codebase:

1. **Extended Authorization**: Built on top of the existing authentication system
2. **Database-Driven Configuration**: All settings stored in database tables
3. **Middleware Integration**: Seamlessly integrates with the existing middleware chain
4. **React Admin UI**: Clean, user-friendly interface for administrators

See the API Reference document for a complete list of endpoints with their default access configurations.