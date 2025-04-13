# Credit System for API Usage

The credit system allows users to consume third-party API services through a unified credit-based payment model. Credits are allocated through subscriptions and can be used for various services like OpenAI API calls, 3D model generation, and agent usage.

## Overview

The credit system consists of the following components:

1. **Service Cost Management**: Admin-configurable costs for third-party services
2. **Credit Allocation**: Credits included with subscription plans
3. **Credit Usage Tracking**: Tracking and deducting credits for API usage
4. **Credit Purchasing**: Allowing users to purchase additional credits

## Database Schema

### Service Costs Table

Stores the costs of third-party API services:

```sql
CREATE TABLE service_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name TEXT NOT NULL,
  service_key TEXT NOT NULL UNIQUE,
  cost_per_unit DECIMAL(10, 6) NOT NULL,
  unit_type TEXT NOT NULL,
  multiplier DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### User Credits Table

Stores user credit balances:

```sql
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### Credit Transactions Table

Tracks credit transactions:

```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for additions, negative for usage
  balance INTEGER NOT NULL, -- Balance after transaction
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'expiration', 'adjustment', 'subscription')),
  service_key TEXT, -- Key of the service that used the credits
  service_usage JSONB, -- Details of service usage
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);
```

## Core Components

### Service Cost Model

The `serviceCost.model.ts` file provides functions for managing service costs:

- `getAllServiceCosts()`: Get all service costs
- `getServiceCostByKey(serviceKey)`: Get service cost by key
- `createServiceCost(serviceCost)`: Create a new service cost
- `updateServiceCost(id, updates)`: Update a service cost
- `deleteServiceCost(id)`: Delete a service cost
- `calculateCreditCost(serviceKey, units)`: Calculate credit cost for service usage

### User Credit Model

The `userCredit.model.ts` file provides functions for managing user credits:

- `getUserCredit(userId)`: Get user credit balance
- `addCredits(userId, amount, description, type, metadata)`: Add credits to user
- `useCredits(userId, amount, description, type, metadata)`: Use credits from user
- `useServiceCredits(userId, serviceKey, units, description, metadata)`: Use credits for a specific service
- `getCreditTransactions(userId, limit, offset)`: Get credit transactions for a user
- `getCreditUsageByService(userId, limit, offset)`: Get credit usage by service
- `hasEnoughCredits(userId, amount)`: Check if user has enough credits
- `initializeUserCredit(userId, initialBalance)`: Initialize user credit if it doesn't exist

### Credit Service

The `creditService.ts` file provides a unified interface for credit management:

- `hasEnoughCreditsForService(userId, serviceKey, units)`: Check if user has enough credits for a service
- `useServiceCredits(userId, serviceKey, units, description, metadata)`: Use credits for a service
- `getAllServiceCosts()`: Get all service costs
- `getServiceCostByKey(serviceKey)`: Get service cost by key
- `createServiceCost(serviceCost)`: Create a new service cost
- `updateServiceCost(id, updates)`: Update a service cost
- `deleteServiceCost(id)`: Delete a service cost
- `getUserCreditUsageByService(userId, limit, offset)`: Get user credit usage by service
- `getUserCreditBalance(userId)`: Get user credit balance
- `addCreditsToUser(userId, amount, description, type, metadata)`: Add credits to user
- `initializeUserCredit(userId, initialBalance)`: Initialize user credit if it doesn't exist

### API Credit Middleware

The `apiCredit.middleware.ts` file provides middleware for checking and deducting credits for API usage:

- `checkApiCredits(serviceKey, estimatedUnits)`: Check if user has enough credits for an API request
- `trackApiUsage(req, actualUnits, additionalMetadata)`: Track actual API usage and deduct credits

## Integration with Subscription System

The credit system is integrated with the subscription system in the following ways:

1. **Subscription Tiers**: Each subscription tier includes a specified number of credits
2. **Subscription Creation**: Credits are allocated when a user subscribes to a plan
3. **Subscription Renewal**: Credits are replenished on subscription renewal
4. **Credit Purchasing**: Users can purchase additional credits beyond what's included in their subscription

## API Endpoints

### User Endpoints

- `GET /api/subscriptions/credits`: Get user's credit balance
- `GET /api/subscriptions/credits/transactions`: Get user's credit transactions
- `GET /api/subscriptions/credits/usage-by-service`: Get credit usage by service
- `POST /api/subscriptions/credits/purchase`: Purchase credits
- `POST /api/subscriptions/credits/use`: Use credits
- `POST /api/subscriptions/credits/use-service`: Use credits for a specific service
- `GET /api/subscriptions/service-costs`: Get all service costs

### Admin Endpoints

- `GET /api/admin/service-costs`: Get all service costs
- `GET /api/admin/service-costs/:id`: Get service cost by ID
- `POST /api/admin/service-costs`: Create a new service cost
- `PUT /api/admin/service-costs/:id`: Update a service cost
- `DELETE /api/admin/service-costs/:id`: Delete a service cost

## Usage Examples

### Checking and Deducting Credits for API Usage

```typescript
// In an API route handler
import apiCreditMiddleware from '../middleware/apiCredit.middleware';

// Check if user has enough credits for OpenAI GPT-4 usage
router.post(
  '/generate-text',
  authMiddleware,
  apiCreditMiddleware.checkApiCredits('openai.gpt-4', 10), // Estimated 10 units
  async (req, res) => {
    try {
      // Process the request
      const result = await openaiService.generateText(req.body.prompt);
      
      // Track actual usage (e.g., based on tokens used)
      await apiCreditMiddleware.trackApiUsage(
        req,
        result.usage.totalTokens / 1000, // Convert tokens to units
        { model: 'gpt-4', promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens }
      );
      
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      // Handle error
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
```

### Adding Credits to a User

```typescript
// Add 100 credits to a user
const result = await creditService.addCreditsToUser(
  userId,
  100,
  'Credit purchase',
  'purchase',
  { paymentId: 'pi_123456' }
);
```

### Using Credits for a Service

```typescript
// Use credits for OpenAI GPT-4 usage
const result = await creditService.useServiceCredits(
  userId,
  'openai.gpt-4',
  5, // 5 units (e.g., 5000 tokens)
  'Text generation with GPT-4',
  { prompt: 'Summarize this article...', model: 'gpt-4' }
);
```

## Admin Panel

The admin panel provides the following functionality for managing the credit system:

1. **Service Cost Management**: Add, edit, and delete service costs
2. **Credit Usage Analytics**: View credit usage by service and user
3. **User Credit Management**: Add credits to users and view credit balances
4. **Subscription Tier Configuration**: Configure included credits for subscription tiers

## Future Enhancements

1. **Credit Expiration**: Implement credit expiration for time-limited credits
2. **Credit Bundles**: Create bundles of credits with discounted pricing
3. **Service-Specific Credits**: Implement credits that can only be used for specific services
4. **Usage Forecasting**: Provide usage forecasting based on historical data
5. **Automated Cost Updates**: Automatically update service costs based on third-party API pricing changes
