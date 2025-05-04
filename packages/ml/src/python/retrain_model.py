#!/usr/bin/env python
"""
Retrain Model Script

This script retrains a model with new data from active learning.
"""

import os
import sys
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.metrics import confusion_matrix, accuracy_score
import matplotlib.pyplot as plt
import io

def retrain_model(config_path):
    """Retrain a model with new data from active learning."""
    # Load configuration
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    model_path = config['modelPath']
    training_data_dir = config['trainingDataDir']
    epochs = config['epochs']
    batch_size = config['batchSize']
    learning_rate = config['learningRate']
    use_transfer_learning = config['useTransferLearning']
    use_data_augmentation = config['useDataAugmentation']
    
    # Load model
    model = load_model(model_path)
    
    # Get model metadata
    model_dir = os.path.dirname(model_path)
    metadata_path = os.path.join(model_dir, 'metadata.json')
    
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
    else:
        metadata = {}
    
    # Create data generators
    if use_data_augmentation:
        train_datagen = ImageDataGenerator(
            rescale=1./255,
            rotation_range=20,
            width_shift_range=0.2,
            height_shift_range=0.2,
            shear_range=0.2,
            zoom_range=0.2,
            horizontal_flip=True,
            validation_split=0.2
        )
    else:
        train_datagen = ImageDataGenerator(
            rescale=1./255,
            validation_split=0.2
        )
    
    # Create training and validation generators
    train_generator = train_datagen.flow_from_directory(
        training_data_dir,
        target_size=(224, 224),
        batch_size=batch_size,
        class_mode='categorical',
        subset='training'
    )
    
    validation_generator = train_datagen.flow_from_directory(
        training_data_dir,
        target_size=(224, 224),
        batch_size=batch_size,
        class_mode='categorical',
        subset='validation'
    )
    
    # Update class names in metadata
    class_indices = train_generator.class_indices
    class_names = list(class_indices.keys())
    metadata['classes'] = class_names
    
    # Evaluate model before retraining
    initial_evaluation = model.evaluate(validation_generator)
    initial_accuracy = initial_evaluation[1]
    
    # Get initial predictions for confusion matrix
    validation_steps = len(validation_generator)
    initial_predictions = []
    initial_labels = []
    
    for i in range(validation_steps):
        x_batch, y_batch = next(validation_generator)
        batch_predictions = model.predict(x_batch)
        initial_predictions.extend(np.argmax(batch_predictions, axis=1))
        initial_labels.extend(np.argmax(y_batch, axis=1))
    
    initial_confusion = confusion_matrix(initial_labels, initial_predictions)
    
    # Compile model with new learning rate
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    # Set up early stopping
    early_stopping = EarlyStopping(
        monitor='val_loss',
        patience=5,
        restore_best_weights=True
    )
    
    # Retrain model
    history = model.fit(
        train_generator,
        epochs=epochs,
        validation_data=validation_generator,
        callbacks=[early_stopping]
    )
    
    # Evaluate model after retraining
    final_evaluation = model.evaluate(validation_generator)
    final_accuracy = final_evaluation[1]
    
    # Get final predictions for confusion matrix
    validation_generator.reset()
    final_predictions = []
    final_labels = []
    
    for i in range(validation_steps):
        x_batch, y_batch = next(validation_generator)
        batch_predictions = model.predict(x_batch)
        final_predictions.extend(np.argmax(batch_predictions, axis=1))
        final_labels.extend(np.argmax(y_batch, axis=1))
    
    final_confusion = confusion_matrix(final_labels, final_predictions)
    
    # Calculate confusion reduction
    initial_confusion_sum = np.sum(initial_confusion) - np.sum(np.diag(initial_confusion))
    final_confusion_sum = np.sum(final_confusion) - np.sum(np.diag(final_confusion))
    
    if initial_confusion_sum > 0:
        confusion_reduction = 1.0 - (final_confusion_sum / initial_confusion_sum)
    else:
        confusion_reduction = 0.0
    
    # Save model
    model.save(model_path)
    
    # Update metadata
    metadata['lastTrainedAt'] = tf.timestamp().numpy().item()
    metadata['accuracy'] = float(final_accuracy)
    metadata['trainingDataSize'] = len(train_generator.filenames)
    metadata['parameters'] = {
        'epochs': epochs,
        'batchSize': batch_size,
        'learningRate': learning_rate,
        'useTransferLearning': use_transfer_learning,
        'useDataAugmentation': use_data_augmentation
    }
    
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    # Create training history plot
    plt.figure(figsize=(12, 4))
    
    plt.subplot(1, 2, 1)
    plt.plot(history.history['accuracy'])
    plt.plot(history.history['val_accuracy'])
    plt.title('Model Accuracy')
    plt.ylabel('Accuracy')
    plt.xlabel('Epoch')
    plt.legend(['Train', 'Validation'], loc='upper left')
    
    plt.subplot(1, 2, 2)
    plt.plot(history.history['loss'])
    plt.plot(history.history['val_loss'])
    plt.title('Model Loss')
    plt.ylabel('Loss')
    plt.xlabel('Epoch')
    plt.legend(['Train', 'Validation'], loc='upper left')
    
    plt.tight_layout()
    
    # Save plot
    plot_path = os.path.join(model_dir, 'training_history.png')
    plt.savefig(plot_path)
    
    # Return results
    result = {
        'initialAccuracy': float(initial_accuracy),
        'finalAccuracy': float(final_accuracy),
        'accuracyImprovement': float(final_accuracy - initial_accuracy),
        'confusionReduction': float(confusion_reduction),
        'trainingDataSize': len(train_generator.filenames),
        'epochs': len(history.history['accuracy']),
        'classes': class_names
    }
    
    print(json.dumps(result))
    
    return result

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python retrain_model.py <config_path>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    retrain_model(config_path)
