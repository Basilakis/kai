# Subscription Management System

## Executive Summary

The Subscription Management System provides a comprehensive framework for managing user subscriptions, payment processing, credit management, and access control. It integrates with Stripe for payment processing and offers a flexible, module-based access control system with tiered pricing and granular feature access.

Key capabilities:
- Multiple subscription tiers with different feature sets and resource limits
- Stripe integration for payment processing and subscription management
- Credit system for purchasing and using credits for premium features
- Module-based access control for granular permission management
- API rate limiting with tier-specific quotas
- Usage tracking and analytics
- Subscription state machine for lifecycle management
- Plan versioning for managing changes to subscription tiers

## System Architecture

The system follows a layered architecture that integrates with existing authentication:

1. **Authentication Layer**: Validates user identity via Supabase Auth and determines user type
2. **User Type Layer**: Categorizes users as regular users, factories, b2b, or admin
3. **Subscription Layer**: Verifies subscription status and tier permissions based on user type
4. **Payment Processing Layer**: Handles payments and subscription billing via Stripe
5. **Credit Management Layer**: Manages user credits for premium features
6. **Access Control Layer**: Enforces module-specific permissions
7. **Rate Limiting Layer**: Controls API usage based on tier limits
8. **Analytics Layer**: Tracks usage patterns and subscription metrics

## Core Components

### 1. Subscription Tiers

Subscription tiers define the available plans users can subscribe to. Each tier specifies:

- **Basic Information**: Name, price, description, currency, and visibility (public/private)
- **Module Access**: Which platform modules are enabled for this tier
- **API Limits**: Requests per minute, day, and month
- **Storage Limits**: Maximum storage space, file size, and files per project
- **Credit Limits**: Included credits, maximum purchasable credits, and credit price multiplier
- **Resource Limits**: Maximum projects, team members, and moodboards

Tiers are stored in the `subscription_tiers` table in Supabase and offer different capability levels:

| Tier | Description | Key Features |
|------|------------|--------------|
| Free | Basic access with limited features | Basic material recognition, limited storage, no API access |
| Basic | Standard access for individual users | Material recognition, knowledge base, basic agent access |
| Professional | Advanced access for professionals | All basic features + advanced agents, 3D designer access |
| Enterprise | Full access for organizations | Unlimited access to all features, maximum API limits |
| Custom | Tailored solutions for specific needs | Custom configuration of all modules and limits |

### 2. User Types

The system supports different types of users, each with access to specific subscription tiers:

- **User**: Regular end users of the application
- **Factory**: Factory/manufacturer users with specialized access
- **B2B**: Business-to-business users with specialized access
- **Admin**: Administrators with full access to the system

Special cases:
- The email `basiliskan@gmail.com` is automatically assigned the `admin` user type when registering
- Admins can convert regular users to factory or b2b users through the admin panel
- Each user type has access to different subscription tiers tailored to their needs

### 3. User Subscriptions

User subscriptions link users to their selected subscription tier and track usage metrics:

- **Subscription Information**: Tier ID, status (active, trialing, past_due, canceled, etc.), renewal date
- **Stripe Integration**: Customer ID, subscription ID, payment method ID
- **Billing Details**: Payment method, billing cycle, current period start/end
- **Usage Tracking**: API requests count, storage usage, module-specific usage
- **User Type**: The type of user (user, factory, b2b, admin) which determines available subscription tiers

The subscription state machine manages the lifecycle of subscriptions with the following states:
- **Active**: Subscription is active and paid
- **Trialing**: Subscription is in trial period
- **Past Due**: Payment has failed but subscription is still active
- **Canceled**: Subscription has been canceled
- **Incomplete**: Subscription creation is incomplete
- **Paused**: Subscription is temporarily paused

### 4. Credit System

The credit system allows users to purchase and use credits for premium features:

- **Credit Balance**: Current credit balance for each user
- **Credit Transactions**: History of credit additions and usage
- **Credit Pricing**: Tier-specific credit pricing with potential discounts
- **Credit Usage**: Using credits for specific actions like generating 3D models or running AI agents

Credits can be:
- Included with a subscription
- Purchased separately
- Used for various actions (e.g., generating 3D models, running agents)

### 5. Stripe Integration

The system integrates with Stripe for payment processing:

- **Customer Management**: Creating and managing Stripe customers
- **Subscription Management**: Creating, updating, and canceling subscriptions
- **Payment Method Management**: Adding, updating, and removing payment methods
- **Webhook Handling**: Processing Stripe events for subscription lifecycle management
- **Invoice Management**: Generating and managing invoices

### 6. Module-Based Access Control

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

### 7. Plan Versioning

The plan versioning system allows for the creation and management of different versions of subscription plans:

- **Version Number**: Sequential identifier for the version
- **Changes**: The specific changes made in this version
- **Effective Date**: When the version becomes active
- **Created By**: Who created the version
- **Created At**: When the version was created

This enables tracking changes to subscription tiers and applying them at specific times.

### 8. Analytics and Reporting

The analytics system provides insights into subscription metrics, revenue, user behavior, and resource utilization:

- **Revenue Metrics**: MRR, ARR, average revenue per user
- **Subscription Metrics**: Total subscribers, active subscribers, churn rate, conversion rate
- **Usage Metrics**: API usage, storage utilization, feature adoption
- **Credit Usage**: Credit consumption by feature, purchase patterns, usage trends

## Backend Implementation

### Models

1. **SubscriptionTier Model** (`packages/server/src/models/subscriptionTier.model.ts`)
   - Core data structure for subscription tiers
   - CRUD operations for tier management
   - Includes price, features, module access permissions, and resource limits

2. **UserSubscription Model** (`packages/server/src/models/userSubscription.model.ts`)
   - Links users to subscription tiers
   - Tracks API usage and module access
   - Handles resets for usage limits
   - Provides utility functions for checking permissions and limits
   - Integrates with Stripe for payment processing

3. **UserCredit Model** (`packages/server/src/models/userCredit.model.ts`)
   - Manages user credit balances
   - Tracks credit transactions
   - Provides functions for adding and using credits

4. **SubscriptionTierVersion Model** (`packages/server/src/models/subscriptionTierVersion.model.ts`)
   - Manages versions of subscription tiers
   - Tracks changes between versions
   - Provides functions for applying versions

5. **SubscriptionStateMachine Model** (`packages/server/src/models/subscriptionStateMachine.model.ts`)
   - Manages subscription state transitions
   - Enforces valid state transitions
   - Records state transition history

### Services

1. **Stripe Service** (`packages/server/src/services/payment/stripeService.ts`)
   - Handles all interactions with the Stripe API
   - Manages customers, subscriptions, and payment methods
   - Processes webhooks for Stripe events

2. **Subscription Analytics Service** (`packages/server/src/services/analytics/subscriptionAnalytics.service.ts`)
   - Provides analytics for subscriptions
   - Calculates revenue metrics, churn rate, and conversion rate
   - Analyzes subscription distribution and credit usage

### Controllers

1. **Subscription Controller** (`packages/server/src/controllers/subscription.controller.ts`)
   - Handles user-facing subscription management
   - Manages credit purchases and usage
   - Processes subscription changes

2. **Webhook Controller** (`packages/server/src/controllers/webhook.controller.ts`)
   - Processes Stripe webhook events
   - Updates subscription status based on payment events
   - Handles credit purchases and subscription changes

3. **Admin Subscription Controller** (`packages/server/src/controllers/admin/subscription.admin.controller.ts`)
   - Manages subscription tiers and versions
   - Handles user subscription management
   - Provides subscription analytics

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
   - Credit management endpoints
   - Payment method management endpoints

2. **Webhook Routes** (`packages/server/src/routes/webhook.routes.ts`)
   - Endpoints for processing Stripe webhook events

3. **Admin Subscription Routes** (`packages/server/src/routes/admin/subscription.admin.routes.ts`)
   - Admin endpoints for managing subscription tiers
   - Analytics endpoints for subscription metrics
   - User subscription management endpoints

## Database Schema

The subscription system uses the following database tables:

1. **subscription_tiers**
   - id: UUID primary key
   - name: String
   - description: String
   - price: Decimal
   - currency: String
   - billing_interval: String (monthly, yearly, one-time)
   - stripe_price_id: String
   - stripe_product_id: String
   - module_access: JSONB array
   - api_limits: JSONB object
   - storage_limits: JSONB object
   - credit_limits: JSONB object
   - max_projects: Integer
   - max_team_members: Integer
   - max_moodboards: Integer
   - support_level: String
   - is_public: Boolean
   - custom_features: JSONB array
   - user_types: JSONB array (user types that can access this tier)
   - created_at: Timestamp
   - updated_at: Timestamp

2. **user_subscriptions**
   - id: UUID primary key
   - user_id: UUID foreign key to users
   - tier_id: UUID foreign key to subscription_tiers
   - status: String (active, trialing, past_due, canceled, etc.)
   - start_date: Timestamp
   - end_date: Timestamp
   - renewal_date: Timestamp
   - canceled_at: Timestamp
   - trial_end_date: Timestamp
   - payment_method: String
   - payment_id: String
   - stripe_customer_id: String
   - stripe_subscription_id: String
   - stripe_price_id: String
   - stripe_payment_method_id: String
   - current_period_start: Timestamp
   - current_period_end: Timestamp
   - cancel_at_period_end: Boolean
   - auto_renew: Boolean
   - usage: JSONB object
   - metadata: JSONB object
   - created_at: Timestamp
   - updated_at: Timestamp

3. **user_credits**
   - id: UUID primary key
   - user_id: UUID foreign key to users
   - balance: Integer
   - last_updated_at: Timestamp
   - created_at: Timestamp

4. **credit_transactions**
   - id: UUID primary key
   - user_id: UUID foreign key to users
   - amount: Integer
   - balance: Integer
   - description: String
   - type: String (purchase, usage, refund, expiration, adjustment, subscription)
   - metadata: JSONB object
   - created_at: Timestamp
   - expires_at: Timestamp

5. **subscription_tier_versions**
   - id: UUID primary key
   - tier_id: UUID foreign key to subscription_tiers
   - version_number: Integer
   - changes: JSONB object
   - effective_date: Timestamp
   - created_at: Timestamp
   - created_by: UUID foreign key to users

6. **subscription_state_transitions**
   - id: UUID primary key
   - subscription_id: UUID foreign key to user_subscriptions
   - from_state: String
   - to_state: String
   - reason: String
   - metadata: JSONB object
   - created_at: Timestamp

7. **subscription_tier_user_types**
   - id: UUID primary key
   - tier_id: UUID foreign key to subscription_tiers
   - user_type: String enum ('user', 'factory', 'b2b', 'admin')
   - created_at: Timestamp
   - updated_at: Timestamp

## Frontend Implementation

### User Interface Components

1. **SubscriptionPlans** (`packages/client/src/components/subscription/SubscriptionPlans.tsx`)
   - Displays available subscription plans
   - Shows features and pricing for each plan
   - Allows users to select a plan

2. **PaymentForm** (`packages/client/src/components/subscription/PaymentForm.tsx`)
   - Collects payment information using Stripe Elements
   - Handles subscription creation and updates
   - Processes payment method changes

3. **CreditManagement** (`packages/client/src/components/subscription/CreditManagement.tsx`)
   - Displays credit balance and transaction history
   - Allows users to purchase credits
   - Shows credit usage by feature

4. **PaymentMethodSelector** (`packages/client/src/components/subscription/PaymentMethodSelector.tsx`)
   - Displays saved payment methods
   - Allows users to add, edit, and remove payment methods
   - Sets default payment method

### Admin Interface Components

1. **AdminSubscriptionManagement** (`packages/admin/src/components/subscription/AdminSubscriptionManagement.tsx`)
   - Manages subscription tiers and versions
   - Displays user subscriptions and credits
   - Shows subscription analytics

2. **SubscriptionTierForm** (`packages/admin/src/components/subscription/SubscriptionTierForm.tsx`)
   - Creates and edits subscription tiers
   - Configures module access, API limits, and resource limits
   - Sets pricing and billing intervals
   - Specifies which user types can access the tier

3. **UserTypeManagement** (`packages/admin/src/components/user/UserTypeManagement.tsx`)
   - Displays users with their current types
   - Allows changing a user's type between user, factory, b2b, and admin
   - Shows available subscription tiers for each user type

4. **SubscriptionAnalyticsChart** (`packages/admin/src/components/subscription/SubscriptionAnalyticsChart.tsx`)
   - Displays subscription analytics in chart form
   - Shows revenue, subscriber counts, and churn rate
   - Visualizes subscription distribution by user type

### Pages

1. **Subscription Page** (`packages/client/src/pages/subscription/index.tsx`)
   - Main subscription management page for users
   - Shows current subscription details
   - Allows users to change plans, manage credits, and update payment methods

2. **Admin Subscription Page** (`packages/admin/src/pages/subscriptions/index.tsx`)
   - Main subscription management page for admins
   - Manages subscription tiers and user subscriptions
   - Displays subscription analytics
   - Configures which user types can access each tier

3. **Admin User Type Page** (`packages/admin/src/pages/user-types/index.tsx`)
   - Manages user types (user, factory, b2b, admin)
   - Allows changing a user's type
   - Shows subscription tiers available for each user type

## Stripe Integration

The system integrates with Stripe for payment processing:

### Customer Management

- Creating customers in Stripe when users sign up
- Linking Stripe customers to users in the database
- Managing customer payment methods

### Subscription Management

- Creating subscriptions in Stripe
- Updating subscriptions when users change plans
- Canceling subscriptions
- Handling subscription lifecycle events (renewal, payment failure, etc.)

### Webhook Handling

The system handles the following Stripe webhook events:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

## Credit System

### Credit Allocation

- Credits included with subscription
- Credits purchased separately
- Credits with expiration dates

### Credit Usage

- Using credits for specific actions
- Tracking credit usage
- Preventing actions when credits are insufficient

## Analytics and Reporting

The analytics system provides insights into subscription metrics:

### Revenue Metrics

- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)
- Average Revenue Per User (ARPU)

### Subscription Metrics

- Total subscribers
- Active subscribers
- Churn rate
- Conversion rate

### Usage Metrics

- API usage
- Storage utilization
- Feature adoption

### Credit Usage

- Credit consumption by feature
- Credit purchase patterns
- Credit usage trends

## Implementation Guides

### Creating a New Subscription Tier

```typescript
// Example: Creating a new tier
const newTier = {
  name: "Premium",
  description: "Premium access with advanced features",
  price: 29.99,
  currency: "usd",
  billingInterval: "monthly",
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
    requestsPerMinute: 60,
    requestsPerDay: 500,
    requestsPerMonth: 5000,
    includedModules: ["materialRecognition", "knowledgeBase", "agents"]
  },
  storageLimits: {
    maxStorageGB: 10,
    maxFileSize: 50,
    maxFilesPerProject: 500
  },
  creditLimits: {
    includedCredits: 100,
    maxPurchasableCredits: 10000,
    creditPriceMultiplier: 0.9
  },
  maxProjects: 10,
  maxTeamMembers: 5,
  maxMoodboards: 20,
  supportLevel: "priority",
  isPublic: true,
  userTypes: ["user", "factory"] // This tier is available for regular users and factories
};

// Create the tier
const createdTier = await createSubscriptionTier(newTier);
```

### Subscribing to a Paid Plan

```typescript
// Example: Subscribing to a paid plan
const subscription = await subscribeToPaidPlan(
  userId,
  tierId,
  paymentMethodId,
  {
    trialDays: 14,
    metadata: { referral: "marketing_campaign" }
  }
);
```

### Managing Credits

```typescript
// Example: Adding credits to a user
const result = await addCredits(
  userId,
  100,
  "Credit purchase",
  "purchase",
  { paymentId: "pi_123456" }
);

// Example: Using credits
const result = await useCredits(
  userId,
  10,
  "Generated 3D model",
  "usage",
  { feature: "3dDesigner", modelId: "model_123" }
);
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

### Managing User Types

```typescript
// Example: Changing a user's type
const updatedUser = await updateUserType(
  userId,
  'factory',
  {
    reason: 'User requested factory access',
    approvedBy: adminId
  }
);

// Example: Getting subscription tiers for a user type
const factoryTiers = await getSubscriptionTiersByUserType('factory');

// Example: Associating a tier with a user type
const result = await associateTierWithUserType(tierId, 'b2b');
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
   - Execute migrations to create necessary tables
   - Set up foreign key relationships and indices

2. **Environment Configuration**
   - Configure Stripe API keys
   - Set up webhook endpoints
   - Configure email notifications

3. **Default Tiers**
   - Create default subscription tiers during initial deployment
   - Ensure a free tier exists for new users
   - Configure which user types can access each tier

4. **User Migration**
   - Associate existing users with appropriate subscription tiers
   - Initialize credit balances for existing users
   - Assign appropriate user types to existing users

## Security Considerations

1. **Payment Information**
   - Use Stripe Elements to securely collect payment information
   - Never store credit card details in your database
   - Use Stripe's secure webhooks for payment events

2. **Access Control**
   - Validate subscription status and permissions for all protected routes
   - Prevent unauthorized access to subscription management
   - Implement proper authentication for webhook endpoints

3. **Rate Limiting**
   - Implement robust rate limiting to prevent abuse
   - Provide clear feedback on rate limit status
   - Monitor for unusual usage patterns

4. **Admin Protection**
   - Restrict tier management to admin users only
   - Log all changes to subscription tiers and user subscriptions
   - Implement proper audit trails for sensitive operations
   - Secure user type changes with proper authorization checks
   - Log all user type changes for audit purposes

## Best Practices

1. **Subscription Management**
   - Provide clear information about subscription features and limits
   - Implement smooth upgrade/downgrade flows
   - Send notifications for important subscription events
   - Show appropriate subscription tiers based on user type

2. **Credit System**
   - Clearly communicate credit costs for different actions
   - Provide usage history and balance information
   - Implement automatic credit purchase options

3. **Payment Processing**
   - Handle payment failures gracefully
   - Implement retry logic for failed payments
   - Provide clear error messages for payment issues

4. **User Type Management**
   - Provide clear information about the benefits of each user type
   - Implement a smooth process for users to request type changes
   - Ensure proper validation before changing user types
   - Notify users when their type changes

5. **Analytics**
   - Regularly review subscription metrics
   - Use analytics to inform pricing decisions
   - Monitor for unusual patterns or potential issues
   - Track subscription distribution by user type

## Conclusion

The Subscription Management System provides a comprehensive solution for managing subscriptions, payments, and access control. It integrates with Stripe for payment processing and offers a flexible, module-based access control system with tiered pricing and granular feature access.

By implementing this system, you can:
- Support different user types (users, factories, b2b, admin) with specialized access
- Offer multiple subscription tiers with different features and limits for each user type
- Process payments securely using Stripe
- Manage user credits for premium features
- Track and enforce usage limits
- Provide a seamless user experience for subscription management
- Gain valuable insights into subscription metrics and user behavior
- Easily manage user type changes through the admin panel
