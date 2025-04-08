# Subscription Tier System

## Executive Summary

The Subscription Tier System implements a flexible, module-based access control framework for the Kai platform, enabling tiered pricing with granular feature access. It controls what features users can access based on their subscription level and enforces API usage limits for both internal and external requests.

Key capabilities:
- Multiple pricing tiers with different feature sets
- Module-based access control for granular permission management
- API rate limiting with tier-specific quotas
- Usage tracking and analytics
- Framework for future Stripe integration

![Subscription Tier System Architecture](../docs/images/subscription-tier-system.png)

## System Architecture

The system follows a layered architecture that integrates with existing authentication:

![Subscription System Architecture](../docs/images/subscription-system-architecture.png)

1. **Authentication Layer**: Validates user identity via Supabase Auth
2. **Subscription Layer**: Verifies subscription status and tier permissions
3. **Access Control Layer**: Enforces module-specific permissions
4. **Rate Limiting Layer**: Controls API usage based on tier limits
5. **Analytics Layer**: Tracks usage patterns and subscription metrics

## Core Components

### 1. Subscription Tiers

Subscription tiers define the available plans users can subscribe to. Each tier specifies:

- **Basic Information**: Name, price, description, and visibility (public/private)
- **Module Access**: Which platform modules are enabled for this tier
- **API Limits**: Daily, monthly, and concurrent API request limits

Tiers are stored in the `subscription_tiers` table in Supabase and offer different capability levels:

| Tier | Description | Key Features |
|------|------------|--------------|
| Free | Basic access with limited features | Basic material recognition, limited knowledge base |
| Basic | Standard access for individual users | Material recognition, knowledge base, basic agent access |
| Professional | Advanced access for professionals | All basic features + advanced agents, 3D designer access |
| Enterprise | Full access for organizations | Unlimited access to all features, maximum API limits |
| Custom | Tailored solutions for specific needs | Custom configuration of all modules and limits |

### 2. User Subscriptions

User subscriptions link users to their selected subscription tier and track usage metrics:

- **Subscription Information**: Tier ID, status (active, trialing, canceled, etc.), renewal date
- **Usage Tracking**: API requests count, reset periods, and module-specific usage
- **Billing Details**: Payment method, billing cycle (future Stripe integration)

### 3. Module-Based Access Control

Access to specific platform functionalities is controlled at the module level:

```json
"moduleAccess": [
  { "name": "materialRecognition", "enabled": true },
  { "name": "knowledgeBase", "enabled": true },
  { "name": "agents", "enabled": true },
  { "name": "advancedAgents", "enabled": false },
  { "name": "3dDesigner", "enabled": false },
  { "name": "api", "enabled": false },
  { "name": "pdf", "enabled": true },
  { "name": "crawler", "enabled": false },
  { "name": "mlTraining", "enabled": false }
]
```

This granular approach allows for flexible tier configuration and precise access control.

### 4. API Rate Limiting

The system enforces usage limits based on subscription tier:

- **Daily Limits**: Maximum requests per day
- **Monthly Limits**: Maximum requests per month
- **Concurrent Limits**: Maximum simultaneous requests

Usage is tracked per user and automatically reset on appropriate periods (daily or monthly).

## Backend Implementation

### Models

1. **SubscriptionTier Model** (`packages/server/src/models/subscriptionTier.model.ts`)
   - Core data structure for subscription tiers
   - CRUD operations for tier management
   - Includes price, features, module access permissions, and API limits

2. **UserSubscription Model** (`packages/server/src/models/userSubscription.model.ts`)
   - Links users to subscription tiers
   - Tracks API usage and module access
   - Handles resets for usage limits
   - Provides utility functions for checking permissions and limits

### Middleware

1. **Module Access Middleware** (`packages/server/src/middleware/module-access.middleware.ts`)
   - Verifies module access permissions based on subscription tier
   - Protects routes by checking subscription status
   - Integrates with existing auth middleware

2. **Rate Limiting Middleware** (`packages/server/src/middleware/rate-limit.middleware.ts`)
   - Enforces API request limits based on subscription tier
   - Provides per-user rate limiting with tier-specific quotas
   - Tracks and limits concurrent API usage

### API Routes

1. **Subscription Routes** (`packages/server/src/routes/subscription.routes.ts`)
   - Public endpoints for retrieving available tiers
   - Protected endpoints for managing user subscriptions
   - Admin endpoints for CRUD operations on subscription tiers

### Database Schema

Subscription data is stored in Supabase with these primary tables:

1. **subscription_tiers**
   - id: UUID primary key
   - name: String
   - price: Decimal
   - description: Text
   - isPublic: Boolean
   - moduleAccess: JSONB array
   - apiLimits: JSONB object
   - createdAt: Timestamp
   - updatedAt: Timestamp

2. **user_subscriptions**
   - id: UUID primary key
   - userId: UUID foreign key to users
   - tierId: UUID foreign key to subscription_tiers
   - status: String (active, trialing, canceled, etc.)
   - usage: JSONB object for tracking API usage
   - startDate: Timestamp
   - endDate: Timestamp
   - renewalDate: Timestamp
   - createdAt: Timestamp
   - updatedAt: Timestamp

## Frontend Implementation

### User Interface

1. **User Profile Page** (`packages/client/src/pages/profile.tsx`)
   - Displays current subscription details
   - Shows API usage statistics with visual indicators
   - Lists available modules with access status
   - Allows changing subscription tier

2. **Admin Subscription Management** (`packages/admin/src/pages/subscription-tiers/index.tsx`)
   - CRUD operations for subscription tiers
   - Detailed configuration of module permissions
   - Setting API rate limits
   - Controlling tier visibility

### Navigation

The subscription management functionality is integrated into both user and admin navigation:

- User profile section includes subscription management
- Admin sidebar includes a dedicated "Subscription Tiers" section

## Module Access Control

The system controls access to the following modules:

| Module | Description |
|--------|-------------|
| materialRecognition | Material recognition from images |
| knowledgeBase | Knowledge base search and access |
| agents | Basic agent access (Material Expert) |
| advancedAgents | Advanced specialized agents |
| 3dDesigner | 3D visualization and design tools |
| api | External API access |
| pdf | PDF processing and extraction |
| crawler | Web crawler functionality |
| mlTraining | ML model training capabilities |

## API Usage Tracking

API usage is tracked at multiple levels:

1. **Request Counting**
   - Increments usage counters for both internal and external API requests
   - Resets based on configured periods (daily/monthly)

2. **Usage Visualization**
   - Provides users with visual indicators of their usage
   - Shows remaining quota and reset dates

3. **Rate Limiting**
   - Enforces tier-specific request limits
   - Returns appropriate error responses when limits are exceeded

## Future Stripe Integration

The system is designed for future integration with Stripe for payment processing:

1. **Billing Information**
   - User subscription will store payment method details
   - Support for recurring billing cycles

2. **Subscription Management**
   - Handling tier upgrades/downgrades
   - Prorated billing for mid-cycle changes
   - Free trial periods with automatic conversion

3. **Webhook Integration**
   - Handling Stripe events (successful payments, failed payments, etc.)
   - Automatic subscription status updates

## Authentication Integration

The subscription system integrates with the existing Supabase authentication:

1. **User Registration**
   - New users automatically get a free tier subscription
   - Option to upgrade during registration

2. **Access Control**
   - JWT tokens include subscription information
   - Auth middleware works with module access middleware

## Implementation Guides

### Creating a New Subscription Tier

```typescript
// Example: Creating a new tier
const newTier = {
  name: "Premium",
  price: 29.99,
  isPublic: true,
  description: "Premium access with advanced features",
  moduleAccess: [
    { name: "materialRecognition", enabled: true },
    { name: "knowledgeBase", enabled: true },
    { name: "agents", enabled: true },
    { name: "advancedAgents", enabled: true },
    { name: "3dDesigner", enabled: true },
    { name: "api", enabled: true },
    { name: "pdf", enabled: true },
    { name: "crawler", enabled: false },
    { name: "mlTraining", enabled: false }
  ],
  apiLimits: {
    requestsPerDay: 500,
    requestsPerMonth: 5000,
    concurrentRequests: 10
  }
};

// Create the tier
const createdTier = await createSubscriptionTier(newTier);
```

### Checking Module Access

```typescript
// Example: Checking if a user has access to a module
const hasAccess = await hasModuleAccess(userId, 'advancedAgents');

if (hasAccess) {
  // Allow access to advanced agents
} else {
  // Deny access with upgrade suggestion
}
```

### Tracking API Usage

```typescript
// Example: Tracking API usage
app.use('/api/external', async (req, res, next) => {
  const userId = req.user.id;
  
  // Check if user has reached the limit
  const hasReachedLimit = await hasReachedApiLimit(userId);
  
  if (hasReachedLimit) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      message: 'Please upgrade your subscription for higher limits'
    });
  }
  
  // Track the API usage
  await trackApiUsage(userId);
  
  // Continue with the request
  next();
});
```

## Deployment Considerations

1. **Database Migrations**
   - Execute migrations to create subscription_tiers and user_subscriptions tables
   - Set up foreign key relationships and indices

2. **Default Tiers**
   - Create default subscription tiers during initial deployment
   - Ensure a free tier exists for new users

3. **User Migration**
   - Associate existing users with appropriate subscription tiers
   - Provide a migration path for existing data

## Security Considerations

1. **Access Control**
   - Validate subscription status and permissions for all protected routes
   - Prevent unauthorized access to subscription management

2. **Rate Limiting**
   - Implement robust rate limiting to prevent abuse
   - Provide clear feedback on rate limit status

3. **Admin Protection**
   - Restrict tier management to admin users only
   - Log all changes to subscription tiers and user subscriptions

## Monitoring and Analytics

The system provides analytics and monitoring capabilities:

1. **Usage Patterns**
   - Track most used features per tier
   - Identify upgrade opportunities

2. **Revenue Metrics**
   - Monitor subscription revenue by tier
   - Track conversion rates and upgrades

3. **System Health**
   - Monitor rate limit effectiveness
   - Identify potential abuse patterns