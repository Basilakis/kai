# External Sources Integration

## Overview
The external sources integration provides a flexible system for connecting with various material databases and sources. Instead of hardcoded integrations, the system now supports dynamic configuration through the admin panel.

## Features
- Dynamic source configuration through admin panel
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
- `custom`: Custom authentication schemes

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
1. Source is validated on creation
2. Sync runs based on configured interval
3. New/updated materials are imported
4. Entity linking detects relationships
5. Real-time events notify admin panel

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
3. Set up API key authentication
4. Configure data mappings
5. Set sync interval
6. Enable and test connection

## Best Practices
1. Start with small sync intervals for testing
2. Monitor error logs for issues
3. Use caching for frequently accessed data
4. Configure proper timeouts
5. Set up error notifications

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