+++
id = "kai-platform-implementation-guide"
title = "KAI Platform - Implementation Guide & Procedures"
context_type = "documentation"
scope = "User workflows, operational procedures, and implementation guidance"
target_audience = ["roo-commander", "manager-project", "lead-*", "dev-*", "util-junior-dev", "all"]
granularity = "detailed"
status = "active"
last_updated = "2025-07-08"
version = "1.0"
tags = ["kai-platform", "implementation", "guide", "procedures", "workflows", "user-guide", "operations"]
related_context = [
    ".ruru/docs/kai_platform_overview.md",
    ".ruru/docs/architecture/kai_platform_architecture.md",
    ".ruru/docs/standards/kai_platform_standards.md"
]
template_schema_doc = ".ruru/templates/toml-md/09_documentation.md"
relevance = "Critical: Practical implementation guidance for all stakeholders"
+++

# KAI Platform - Implementation Guide & Procedures

## Getting Started

### Development Environment Setup

#### Prerequisites
- **Node.js**: Version 18+ with npm/yarn
- **Python**: Version 3.9+ with pip
- **Docker**: Latest stable version
- **Git**: Version control system
- **IDE**: VS Code with recommended extensions

#### Initial Setup Steps
```bash
# 1. Clone the repository
git clone https://github.com/organization/kai-platform.git
cd kai-platform

# 2. Install dependencies
npm install                    # Root dependencies
cd services/api && npm install # API service
cd ../ml-service && pip install -r requirements.txt

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Start development services
docker-compose up -d postgres redis elasticsearch
npm run dev                    # Starts all services in development mode
```

#### Environment Configuration
```bash
# .env file structure
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/kai_platform_dev
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# ML Service Configuration
ML_MODEL_PATH=/app/models
CONFIDENCE_THRESHOLD=0.85
BATCH_SIZE=32

# External Services
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET_NAME=kai-platform-storage
```

### Project Structure Overview
```
kai-platform/
├── services/
│   ├── api/                 # Main API service (Node.js)
│   ├── auth/                # Authentication service
│   ├── ml-service/          # ML processing service (Python)
│   ├── user-service/        # User management service
│   └── analytics/           # Analytics and reporting
├── web/                     # React web application
├── mobile/                  # React Native mobile app
├── shared/                  # Shared libraries and types
├── infrastructure/          # Kubernetes manifests, Terraform
├── docs/                    # Documentation
└── scripts/                 # Build and deployment scripts
```

## Development Workflows

### Feature Development Process

#### 1. Planning Phase
```markdown
# Feature Planning Checklist
- [ ] Create feature specification document
- [ ] Define acceptance criteria
- [ ] Identify affected services and components
- [ ] Estimate development effort
- [ ] Plan testing strategy
- [ ] Review security implications
- [ ] Get stakeholder approval
```

#### 2. Implementation Workflow
```bash
# 1. Create feature branch
git checkout -b feature/material-batch-processing

# 2. Implement changes following standards
# - Write tests first (TDD approach)
# - Follow coding standards
# - Update documentation

# 3. Run local tests
npm run test:unit
npm run test:integration
npm run lint
npm run type-check

# 4. Create pull request
git push origin feature/material-batch-processing
# Open PR with proper description and checklist
```

#### 3. Code Review Process
```markdown
# PR Review Checklist
## Functionality
- [ ] Feature works as specified
- [ ] Edge cases are handled
- [ ] Error handling is appropriate

## Code Quality
- [ ] Follows coding standards
- [ ] No code duplication
- [ ] Proper naming conventions
- [ ] Adequate comments for complex logic

## Testing
- [ ] Unit tests cover new functionality
- [ ] Integration tests pass
- [ ] Manual testing completed

## Security
- [ ] No security vulnerabilities
- [ ] Input validation implemented
- [ ] Authentication/authorization correct

## Performance
- [ ] No performance regressions
- [ ] Database queries optimized
- [ ] Caching implemented where appropriate
```

### Database Management

#### Migration Workflow
```bash
# 1. Create new migration
npm run migration:create add_material_properties_table

# 2. Edit migration file
# services/api/migrations/20250708172140_add_material_properties_table.js

# 3. Run migration in development
npm run migration:up

# 4. Test rollback
npm run migration:down
npm run migration:up

# 5. Update seeds if necessary
npm run seed:run
```

#### Migration Best Practices
```javascript
// Example migration file
exports.up = function(knex) {
  return knex.schema.createTable('material_properties', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('material_id').notNullable()
         .references('id').inTable('materials').onDelete('CASCADE');
    table.string('property_name', 100).notNullable();
    table.text('property_value').notNullable();
    table.timestamps(true, true);
    
    table.unique(['material_id', 'property_name']);
    table.index('material_id');
    table.index('property_name');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('material_properties');
};
```

### API Development Guidelines

#### Creating New Endpoints
```typescript
// 1. Define route in router
// services/api/src/routes/materials.ts
import { Router } from 'express';
import { MaterialController } from '../controllers/MaterialController';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { materialSchema } from '../schemas/material';

const router = Router();
const controller = new MaterialController();

router.post('/materials',
  authenticate,
  authorize(['material:write']),
  validateRequest(materialSchema.create),
  controller.create
);

// 2. Implement controller
// services/api/src/controllers/MaterialController.ts
export class MaterialController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const materialData = req.body;
      const userId = req.user.id;
      
      const material = await this.materialService.create(materialData, userId);
      
      res.status(201).json({
        success: true,
        data: material,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }
}

// 3. Add validation schema
// services/api/src/schemas/material.ts
import Joi from 'joi';

export const materialSchema = {
  create: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    category: Joi.string().valid('metal', 'plastic', 'ceramic', 'composite').required(),
    properties: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    description: Joi.string().max(1000).optional()
  })
};
```

#### API Testing
```typescript
// services/api/tests/integration/materials.test.ts
describe('Materials API', () => {
  let app: Express;
  let testDb: TestDatabase;
  let authToken: string;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    app = createTestApp({ database: testDb });
    authToken = await createTestUser();
  });

  describe('POST /api/v1/materials', () => {
    it('should create material with valid data', async () => {
      const materialData = {
        name: 'Test Steel',
        category: 'metal',
        properties: { grade: 'A36', thickness: '5mm' }
      };

      const response = await request(app)
        .post('/api/v1/materials')
        .set('Authorization', `Bearer ${authToken}`)
        .send(materialData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(materialData.name);
      expect(response.body.data.id).toBeDefined();
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = { name: '' }; // Missing required fields

      await request(app)
        .post('/api/v1/materials')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });
});
```

## ML Model Development

### Model Training Pipeline

#### 1. Data Preparation
```python
# scripts/prepare_training_data.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from PIL import Image
import torch
from torchvision import transforms

class MaterialDataset:
    def __init__(self, data_path: str, transform=None):
        self.data = pd.read_csv(f"{data_path}/annotations.csv")
        self.image_dir = f"{data_path}/images"
        self.transform = transform
        
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        row = self.data.iloc[idx]
        image_path = f"{self.image_dir}/{row['filename']}"
        image = Image.open(image_path).convert('RGB')
        
        if self.transform:
            image = self.transform(image)
            
        return {
            'image': image,
            'label': row['category_id'],
            'material_id': row['material_id']
        }

# Data augmentation pipeline
train_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(degrees=15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                        std=[0.229, 0.224, 0.225])
])
```

#### 2. Model Architecture
```python
# services/ml-service/src/models/material_classifier.py
import torch
import torch.nn as nn
from torchvision.models import efficientnet_b0
from typing import Dict, List

class MaterialClassifier(nn.Module):
    def __init__(self, num_classes: int, pretrained: bool = True):
        super().__init__()
        self.backbone = efficientnet_b0(pretrained=pretrained)
        
        # Replace classifier head
        in_features = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(in_features, 512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, num_classes)
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)
    
    def predict_with_confidence(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        logits = self.forward(x)
        probabilities = torch.softmax(logits, dim=1)
        confidence, predicted = torch.max(probabilities, 1)
        
        return {
            'predictions': predicted,
            'confidence': confidence,
            'probabilities': probabilities
        }
```

#### 3. Training Script
```python
# scripts/train_model.py
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import wandb
from tqdm import tqdm

class ModelTrainer:
    def __init__(self, model, train_loader, val_loader, config):
        self.model = model
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.config = config
        
        self.criterion = nn.CrossEntropyLoss()
        self.optimizer = torch.optim.AdamW(
            model.parameters(), 
            lr=config.learning_rate,
            weight_decay=config.weight_decay
        )
        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer, T_max=config.epochs
        )
        
    def train_epoch(self) -> float:
        self.model.train()
        total_loss = 0
        correct = 0
        total = 0
        
        for batch in tqdm(self.train_loader, desc="Training"):
            images, labels = batch['image'], batch['label']
            
            self.optimizer.zero_grad()
            outputs = self.model(images)
            loss = self.criterion(outputs, labels)
            loss.backward()
            self.optimizer.step()
            
            total_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
        accuracy = 100 * correct / total
        avg_loss = total_loss / len(self.train_loader)
        
        return avg_loss, accuracy
    
    def validate(self) -> float:
        self.model.eval()
        total_loss = 0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for batch in tqdm(self.val_loader, desc="Validation"):
                images, labels = batch['image'], batch['label']
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)
                
                total_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
        
        accuracy = 100 * correct / total
        avg_loss = total_loss / len(self.val_loader)
        
        return avg_loss, accuracy
```

### Model Deployment

#### 1. Model Serving
```python
# services/ml-service/src/api/prediction.py
from fastapi import FastAPI, File, UploadFile, HTTPException
from PIL import Image
import torch
import io
import numpy as np
from typing import Dict, List

app = FastAPI()

class ModelService:
    def __init__(self, model_path: str):
        self.model = self.load_model(model_path)
        self.categories = self.load_categories()
        
    def load_model(self, model_path: str):
        model = MaterialClassifier(num_classes=len(self.categories))
        model.load_state_dict(torch.load(model_path, map_location='cpu'))
        model.eval()
        return model
    
    def preprocess_image(self, image: Image.Image) -> torch.Tensor:
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                               std=[0.229, 0.224, 0.225])
        ])
        return transform(image).unsqueeze(0)
    
    async def predict(self, image: Image.Image) -> Dict:
        try:
            # Preprocess image
            input_tensor = self.preprocess_image(image)
            
            # Make prediction
            with torch.no_grad():
                result = self.model.predict_with_confidence(input_tensor)
            
            # Format response
            prediction_id = result['predictions'][0].item()
            confidence = result['confidence'][0].item()
            
            return {
                'category': self.categories[prediction_id],
                'confidence': float(confidence),
                'all_probabilities': {
                    cat: float(prob) for cat, prob in 
                    zip(self.categories, result['probabilities'][0])
                }
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

model_service = ModelService('/app/models/latest.pth')

@app.post("/predict")
async def predict_material(file: UploadFile = File(...)):
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read and process image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert('RGB')
    
    # Make prediction
    result = await model_service.predict(image)
    
    return {
        'success': True,
        'data': result,
        'meta': {
            'model_version': '1.0.0',
            'timestamp': datetime.utcnow().isoformat()
        }
    }
```

## Frontend Development

### React Component Development

#### 1. Component Structure
```typescript
// web/src/components/MaterialCard/MaterialCard.tsx
import React from 'react';
import { Material } from '../../types/material';
import { Card, CardContent, CardActions, Button, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

interface MaterialCardProps {
  material: Material;
  onEdit?: (material: Material) => void;
  onDelete?: (materialId: string) => void;
  onClassify?: (material: Material) => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  maxWidth: 345,
  margin: theme.spacing(1),
  transition: 'transform 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}));

export const MaterialCard: React.FC<MaterialCardProps> = ({
  material,
  onEdit,
  onDelete,
  onClassify
}) => {
  const handleEdit = () => onEdit?.(material);
  const handleDelete = () => onDelete?.(material.id);
  const handleClassify = () => onClassify?.(material);

  return (
    <StyledCard>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          {material.name}
        </Typography>
        
        <Chip 
          label={material.category} 
          color="primary" 
          size="small"
          sx={{ mb: 1 }}
        />
        
        {material.description && (
          <Typography variant="body2" color="text.secondary">
            {material.description}
          </Typography>
        )}
        
        {material.properties && Object.keys(material.properties).length > 0 && (
          <Box sx={{ mt: 1 }}>
            {Object.entries(material.properties).map(([key, value]) => (
              <Chip
                key={key}
                label={`${key}: ${value}`}
                variant="outlined"
                size="small"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
          </Box>
        )}
      </CardContent>
      
      <CardActions>
        <Button size="small" onClick={handleEdit}>
          Edit
        </Button>
        <Button size="small" onClick={handleClassify}>
          Classify
        </Button>
        <Button size="small" color="error" onClick={handleDelete}>
          Delete
        </Button>
      </CardActions>
    </StyledCard>
  );
};
```

#### 2. State Management with Redux Toolkit
```typescript
// web/src/store/slices/materialSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Material, CreateMaterialRequest } from '../../types/material';
import { materialApi } from '../../api/material';

interface MaterialState {
  materials: Material[];
  loading: boolean;
  error: string | null;
  selectedMaterial: Material | null;
}

const initialState: MaterialState = {
  materials: [],
  loading: false,
  error: null,
  selectedMaterial: null,
};

// Async thunks
export const fetchMaterials = createAsyncThunk(
  'materials/fetchMaterials',
  async (params?: { category?: string; page?: number }) => {
    const response = await materialApi.getMaterials(params);
    return response.data;
  }
);

export const createMaterial = createAsyncThunk(
  'materials/createMaterial',
  async (materialData: CreateMaterialRequest) => {
    const response = await materialApi.createMaterial(materialData);
    return response.data;
  }
);

// Slice
const materialSlice = createSlice({
  name: 'materials',
  initialState,
  reducers: {
    setSelectedMaterial: (state, action) => {
      state.selectedMaterial = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMaterials.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMaterials.fulfilled, (state, action) => {
        state.loading = false;
        state.materials = action.payload;
      })
      .addCase(fetchMaterials.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch materials';
      });
  },
});

export const { setSelectedMaterial, clearError } = materialSlice.actions;
export default materialSlice.reducer;
```

### Mobile Development (React Native)

#### 1. Camera Integration
```typescript
// mobile/src/components/CameraCapture/CameraCapture.tsx
import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, Alert } from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useMaterialClassification } from '../../hooks/useMaterialClassification';

interface CameraCaptureProps {
  onCapture: (imageUri: string, classification?: ClassificationResult) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [type, setType] = useState(CameraType.back);
  const cameraRef = useRef<Camera>(null);
  const { classifyImage, loading } = useMaterialClassification();

  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        
        // Classify the image
        const classification = await classifyImage(photo.uri);
        
        onCapture(photo.uri, classification);
      } catch (error) {
        Alert.alert('Error', 'Failed to capture image');
      }
    }
  };

  if (hasPermission === null) {
    return <View />;
  }
  
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera style={styles.camera} type={type} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={() => {
              setType(
                type === CameraType.back ? CameraType.front : CameraType.back
              );
            }}
          >
            <MaterialIcons name="flip-camera-ios" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.captureButton}
            onPress={takePicture}
            disabled={loading}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </Camera>
    </View>
  );
};
```

## Deployment Procedures

### Production Deployment

#### 1. Pre-deployment Checklist
```markdown
# Production Deployment Checklist

## Code Quality
- [ ] All tests passing (unit, integration, e2e)
- [ ] Code review completed and approved
- [ ] Security scan completed with no critical issues
- [ ] Performance testing completed
- [ ] Documentation updated

## Infrastructure
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] SSL certificates valid
- [ ] Monitoring and alerting configured
- [ ] Backup procedures verified

## Rollback Plan
- [ ] Rollback procedure documented
- [ ] Database rollback scripts prepared
- [ ] Previous version artifacts available
- [ ] Rollback triggers defined
```

#### 2. Deployment Script
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}

echo "Deploying KAI Platform to $ENVIRONMENT (version: $VERSION)"

# 1. Build and tag images
docker build -t kai-platform/api:$VERSION ./services/api
docker build -t kai-platform/ml-service:$VERSION ./services/ml-service
docker build -t kai-platform/web:$VERSION ./web

# 2. Push to registry
docker push kai-platform/api:$VERSION
docker push kai-platform/ml-service:$VERSION
docker push kai-platform/web:$VERSION

# 3. Update Kubernetes manifests
sed -i "s/{{VERSION}}/$VERSION/g" infrastructure/k8s/$ENVIRONMENT/*.yaml

# 4. Apply database migrations
kubectl exec -it deployment/api -- npm run migration:up

# 5. Deploy to Kubernetes
kubectl apply -f infrastructure/k8s/$ENVIRONMENT/

# 6. Wait for rollout to complete
kubectl rollout status deployment/api
kubectl rollout status deployment/ml-service
kubectl rollout status deployment/web

# 7. Run smoke tests
npm run test:smoke -- --env=$ENVIRONMENT

echo "Deployment completed successfully!"
```

#### 3. Kubernetes Configuration
```yaml
# infrastructure/k8s/production/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kai-platform-api
  namespace: kai-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kai-platform-api
  template:
    metadata:
      labels:
        app: kai-platform-api
    spec:
      containers:
      - name: api
        image: kai-platform/api:{{VERSION}}
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: kai-platform-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Monitoring & Maintenance

### Application Monitoring

#### 1. Health Checks
```typescript
// services/api/src/routes/health.ts
import { Router } from 'express';
import { DatabaseHealthCheck } from '../health/DatabaseHealthCheck';
import { RedisHealthCheck } from '../health/RedisHealthCheck';
import { MLServiceHealthCheck } from '../health/MLServiceHealthCheck';

const router = Router();

router.get('/health', async (req, res) => {
  const checks = await Promise.allSettled([
    DatabaseHealthCheck.check(),
    RedisHealthCheck.check(),
    MLServiceHealthCheck.check(),
  ]);

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || 'unknown',
    checks: {
      database: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'unhealthy', error: checks[0].reason },
      redis: checks[1].status === 'fulfilled' ? checks[1].value : { status: 'unhealthy', error: checks[1].reason },
      mlService: checks[2].status === 'fulfilled' ? checks[2].value : { status: 'unhealthy', error: checks[2].reason },
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
  health.status = isHealthy ? 'healthy' : 'unhealthy';

  res.status(isHealthy ? 200 : 503).json(health);
});

router.get('/ready', async (req, res) => {
  // Simplified readiness check
  try {
    await DatabaseHealthCheck.check();
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

#### 2. Metrics Collection
```typescript
// services/api/src/middleware/metrics.ts
import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const materialClassificationAccuracy = new promClient.Gauge({
  name: 'material_classification_accuracy',
  help: 'Current accuracy of material classification model',
  labelNames: ['model_version']
});

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestsTotal
      .labels