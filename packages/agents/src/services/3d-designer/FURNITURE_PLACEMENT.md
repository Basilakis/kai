# Furniture Placement with ThreeDDesignerAgent

The ThreeDDesignerAgent now includes intelligent furniture placement capabilities using DiffuScene for layout generation and PyBullet for physics-based validation.

## Setup

1. Install dependencies:
```bash
cd packages/agents
npm install
cd src/services/3d-designer/python
pip install -r requirements.txt
```

2. Configure the agent:
```typescript
const agent = new ThreeDDesignerAgent({
  knowledgeBaseUrl: "your-kb-url",
  modelEndpoints: {
    // ... other endpoints
  },
  threeDFrontPath: "/path/to/3d-front-dataset"
});
```

## Using Furniture Placement

Send a furniture placement request to the agent:

```typescript
const response = await agent.processTextInput({
  description: "task description here",
  type: "furniture_placement",
  style: "modern",
  constraints: {
    roomDimensions: {
      width: 5,
      length: 6,
      height: 3
    },
    specific: {
      minSpacing: 0.5,
      walkwayWidth: 1.0,
      alignToWalls: true
    },
    existingFurniture: [] // Optional: existing furniture to consider
  }
});
```

## How It Works

1. **Text Processing**: The agent processes natural language descriptions of desired room layouts.

2. **Layout Generation**: DiffuScene generates initial furniture arrangements based on:
   - Room dimensions
   - Style preferences
   - Spatial relationships
   - Existing furniture

3. **Physics Validation**: PyBullet validates the layout by:
   - Checking for collisions
   - Ensuring stability
   - Maintaining clearances
   - Optimizing placement

4. **Asset Matching**: The system matches furniture with 3D-FRONT models for:
   - Accurate dimensions
   - Physical properties
   - Visual representation

5. **Explanation Generation**: The agent provides detailed explanations of:
   - Placement decisions
   - Space optimization
   - Style considerations
   - Alternative arrangements

## Example Response

```typescript
{
  success: true,
  result: {
    furniture: [
      {
        type: "sofa",
        position: { x: 2, y: 0, z: 1.5 },
        rotation: { y: 0 },
        dimensions: { width: 2.2, height: 0.9, depth: 1 }
      },
      // ... more furniture items
    ]
  },
  assets: [
    {
      id: "sofa_123",
      modelPath: "/path/to/model.obj",
      category: "sofa",
      dimensions: { width: 2.2, height: 0.9, depth: 1 }
    }
    // ... more assets
  ],
  physicsValidation: true,
  explanation: "Detailed explanation of the furniture placement..."
}
```

## Integration with Other Features

The furniture placement capability integrates seamlessly with other ThreeDDesignerAgent features:

- **Material Suggestions**: Get matching material recommendations for furniture
- **Scene Refinement**: Iteratively refine furniture placement based on feedback
- **3D Visualization**: Generate visualizations of the furnished space

## Best Practices

1. **Room Description**:
   - Provide clear room dimensions
   - Specify style preferences
   - Mention any specific constraints
   - List existing furniture if applicable

2. **Constraints**:
   - Set reasonable minimum spacing
   - Define walkway requirements
   - Specify wall alignment preferences
   - Include any special requirements

3. **Feedback Loop**:
   - Review the initial placement
   - Provide specific feedback for refinements
   - Check physics validation results
   - Consider alternative arrangements

## Error Handling

The system handles various error cases:
- Invalid room dimensions
- Impossible constraints
- Physics validation failures
- Asset loading issues

## Performance Considerations

- Physics validation is computationally intensive
- Large rooms with many furniture items may take longer to process
- Consider batching multiple placement requests
- Cache frequently used 3D-FRONT assets

## Future Enhancements

Planned improvements include:
- Multi-room layout support
- Dynamic furniture grouping
- Real-time placement updates
- Advanced style matching
- Custom furniture model support