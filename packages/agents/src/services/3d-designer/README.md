# 3D Designer Service

This service provides automated furniture placement capabilities using DiffuScene for layout generation and PyBullet for physics-based validation and optimization.

## Features

- Automatic furniture arrangement based on room descriptions
- Physics-based validation using PyBullet
- Integration with 3D-FRONT dataset for furniture models
- Collision detection and resolution
- Support for custom placement constraints

## Setup

1. Install Node.js dependencies:
```bash
cd packages/agents
npm install
```

2. Install Python dependencies:
```bash
cd src/services/3d-designer/python
pip install -r requirements.txt
```

3. Set up 3D-FRONT dataset:
- Download the 3D-FRONT dataset
- Set the path in your environment configuration

## Usage

### Basic Example

```typescript
import { FurniturePlacementService } from './furniturePlacementService';

const service = new FurniturePlacementService({
  threeDFrontPath: '/path/to/3d-front'
});

// Generate furniture placement
const result = await service.generateFurniturePlacement(
  'A living room with a sofa and coffee table',
  {
    roomDimensions: {
      width: 5,
      length: 6,
      height: 3
    },
    style: 'modern'
  }
);

// Clean up when done
await service.cleanup();
```

### With Custom Constraints

```typescript
const result = await service.generateFurniturePlacement(
  'A living room with a sofa and coffee table',
  {
    roomDimensions: {
      width: 5,
      length: 6,
      height: 3
    },
    style: 'modern',
    specificConstraints: {
      minSpacing: 0.5,
      walkwayWidth: 1.0,
      alignToWalls: true
    }
  }
);
```

## Architecture

The service uses a multi-stage pipeline:

1. **Layout Generation** (DiffuScene):
   - Processes text descriptions into initial furniture layouts
   - Considers room dimensions and style preferences
   - Generates preliminary furniture positions and orientations

2. **Asset Matching** (3D-FRONT):
   - Maps layout items to actual 3D models
   - Provides accurate dimensions and physical properties

3. **Physics Validation** (PyBullet):
   - Validates furniture placement using physics simulation
   - Detects collisions and stability issues
   - Optimizes placement to resolve conflicts

## Integration Details

### DiffuScene Integration

The service uses DiffuScene for initial layout generation. DiffuScene processes natural language descriptions and generates furniture arrangements considering:
- Room dimensions
- Furniture types and relationships
- Style preferences
- Spatial constraints

### PyBullet Integration

PyBullet provides physics-based validation through:
- Collision detection between furniture items
- Stability checking
- Automatic collision resolution
- Support for custom physical constraints

### 3D-FRONT Dataset

The service uses the 3D-FRONT dataset for:
- Realistic furniture models
- Accurate dimensions
- Material properties
- Category-based asset matching

## Error Handling

The service includes comprehensive error handling for:
- Invalid room dimensions
- Unsupported furniture types
- Physics simulation failures
- Asset loading issues

## Contributing

When contributing to this service:
1. Ensure Python dependencies are up to date
2. Run tests before submitting changes
3. Follow the existing code style
4. Update documentation as needed

## License

This service is part of the KAI platform and follows the project's licensing terms.