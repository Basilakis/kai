# Material Promotion System

## Executive Summary

The Material Promotion System allows factories to purchase credits and use them to promote their materials in 3D model generation. When users create 3D models with prompts that match promoted materials, those materials will appear more frequently (1/3 times) in the generated models, while other times random materials from the knowledge base will be used.

## System Architecture

The Material Promotion System consists of the following components:

1. **Database Layer**: Stores material promotions, tracks usage, and manages credit allocations
2. **API Layer**: Provides endpoints for factories to manage their promotions
3. **Integration Layer**: Integrates with the 3D model generation process to select promoted materials
4. **Analytics Layer**: Tracks promotion performance and provides insights to factories

## Core Components

### 1. Material Promotions

Material promotions link materials to factories and track credit allocation:

- **Material ID**: The material being promoted
- **Factory ID**: The factory promoting the material
- **Credits Allocated**: Number of credits allocated to the promotion
- **Status**: Active, inactive, completed, or pending
- **Usage Metrics**: Tracks impressions and actual usage in 3D models

### 2. Credit System Integration

The system integrates with the existing credit system:

- Factories purchase credits through the standard credit purchase system
- Credits can be allocated to specific material promotions
- Credit transactions are tracked with a new 'promotion' type
- Usage analytics show how credits are being utilized

### 3. Material Selection Algorithm

The material selection algorithm determines when to use promoted materials:

- 1/3 chance of selecting a promoted material when a matching material type is needed
- Weighted selection based on credits allocated when multiple promotions match
- Fallback to random materials from the knowledge base when no promotions match or for the remaining 2/3 cases

### 4. Factory Interface

Factories have a dedicated interface to manage their promotions:

- View all materials associated with the factory
- Allocate credits to specific materials
- Track promotion performance and ROI
- Start/stop promotions as needed

## Database Schema

### material_promotions Table

```
- id: UUID (primary key)
- material_id: UUID (foreign key to materials)
- factory_id: UUID (foreign key to users)
- credits_allocated: INTEGER
- status: TEXT (active/inactive/completed/pending)
- start_date: TIMESTAMP
- end_date: TIMESTAMP (nullable)
- usage_count: INTEGER
- impression_count: INTEGER
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### credit_transactions Table (Updated)

```
- Added 'promotion' as a valid type
- Added promotion_id field (foreign key to material_promotions)
```

## API Endpoints

### Factory Material Management

- `GET /api/factory/materials` - Get all materials associated with the factory
- `GET /api/factory/promotions` - Get all promotions for the factory
- `GET /api/factory/promotions/:id` - Get a specific promotion
- `POST /api/factory/promotions` - Create a new promotion (allocate credits)
- `PUT /api/factory/promotions/:id/status` - Update a promotion's status
- `GET /api/factory/promotions/analytics` - Get promotion analytics

## Implementation Details

### Credit Allocation

When a factory allocates credits to promote a material:

1. The system checks if the factory has enough credits
2. Credits are deducted from the factory's balance
3. A credit transaction of type 'promotion' is created
4. The material promotion is created or updated with the allocated credits

### Material Selection

When a 3D model is being generated:

1. The system extracts material types needed for the model
2. For each material type, there's a 1/3 chance of using a promoted material
3. If a promoted material is selected, the system:
   - Records an impression
   - If the material is actually used in the final model, records a usage
   - Updates analytics for the promotion

### Analytics

The system provides detailed analytics for factories:

- Total credits allocated to promotions
- Impression count (how many times the material was considered)
- Usage count (how many times the material was actually used)
- Usage rate (usage count / impression count)
- ROI metrics based on credit cost and usage

## Security Considerations

1. **Access Control**:
   - Only factory users can manage their own promotions
   - Factories can only promote materials they own
   - Admin users can view and manage all promotions

2. **Rate Limiting**:
   - Appropriate rate limits are applied to promotion-related endpoints
   - Credit allocation is validated to prevent abuse

3. **Audit Trail**:
   - All promotion-related activities are logged
   - Credit transactions provide a clear audit trail

## System Integration

The Material Promotion System integrates with several existing systems:

### Module-Based Access Control Integration

The system is implemented as a module in the Module-Based Access Control system:
- Factory routes use the `requireModuleAccess('materialPromotion')` middleware
- Factory subscription tiers include the module (disabled by default)
- The module can be enabled/disabled per subscription tier through the admin panel

### API Endpoints

The system exposes the following API endpoints:
- `GET /api/factory/materials` - Get factory materials that can be promoted
- `GET /api/factory/promotions` - Get all promotions for the factory
- `GET /api/factory/promotions/:id` - Get a specific promotion
- `POST /api/factory/promotions` - Create a new promotion (allocate credits)
- `PUT /api/factory/promotions/:id/status` - Update a promotion's status
- `GET /api/factory/promotions/analytics` - Get promotion analytics

### 3D Model Generation Integration

The material promotion system integrates with the 3D model generation process:
- When a 3D model is generated, the system checks for promoted materials that match the requested material type
- There's a 1/3 chance of selecting a promoted material when a match is found
- The system tracks impressions (when a promoted material is considered) and usage (when a promoted material is actually used)
- The selection is weighted by the number of credits allocated to each promotion

## Future Enhancements

Potential future enhancements to the Material Promotion System:

1. **Advanced Targeting**:
   - Target promotions by user demographics
   - Target promotions by project type
   - Seasonal promotion scheduling

2. **Enhanced Analytics**:
   - Conversion tracking for promoted materials
   - A/B testing for promotion effectiveness
   - Predictive analytics for optimal credit allocation

3. **Integration with Other Systems**:
   - Integration with e-commerce systems
   - Integration with marketing campaigns
   - Integration with customer relationship management systems
