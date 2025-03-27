# Training API Improvements

This document outlines the improvements made to the Material Recognition training API, enhancing its capabilities with state-of-the-art machine learning techniques.

## Overview of Improvements

The following improvements have been implemented:

1. **Transfer Learning Capabilities**: Fine-tune existing models with small datasets
2. **Automated Hyperparameter Optimization**: Implement techniques like grid search, random search, and Bayesian optimization
3. **Distributed Training with Supabase**: Replace Redis with Supabase for scaling training jobs
4. **Training Progress Visualization**: Enhanced progress reporting with real-time charts and metrics
5. **Active Learning Integration**: Prioritize samples for manual labeling based on model uncertainty
6. **Automated Model Retraining Triggers**: Automatically retrain when data changes significantly

## Architecture

The improved training API consists of several interconnected modules:

- **Transfer Learning Module** (`transfer_learning.py`): Enables fine-tuning of pre-trained models
- **Hyperparameter Optimization Module** (`hyperparameter_optimization.py`): Automatically finds optimal model parameters
- **Distributed Training Module** (`distributed_training.py`): Coordinates distributed training using Supabase
- **Training Visualization Module** (`training_visualization.py`): Provides enhanced visualizations of training metrics
- **Active Learning Module** (`active_learning.py`): Implements uncertainty-based sample selection for labeling
- **Unified Training API** (`training_api.py`): Integrates all improvements into a cohesive system

## Features

### Transfer Learning

The transfer learning module allows you to leverage pre-trained models and fine-tune them with smaller datasets. This approach dramatically reduces training time and improves performance when training data is limited.

Features:
- Support for TensorFlow and PyTorch frameworks
- Customizable fine-tuning strategies
- Layer freezing options to control what gets retrained
- Data augmentation techniques for small datasets

### Hyperparameter Optimization

The hyperparameter optimization module automates the process of finding optimal model parameters, eliminating manual trial and error.

Supported optimization strategies:
- Grid Search: Exhaustively searches through a specified parameter grid
- Random Search: Randomly samples from parameter distributions
- Bayesian Optimization: Uses probabilistic models to guide the search process

### Distributed Training with Supabase

The distributed training module replaces Redis with Supabase for coordination and parameter sharing, providing:

- Scalable job queue management
- Worker coordination
- Parameter sharing across nodes
- Progress tracking and monitoring
- Fault tolerance and job recovery

### Training Progress Visualization

The visualization module enhances progress reporting with detailed charts and metrics:

- Real-time training metrics visualization
- Learning curve analysis
- Confusion matrix visualization
- Model performance comparisons
- Exportable reports in various formats (HTML, JSON, PNG)

### Active Learning

The active learning module helps prioritize samples for manual labeling:

- Uncertainty-based sample selection
- Diversity sampling strategies
- Batch labeling workflow
- Integration with the feedback system

### Automated Retraining Triggers

The system can automatically trigger model retraining based on various conditions:

- Feedback count threshold
- Time-based triggers
- Uncertainty threshold triggers
- Distribution shift detection

## Usage

### Unified API

The unified training API provides a simple interface to access all improvements:

```python
from training_api import EnhancedTrainingAPI, train_with_all_improvements

# Quick start with all improvements
result = train_with_all_improvements(
    dataset_path="path/to/dataset",
    model_type="hybrid",
    use_transfer_learning=True,
    optimize_hyperparams=True,
    distributed=True,
    num_workers=4
)

# Or use the full API for more control
api = EnhancedTrainingAPI(
    base_dir="./training",
    supabase_url="your_supabase_url",
    supabase_key="your_supabase_key",
    use_distributed=True,
    enable_transfer_learning=True,
    enable_hyperparameter_optimization=True,
    enable_active_learning=True,
    visualization_level="detailed",
    num_workers=4
)

# Train a model
training_result = api.train_model(
    dataset_path="path/to/dataset",
    model_type="hybrid",
    pretrained_model_path="path/to/pretrained/model",
    optimize_hyperparams=True
)

# Get samples for labeling
labeling_batch = api.get_samples_for_labeling(count=10)

# Record feedback
feedback_result = api.record_labeling_feedback(
    sample_id="sample_123",
    correct_material_id="material_456",
    batch_id="batch_789"
)

# Retrain from feedback
retrain_result = api.retrain_from_feedback(
    model_type="hybrid",
    feedback_threshold=10
)
```

### Command Line Interface

You can also use the command line interface:

```bash
# Train a model with all improvements
python training_api.py train \
    --dataset path/to/dataset \
    --model-type hybrid \
    --use-distributed \
    --optimize-hyperparams \
    --use-transfer-learning \
    --num-workers 4

# Active learning operations
python training_api.py active-learning \
    --operation select \
    --data-dir ./data \
    --model-dir ./models \
    --count 10

# Start retraining monitor
python training_api.py monitor \
    --data-dir ./data \
    --model-dir ./models \
    --check-interval 3600

# Distributed training operations
python training_api.py distributed \
    --operation start-workers \
    --data-dir ./data \
    --model-dir ./models \
    --num-workers 4
```

## Configuration

The training API can be configured with environment variables or explicitly in code:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `SUPABASE_URL` | Supabase URL for distributed features | None |
| `SUPABASE_KEY` | Supabase API key | None |
| `NUM_WORKERS` | Number of worker processes | 1 |
| `VISUALIZATION_LEVEL` | Level of visualization detail | "standard" |
| `ENABLE_TRANSFER_LEARNING` | Whether to enable transfer learning | True |
| `ENABLE_HYPERPARAMETER_OPT` | Whether to enable hyperparameter optimization | True |
| `ENABLE_ACTIVE_LEARNING` | Whether to enable active learning | True |

## Integration with Supabase

The Supabase integration replaces Redis for various distributed functions:

1. **Job Queue Management**: Training jobs are stored in Supabase tables
2. **Parameter Sharing**: Model parameters are stored and retrieved from Supabase
3. **Progress Tracking**: Training progress is recorded in Supabase for real-time monitoring
4. **Active Learning Storage**: Samples, batches, and triggers are stored in Supabase

Required Supabase Tables:
- `training_jobs`: Stores training job information
- `training_parameters`: Stores model parameters
- `training_progress`: Stores training progress updates
- `active_learning_candidates`: Stores sample candidates for labeling
- `active_learning_batches`: Stores labeling batches
- `retraining_triggers`: Stores retraining triggers

## Performance Considerations

- **Memory Usage**: The unified API automatically adapts to available memory
- **Scaling**: Distributed training can scale to multiple machines through Supabase
- **Storage**: Efficient storage of models and training artifacts
- **Fallbacks**: Each feature has fallbacks for limited environments

## Error Handling

The system includes comprehensive error handling:
- Graceful degradation when components are unavailable
- Informative error messages
- Progress recovery after failures
- Job status tracking

## Examples

### Transfer Learning Example

```python
from transfer_learning import transfer_learn

result = transfer_learn(
    dataset_path="new_materials_dataset",
    pretrained_model_path="models/baseline_model",
    model_type="tensorflow",
    epochs=5,
    batch_size=16
)
```

### Hyperparameter Optimization Example

```python
from hyperparameter_optimization import optimize_hyperparameters

hp_space = {
    "learning_rate": {"type": "float", "min": 1e-4, "max": 1e-2, "log": True},
    "dropout_rate": {"type": "float", "min": 0.1, "max": 0.5},
    "dense_units": {"type": "int", "min": 64, "max": 512, "step": 64}
}

result = optimize_hyperparameters(
    dataset_path="path/to/dataset",
    model_type="hybrid",
    hp_space=hp_space,
    max_trials=20
)
```

### Active Learning Example

```python
from active_learning import ActiveLearner

# Create active learning system
learner = ActiveLearner(storage_dir="./active_learning")

# Select samples for labeling
batch = learner.select_samples_for_labeling(count=10)

# Record feedback
learner.record_feedback(
    sample_id=batch.samples[0].sample_id,
    correct_material_id="material_id_123"
)

# Check retraining triggers
triggers = learner.check_retraining_triggers()

# Retrain if triggered
if triggers:
    learner.retrain_model(trigger_id=triggers[0].trigger_id)