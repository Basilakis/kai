+++
id = "kai-platform-standards"
title = "KAI Platform - Implementation Standards & Guidelines"
context_type = "documentation"
scope = "Development standards, security requirements, and performance criteria"
target_audience = ["roo-commander", "lead-*", "dev-*", "util-senior-dev", "security-specialist", "performance-specialist"]
granularity = "detailed"
status = "active"
last_updated = "2025-07-08"
version = "1.0"
tags = ["kai-platform", "standards", "guidelines", "security", "performance", "development", "best-practices"]
related_context = [
    ".ruru/docs/kai_platform_overview.md",
    ".ruru/docs/architecture/kai_platform_architecture.md",
    ".ruru/docs/guides/kai_platform_implementation_guide.md"
]
template_schema_doc = ".ruru/templates/toml-md/09_documentation.md"
relevance = "Critical: Development and implementation standards for all teams"
+++

# KAI Platform - Implementation Standards & Guidelines

## Development Standards

### Code Quality Standards

#### General Principles
- **Clean Code**: Follow clean code principles with meaningful names, small functions, and clear intent
- **SOLID Principles**: Adhere to Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion
- **DRY (Don't Repeat Yourself)**: Eliminate code duplication through proper abstraction
- **YAGNI (You Aren't Gonna Need It)**: Implement only what is currently needed
- **Fail Fast**: Design systems to fail quickly and provide clear error messages

#### Code Review Requirements
- **Mandatory Reviews**: All code changes require at least one peer review
- **Security Review**: Security-sensitive changes require security team approval
- **Performance Review**: Performance-critical changes require performance team review
- **Documentation**: All public APIs and complex logic must be documented
- **Test Coverage**: Minimum 80% test coverage for new code

### Language-Specific Standards

#### TypeScript/JavaScript (Frontend & Node.js Services)
```typescript
// Naming Conventions
interface UserProfile {          // PascalCase for interfaces/types
  userId: string;               // camelCase for properties
  isActive: boolean;
}

class MaterialService {          // PascalCase for classes
  private apiClient: ApiClient;  // camelCase for private members
  
  public async getMaterial(id: string): Promise<Material> {
    // camelCase for methods and variables
    const materialData = await this.apiClient.get(`/materials/${id}`);
    return this.transformMaterial(materialData);
  }
}

// Constants
const API_ENDPOINTS = {         // UPPER_SNAKE_CASE for constants
  MATERIALS: '/api/v1/materials',
  USERS: '/api/v1/users'
};
```

**Standards:**
- Use TypeScript strict mode
- Prefer `const` over `let`, avoid `var`
- Use async/await over Promises chains
- Implement proper error handling with try/catch
- Use ESLint with Airbnb configuration
- Format code with Prettier

#### Python (ML Services & Data Processing)
```python
# Naming Conventions
class MaterialClassifier:        # PascalCase for classes
    def __init__(self, model_path: str):
        self._model = None       # Leading underscore for private
        self.model_path = model_path  # snake_case for public
    
    def classify_material(self, image_data: np.ndarray) -> ClassificationResult:
        """Classify material from image data.
        
        Args:
            image_data: Preprocessed image array
            
        Returns:
            Classification result with confidence score
            
        Raises:
            ModelNotLoadedError: If model is not initialized
        """
        if self._model is None:
            raise ModelNotLoadedError("Model must be loaded before classification")
        
        return self._model.predict(image_data)

# Constants
DEFAULT_CONFIDENCE_THRESHOLD = 0.85  # UPPER_SNAKE_CASE
```

**Standards:**
- Follow PEP 8 style guide
- Use type hints for all function signatures
- Document all public methods with docstrings
- Use Black for code formatting
- Use pylint and mypy for static analysis
- Prefer f-strings for string formatting

### API Design Standards

#### RESTful API Guidelines
```typescript
// Resource-based URLs
GET    /api/v1/materials           // List materials
POST   /api/v1/materials           // Create material
GET    /api/v1/materials/{id}      // Get specific material
PUT    /api/v1/materials/{id}      // Update material
DELETE /api/v1/materials/{id}      // Delete material

// Nested resources
GET    /api/v1/materials/{id}/classifications
POST   /api/v1/materials/{id}/classifications

// Query parameters for filtering/pagination
GET    /api/v1/materials?category=metal&page=2&limit=20
```

#### Response Format Standards
```json
{
  "success": true,
  "data": {
    "id": "mat_123456",
    "name": "Steel Plate",
    "category": "metal",
    "properties": {
      "thickness": "5mm",
      "grade": "A36"
    }
  },
  "meta": {
    "timestamp": "2025-07-08T17:21:40Z",
    "version": "1.0",
    "requestId": "req_789012"
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "MATERIAL_NOT_FOUND",
    "message": "Material with ID mat_123456 not found",
    "details": {
      "requestId": "req_789012",
      "timestamp": "2025-07-08T17:21:40Z"
    }
  }
}
```

#### GraphQL Standards
```graphql
# Schema Design
type Material {
  id: ID!
  name: String!
  category: MaterialCategory!
  properties: JSON
  classifications: [Classification!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Query {
  material(id: ID!): Material
  materials(
    filter: MaterialFilter
    pagination: PaginationInput
  ): MaterialConnection!
}

type Mutation {
  createMaterial(input: CreateMaterialInput!): CreateMaterialPayload!
  updateMaterial(id: ID!, input: UpdateMaterialInput!): UpdateMaterialPayload!
}
```

### Database Standards

#### Schema Design Principles
- Use descriptive table and column names
- Implement proper foreign key constraints
- Add appropriate indexes for query performance
- Use UUIDs for primary keys in distributed systems
- Implement soft deletes for audit trails

#### Migration Standards
```sql
-- Migration naming: YYYYMMDDHHMMSS_descriptive_name.sql
-- 20250708172140_add_material_properties_table.sql

-- Always include rollback instructions
-- UP Migration
CREATE TABLE material_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    property_name VARCHAR(100) NOT NULL,
    property_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_material_property UNIQUE(material_id, property_name)
);

CREATE INDEX idx_material_properties_material_id ON material_properties(material_id);
CREATE INDEX idx_material_properties_name ON material_properties(property_name);

-- DOWN Migration (in separate file or section)
DROP TABLE IF EXISTS material_properties;
```

## Security Standards

### Authentication & Authorization

#### JWT Token Standards
```typescript
interface JWTPayload {
  sub: string;          // User ID
  iss: string;          // Issuer (kai-platform)
  aud: string;          // Audience
  exp: number;          // Expiration timestamp
  iat: number;          // Issued at timestamp
  jti: string;          // JWT ID for revocation
  scope: string[];      // User permissions
  org: string;          // Organization ID
}

// Token expiration times
const TOKEN_EXPIRY = {
  ACCESS_TOKEN: '15m',
  REFRESH_TOKEN: '7d',
  API_KEY: '1y'
};
```

#### Role-Based Access Control (RBAC)
```typescript
enum Permission {
  // Material permissions
  MATERIAL_READ = 'material:read',
  MATERIAL_WRITE = 'material:write',
  MATERIAL_DELETE = 'material:delete',
  
  // User management
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  USER_DELETE = 'user:delete',
  
  // System administration
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_LOGS = 'system:logs'
}

interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  isSystemRole: boolean;
}

// Predefined roles
const SYSTEM_ROLES = {
  ADMIN: ['material:*', 'user:*', 'system:*'],
  MANAGER: ['material:*', 'user:read', 'user:write'],
  OPERATOR: ['material:read', 'material:write'],
  VIEWER: ['material:read']
};
```

### Data Protection Standards

#### Encryption Requirements
- **At Rest**: AES-256 encryption for all sensitive data
- **In Transit**: TLS 1.3 minimum for all communications
- **Application Level**: Field-level encryption for PII data
- **Key Management**: Use dedicated key management service (AWS KMS, Azure Key Vault)

#### Data Classification
```typescript
enum DataClassification {
  PUBLIC = 'public',           // No restrictions
  INTERNAL = 'internal',       // Company internal use
  CONFIDENTIAL = 'confidential', // Restricted access
  RESTRICTED = 'restricted'    // Highest security level
}

interface DataField {
  name: string;
  classification: DataClassification;
  encryptionRequired: boolean;
  retentionPeriod: string;     // ISO 8601 duration
}
```

#### Input Validation & Sanitization
```typescript
// Input validation schemas using Joi/Zod
const MaterialSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9\s\-_]+$/),
  category: z.enum(['metal', 'plastic', 'ceramic', 'composite']),
  properties: z.record(z.string(), z.string()).optional(),
  description: z.string().max(1000).optional()
});

// SQL injection prevention
const getMaterialById = async (id: string): Promise<Material> => {
  // Use parameterized queries
  const query = 'SELECT * FROM materials WHERE id = $1';
  const result = await db.query(query, [id]);
  return result.rows[0];
};

// XSS prevention
const sanitizeHtml = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: []
  });
};
```

### Security Headers & Configuration
```typescript
// Express.js security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});
```

## Performance Standards

### Response Time Requirements
- **API Endpoints**: < 200ms for 95th percentile
- **Material Recognition**: < 1 second for standard images
- **Database Queries**: < 100ms for simple queries, < 500ms for complex
- **Page Load Time**: < 2 seconds for initial load, < 1 second for subsequent

### Scalability Requirements
- **Concurrent Users**: Support 10,000+ concurrent users
- **Request Throughput**: Handle 1,000+ requests per second
- **Data Volume**: Support 100TB+ of image data
- **Geographic Distribution**: Sub-200ms response times globally

### Caching Strategy
```typescript
// Redis caching patterns
interface CacheConfig {
  key: string;
  ttl: number;        // Time to live in seconds
  tags: string[];     // For cache invalidation
}

const CACHE_CONFIGS = {
  USER_PROFILE: { ttl: 3600, tags: ['user'] },
  MATERIAL_DATA: { ttl: 1800, tags: ['material'] },
  ML_PREDICTIONS: { ttl: 86400, tags: ['ml', 'prediction'] },
  API_RESPONSES: { ttl: 300, tags: ['api'] }
};

// Cache-aside pattern
const getMaterialWithCache = async (id: string): Promise<Material> => {
  const cacheKey = `material:${id}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from database
  const material = await db.getMaterial(id);
  
  // Store in cache
  await redis.setex(cacheKey, CACHE_CONFIGS.MATERIAL_DATA.ttl, 
                   JSON.stringify(material));
  
  return material;
};
```

### Database Performance
```sql
-- Index strategies
CREATE INDEX CONCURRENTLY idx_materials_category_created 
ON materials(category, created_at DESC);

CREATE INDEX CONCURRENTLY idx_materials_search 
ON materials USING gin(to_tsvector('english', name || ' ' || description));

-- Query optimization
EXPLAIN (ANALYZE, BUFFERS) 
SELECT m.*, COUNT(c.id) as classification_count
FROM materials m
LEFT JOIN classifications c ON m.id = c.material_id
WHERE m.category = 'metal'
  AND m.created_at >= NOW() - INTERVAL '30 days'
GROUP BY m.id
ORDER BY m.created_at DESC
LIMIT 20;
```

## Testing Standards

### Test Coverage Requirements
- **Unit Tests**: Minimum 80% code coverage
- **Integration Tests**: All API endpoints and database operations
- **End-to-End Tests**: Critical user journeys
- **Performance Tests**: Load testing for all services
- **Security Tests**: Vulnerability scanning and penetration testing

### Testing Frameworks & Patterns
```typescript
// Jest unit test example
describe('MaterialService', () => {
  let service: MaterialService;
  let mockRepository: jest.Mocked<MaterialRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new MaterialService(mockRepository);
  });

  describe('getMaterial', () => {
    it('should return material when found', async () => {
      // Arrange
      const materialId = 'mat_123';
      const expectedMaterial = createMockMaterial({ id: materialId });
      mockRepository.findById.mockResolvedValue(expectedMaterial);

      // Act
      const result = await service.getMaterial(materialId);

      // Assert
      expect(result).toEqual(expectedMaterial);
      expect(mockRepository.findById).toHaveBeenCalledWith(materialId);
    });

    it('should throw error when material not found', async () => {
      // Arrange
      const materialId = 'nonexistent';
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getMaterial(materialId))
        .rejects.toThrow(MaterialNotFoundError);
    });
  });
});
```

### API Testing Standards
```typescript
// Supertest integration test
describe('Materials API', () => {
  let app: Express;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = createApp({ database: testDb });
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('POST /api/v1/materials', () => {
    it('should create material with valid data', async () => {
      const materialData = {
        name: 'Test Material',
        category: 'metal',
        properties: { grade: 'A36' }
      };

      const response = await request(app)
        .post('/api/v1/materials')
        .set('Authorization', `Bearer ${validToken}`)
        .send(materialData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(materialData.name);
    });
  });
});
```

## Deployment Standards

### Environment Configuration
```yaml
# docker-compose.yml structure
version: '3.8'
services:
  api:
    image: kai-platform/api:${VERSION}
    environment:
      - NODE_ENV=${NODE_ENV}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

### CI/CD Pipeline Standards
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Tests
        run: |
          npm ci
          npm run test:unit
          npm run test:integration
          npm run test:e2e
      
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Security Scan
        run: |
          npm audit --audit-level high
          docker run --rm -v $(pwd):/app securecodewarrior/docker-security-scan
  
  deploy:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl apply -f k8s/
          kubectl rollout status deployment/kai-platform-api
```

### Monitoring & Alerting Standards
```typescript
// Prometheus metrics
const promClient = require('prom-client');

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const materialClassificationAccuracy = new promClient.Gauge({
  name: 'material_classification_accuracy',
  help: 'Current accuracy of material classification model',
  labelNames: ['model_version']
});

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION,
    checks: {
      database: checkDatabaseHealth(),
      redis: checkRedisHealth(),
      ml_service: checkMLServiceHealth()
    }
  };
  
  const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

## Documentation Standards

### Code Documentation
- **API Documentation**: OpenAPI/Swagger specifications for all endpoints
- **Code Comments**: Explain complex business logic and algorithms
- **README Files**: Clear setup and usage instructions for each service
- **Architecture Decisions**: Document all significant technical decisions

### API Documentation Example
```yaml
# OpenAPI specification
openapi: 3.0.0
info:
  title: KAI Platform API
  version: 1.0.0
  description: Material recognition and management platform

paths:
  /materials:
    post:
      summary: Create a new material
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateMaterialRequest'
      responses:
        '201':
          description: Material created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MaterialResponse'

components:
  schemas:
    CreateMaterialRequest:
      type: object
      required:
        - name
        - category
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        category:
          type: string
          enum: [metal, plastic, ceramic, composite]
```

---

*These standards ensure consistent, secure, and high-performance development across all KAI Platform components. All development teams must adhere to these guidelines and participate in regular reviews to maintain quality standards.*