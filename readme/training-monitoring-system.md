# Training Monitoring System

The Kai platform includes a comprehensive Training Monitoring System that provides real-time insights into machine learning model training processes. This system is accessible through the admin panel and offers tools for visualizing metrics, managing checkpoints, and tuning model parameters.

## Overview

The Training Monitoring System is designed to help administrators and ML engineers:

- Track training progress in real-time
- Visualize performance metrics through customizable charts
- Create and manage model checkpoints during training
- Compare checkpoint performance and model versions
- Fine-tune hyperparameters to optimize model performance
- Rollback to previous model versions when needed

## Architecture

The system consists of a parent TrainingMonitor component that integrates three specialized components:

1. **MetricsVisualizer**: Displays real-time training metrics with customizable charts
2. **CheckpointManager**: Manages model checkpoint operations (creation, comparison, rollback)
3. **ParameterTuner**: Allows adjustment of hyperparameters during training

![Training Monitor Architecture](../docs/images/training-monitor-architecture.png)

## Components

### TrainingMonitor

The TrainingMonitor serves as the container component that integrates all training monitoring functionality into a cohesive interface. It provides:

- Tab-based navigation between specialized components
- Unified job ID management
- Shared state for training parameters
- System-wide notifications and alerts

#### Implementation

The TrainingMonitor is implemented as a React component that dynamically loads its child components and manages state across them:

```typescript
// Simplified implementation
const TrainingMonitor: React.FC<TrainingMonitorProps> = ({ 
  jobId, 
  modelType,
  onComplete 
}) => {
  const [activeTab, setActiveTab] = useState('metrics');
  
  return (
    <Box>
      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
        <Tab value="metrics" label="Training Metrics" />
        <Tab value="checkpoints" label="Checkpoints" />
        <Tab value="parameters" label="Parameters" />
      </Tabs>
      
      {activeTab === 'metrics' && <MetricsVisualizer jobId={jobId} modelType={modelType} />}
      {activeTab === 'checkpoints' && <CheckpointManager jobId={jobId} modelType={modelType} />}
      {activeTab === 'parameters' && <ParameterTuner jobId={jobId} modelType={modelType} />}
    </Box>
  );
};
```

### MetricsVisualizer

The MetricsVisualizer component provides real-time visualization of training metrics. It offers:

- Interactive line charts for tracking metrics over time
- Customizable chart views and metric selection
- Support for comparing multiple training runs
- Data export and sharing capabilities
- Chart customization options (timeframes, scaling, etc.)

#### Key Features

- **Real-time Updates**: Displays training metrics as they're generated
- **Multi-metric Visualization**: Can show multiple metrics simultaneously (loss, accuracy, etc.)
- **Custom Visualization Controls**: Timeframe selection, smoothing, and scaling options
- **Adaptive Charts**: Automatically adjusts to available metrics for different model types
- **Performance Comparison**: Overlay metrics from previous training runs

#### Implementation

```typescript
// Simplified implementation
const MetricsVisualizer: React.FC<MetricsVisualizerProps> = ({ 
  jobId, 
  modelType 
}) => {
  const [metrics, setMetrics] = useState<TrainingMetrics[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['loss', 'accuracy']);
  const [timeframe, setTimeframe] = useState<Timeframe>('full');
  
  // Fetch metrics on interval
  useEffect(() => {
    // Implementation details
  }, [jobId]);
  
  return (
    <Box>
      <MetricControls 
        availableMetrics={getAvailableMetrics(modelType)}
        selectedMetrics={selectedMetrics}
        onMetricsChange={setSelectedMetrics}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />
      
      <MetricsChart 
        data={metrics}
        selectedMetrics={selectedMetrics}
        timeframe={timeframe}
      />
      
      <MetricsTable 
        data={metrics}
        selectedMetrics={selectedMetrics}
      />
    </Box>
  );
};
```

### CheckpointManager

The CheckpointManager component provides a comprehensive interface for managing model checkpoints during and after training. It enables:

- Viewing all available checkpoints with metadata
- Creating new checkpoints during training
- Comparing metrics between checkpoints
- Rolling back to previous checkpoints
- Managing checkpoint lifecycle

#### Key Features

- **Checkpoint Creation**: Create manual checkpoints during training with custom descriptions and tags
- **Checkpoint Comparison**: Side-by-side comparison of metrics and parameters between any two checkpoints
- **Visual Differencing**: Highlight parameter differences between checkpoints
- **Rollback Capability**: Roll back to any previous checkpoint
- **Tagging System**: Organize checkpoints with customizable tags

#### Implementation

The CheckpointManager integrates with the backend API to manage checkpoint operations:

```typescript
// Simplified implementation
const CheckpointManager: React.FC<CheckpointManagerProps> = ({
  jobId,
  modelType
}) => {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Load checkpoints using API
  const loadCheckpoints = async () => {
    try {
      setLoading(true);
      const result = await checkpointApi.fetchCheckpoints(jobId);
      setCheckpoints(result);
    } catch (err) {
      // Error handling
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch checkpoints when component mounts or jobId changes
  useEffect(() => {
    loadCheckpoints();
  }, [jobId]);
  
  return (
    <Box>
      {/* Create checkpoint button */}
      {/* Checkpoints table */}
      {/* Checkpoint comparison section */}
      {/* Dialogs for checkpoint operations */}
    </Box>
  );
};
```

### ParameterTuner

The ParameterTuner component allows administrators to adjust hyperparameters during training. It provides:

- Real-time adjustment of training parameters
- Visualization of parameter impact on training
- Preset parameter configurations for common scenarios
- Advanced parameter scheduling

#### Key Features

- **Dynamic Parameter Updates**: Adjust parameters while training is in progress
- **Parameter Presets**: Apply predefined parameter sets for common scenarios
- **Parameter Validation**: Ensure parameters stay within valid ranges
- **Parameter Scheduling**: Set up automatic parameter changes during training
- **Impact Analysis**: Visualize the impact of parameter changes on training metrics

#### Implementation

```typescript
// Simplified implementation
const ParameterTuner: React.FC<ParameterTunerProps> = ({
  jobId,
  modelType
}) => {
  const [parameters, setParameters] = useState<Record<string, number>>({});
  const [presets, setPresets] = useState<ParameterPreset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Load current parameters
  useEffect(() => {
    // Implementation details
  }, [jobId]);
  
  const handleParameterChange = async (key: string, value: number) => {
    try {
      await parameterApi.updateParameter(jobId, key, value);
      setParameters(prev => ({ ...prev, [key]: value }));
    } catch (err) {
      // Error handling
    }
  };
  
  return (
    <Box>
      <ParameterControls 
        parameters={parameters}
        onChange={handleParameterChange}
        presets={presets}
        onApplyPreset={handleApplyPreset}
      />
      
      <ParameterImpactChart 
        jobId={jobId}
        parameterChanges={parameterChanges}
      />
    </Box>
  );
};
```

## Integration with Admin Panel

The Training Monitoring System is integrated into the admin panel through a dedicated "Training" page. This page provides access to all training monitoring capabilities and is accessible to administrators with appropriate permissions.

### URL Structure

- `/admin/training` - Main training dashboard
- `/admin/training/:jobId` - Specific training job monitoring

### Access Control

The training monitoring features require specific permissions:

- `training:view` - View training metrics and checkpoints
- `training:manage` - Create checkpoints and adjust parameters
- `training:admin` - Roll back to previous checkpoints and manage training jobs

## API Integration

The Training Monitoring System integrates with several backend APIs:

### Metrics API

- `GET /api/admin/training/:jobId/metrics` - Fetch training metrics
- `GET /api/admin/training/:jobId/metrics/latest` - Get latest metrics

### Checkpoint API

- `GET /api/admin/training/:jobId/checkpoints` - List all checkpoints
- `POST /api/admin/training/:jobId/checkpoints` - Create a new checkpoint
- `PUT /api/admin/training/:jobId/checkpoints/:checkpointId/rollback` - Roll back to a checkpoint
- `DELETE /api/admin/training/:jobId/checkpoints/:checkpointId` - Delete a checkpoint

### Parameter API

- `GET /api/admin/training/:jobId/parameters` - Get current parameters
- `PUT /api/admin/training/:jobId/parameters/:key` - Update a parameter
- `POST /api/admin/training/:jobId/parameters/preset/:presetId` - Apply a parameter preset

## Usage Examples

### Monitoring Training Progress

1. Navigate to Admin Panel > Training
2. Select an active training job
3. View the MetricsVisualizer tab to monitor training progress
4. Customize the chart view to focus on relevant metrics
5. Export metrics data if needed for further analysis

### Managing Checkpoints

1. Navigate to Admin Panel > Training > [Job ID]
2. Click on the Checkpoints tab
3. View existing checkpoints and their metrics
4. Create a new checkpoint with a descriptive name and relevant tags
5. Compare checkpoints by selecting two checkpoints for side-by-side comparison
6. Roll back to a previous checkpoint if needed

### Tuning Parameters

1. Navigate to Admin Panel > Training > [Job ID]
2. Click on the Parameters tab
3. Adjust parameters as needed based on training performance
4. Apply a parameter preset for common scenarios
5. Observe the impact of parameter changes on the training metrics

## Best Practices

1. **Regular Checkpointing**: Create checkpoints at key moments during training to enable easy rollback if needed
2. **Descriptive Naming**: Use clear, descriptive names and tags for checkpoints to facilitate management
3. **Parameter Tuning**: Make small, incremental changes to parameters to understand their impact
4. **Metric Monitoring**: Focus on multiple metrics to get a comprehensive view of training performance
5. **Comparison Analysis**: Regularly compare checkpoints to understand the impact of changes
6. **Documentation**: Document parameter changes and their impacts for future reference

## Troubleshooting

Common issues and their solutions:

| Issue | Solution |
|-------|----------|
| Metrics not updating | Check that the training job is active and properly connected to the metrics system |
| Checkpoint creation fails | Ensure sufficient storage space and proper permissions |
| Parameter changes have no effect | Verify that the training system supports live parameter updates |
| Chart display issues | Try adjusting the timeframe or refreshing the page |
| Rollback operation fails | Check training job status and ensure the checkpoint is compatible |

## Future Enhancements

Planned improvements for the Training Monitoring System:

1. **Automated Checkpoint Recommendations**: AI-driven suggestions for when to create checkpoints
2. **Advanced Visualization Tools**: 3D parameter space visualization and correlation analysis
3. **Collaborative Annotations**: Allow team members to annotate checkpoints and training runs
4. **Predictive Analytics**: Predict training outcomes based on current metrics and parameters
5. **Integration with Experiment Tracking**: Connect with experiment tracking systems like MLflow or Weights & Biases

## Related Documentation

- [ML Training API Improvements](./ml-training-api-improvements.md)
- [Monitoring System](./monitoring-system.md)
- [Admin Panel](./admin-panel.md)
- [Model Extension Guide](../packages/shared/src/docs/model-extension-guide.md)