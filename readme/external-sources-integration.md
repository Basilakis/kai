# External Sources Integration

## Overview
The external sources integration provides a flexible system for connecting with various material databases and sources. Dynamic configuration through the admin panel has been fully implemented with real API connections, replacing all mock implementations.

## Features
- Dynamic source configuration through admin panel with real API connections
- Multiple authentication methods (Basic, OAuth2, API Key, Bearer Token)
- Configurable endpoints and data mappings
- Real-time sync status monitoring
- Automatic entity linking
- Caching with TTL support

## Available Authentication Methods
- `basic`: Username and password authentication
- `oauth2`: OAuth 2.0 flow with access/refresh tokens
- `api_key`: Single API key authentication
- `api_key_secret`: API key + secret pair
- `bearer`: Bearer token authentication
- `custom`: Custom authentication schemes with real API handling

## Adding a New Source
1. Navigate to the Admin Panel > External Sources
2. Click "Add Source"
3. Configure the source:
   - Name and description
   - Base URL and authentication
   - Endpoint configurations
   - Data field mappings
   - Sync interval settings

## Endpoint Configuration
Each source requires endpoint configurations:
```json
{
  "search": {
    "path": "/api/search",
    "method": "GET",
    "description": "Search materials"
  },
  "material": {
    "path": "/api/materials/{id}",
    "method": "GET",
    "description": "Get material by ID"
  }
}
```

## Data Mapping
Define how external data maps to internal fields:
```json
{
  "idField": "material.id",
  "nameField": "material.name",
  "descriptionField": "material.description",
  "propertiesMap": {
    "density": "properties.density",
    "color": "properties.color"
  }
}
```

## Sync Process
1. Source is validated on creation with real API connection test
2. Sync runs based on configured interval using real API calls
3. New/updated materials are imported through actual API endpoints
4. Entity linking detects relationships between imported materials
5. Real-time events notify admin panel of sync status and results

## Admin Panel Features
- Source management (CRUD operations)
- Sync status monitoring
- Statistics tracking:
  - Total materials
  - Last sync duration
  - Success/failure rate
  - Materials created/updated
- Error logging and reporting

## Example: Adding MatWeb Integration
1. Add new source in admin panel
2. Configure endpoints:
   - Base URL: https://api.matweb.com
   - Search: /api/v2/search
   - Material: /api/v2/materials/{id}
3. Set up API key authentication with your MatWeb API credentials
4. Configure data mappings between MatWeb fields and internal schema
5. Set sync interval (recommended: 24 hours for full sync)
6. Enable and test connection using the "Test Connection" button which performs a real API call

> **Note**: All mock implementations previously used for development have been replaced with actual API connections. The system now performs real HTTP requests to external material databases.

## Using the Unified Search API for External Integrations

Our system now provides a unified search API endpoint that significantly simplifies integration for third-party developers. Rather than having to learn multiple resource-specific endpoints, all search operations can be conducted through a single endpoint:

```
GET /search
POST /search
```

### Key Benefits for Integration Partners

- **Reduced API Surface**: Developers only need to learn one endpoint pattern instead of multiple resource-specific endpoints
- **Consistent Parameter Structure**: Same parameter format works across all resource types
- **Flexible Filtering**: Support for all metadata fields as filter parameters
- **Future-Proof**: New resource types are automatically supported without API changes
- **Simplified SDK Development**: Client libraries can be dramatically simplified

### Integration Example

To search for materials from an external system:

```
GET /search?type=materials&query=ceramic&materialType=tile&limit=10
```

To retrieve user history data:

```
GET /search?type=history&userId=user-123&limit=25&sort=createdAt:desc
```

For complex queries, the POST endpoint provides more flexibility:

```json
POST /search
{
  "type": "materials",
  "query": "wood",
  "filter": {
    "materialType": "flooring",
    "price": { "min": 20, "max": 50 },
    "tags": ["sustainable", "natural"]
  },
  "sort": { "price.value": "asc" },
  "limit": 20
}
```

### Available Resource Types

The unified search API supports the following resource types:
- `materials`: Material catalog entries
- `collections`: Material collections 
- `history`: Recognition history
- `models`: AI models (admin only)
- `datasets`: Training datasets (admin only)
- `jobs`: Processing jobs (admin only)

### Authentication 

The unified search API follows the same authentication rules as other endpoints:
- Public resources: No authentication required
- Protected resources: Bearer token required
- Admin resources: Admin privileges required

### Documentation

For full details on the unified search API, including parameter reference and response formats, see the [API Reference](./api-reference.md#unified-search-api).

## Best Practices
1. Start with small sync intervals for testing
2. Monitor error logs for issues
3. Use caching for frequently accessed data
4. Configure proper timeouts
5. Set up error notifications
6. Use the unified search API for all search/filter operations

## Troubleshooting
1. Check source configuration
2. Verify authentication settings
3. Monitor sync logs
4. Check rate limits
5. Validate data mappings

## Security Considerations
- API keys and secrets are encrypted
- OAuth tokens are automatically refreshed
- Rate limiting is enforced
- Error logs exclude sensitive data