#!/usr/bin/env python
"""
Train Cross-Property Model Script

This script trains a model that can recognize multiple properties at once.
"""

import os
import sys
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import EarlyStopping
import matplotlib.pyplot as plt
import time

def train_cross_property_model(config_path):
    """Train a model that can recognize multiple properties at once."""
    # Load configuration
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    model_id = config['modelId']
    material_type = config['materialType']
    properties = config['properties']
    model_dir = config['modelDir']
    epochs = config['epochs']
    batch_size = config['batchSize']
    learning_rate = config['learningRate']
    use_transfer_learning = config['useTransferLearning']
    use_data_augmentation = config['useDataAugmentation']
    
    # Create model directory
    os.makedirs(model_dir, exist_ok=True)
    
    # Prepare data
    property_classes = {}
    property_data_dirs = {}
    
    for prop in properties:
        # Get training data directory
        data_dir = os.path.join(os.getcwd(), 'data', 'training', material_type, prop)
        
        if not os.path.exists(data_dir):
            print(f"Warning: Training data not found for property {prop}")
            continue
        
        # Get class names
        class_names = sorted([d for d in os.listdir(data_dir) if os.path.isdir(os.path.join(data_dir, d))])
        
        if len(class_names) == 0:
            print(f"Warning: No classes found for property {prop}")
            continue
        
        property_classes[prop] = class_names
        property_data_dirs[prop] = data_dir
    
    if len(property_data_dirs) == 0:
        raise ValueError("No valid properties found with training data")
    
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
    
    # Create a base model
    base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
    
    if not use_transfer_learning:
        # If not using transfer learning, train the base model from scratch
        for layer in base_model.layers:
            layer.trainable = True
    else:
        # If using transfer learning, freeze the base model
        for layer in base_model.layers:
            layer.trainable = False
    
    # Create a feature extractor
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(1024, activation='relu')(x)
    x = Dropout(0.5)(x)
    
    # Create output heads for each property
    outputs = []
    for prop in property_classes:
        num_classes = len(property_classes[prop])
        output = Dense(num_classes, activation='softmax', name=prop)(x)
        outputs.append(output)
    
    # Create the model
    model = Model(inputs=base_model.input, outputs=outputs)
    
    # Compile the model
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    # Create a dictionary to store generators and class indices
    generators = {}
    
    # Create training and validation generators for each property
    for prop in property_data_dirs:
        train_generator = train_datagen.flow_from_directory(
            property_data_dirs[prop],
            target_size=(224, 224),
            batch_size=batch_size,
            class_mode='categorical',
            subset='training'
        )
        
        validation_generator = train_datagen.flow_from_directory(
            property_data_dirs[prop],
            target_size=(224, 224),
            batch_size=batch_size,
            class_mode='categorical',
            subset='validation'
        )
        
        generators[prop] = {
            'train': train_generator,
            'validation': validation_generator,
            'class_indices': train_generator.class_indices
        }
    
    # Create a custom data generator that combines all property generators
    def combined_generator(generators, batch_size):
        while True:
            # Get a batch from each generator
            batches = {}
            for prop in generators:
                try:
                    batch_x, batch_y = next(generators[prop]['train'])
                    batches[prop] = (batch_x, batch_y)
                except StopIteration:
                    # Reset the generator if it's exhausted
                    generators[prop]['train'].reset()
                    batch_x, batch_y = next(generators[prop]['train'])
                    batches[prop] = (batch_x, batch_y)
            
            # Combine the batches
            batch_x = batches[list(batches.keys())[0]][0]
            batch_y = [batches[prop][1] for prop in batches]
            
            yield batch_x, batch_y
    
    # Create a combined validation generator
    def combined_validation_generator(generators, batch_size):
        while True:
            # Get a batch from each generator
            batches = {}
            for prop in generators:
                try:
                    batch_x, batch_y = next(generators[prop]['validation'])
                    batches[prop] = (batch_x, batch_y)
                except StopIteration:
                    # Reset the generator if it's exhausted
                    generators[prop]['validation'].reset()
                    batch_x, batch_y = next(generators[prop]['validation'])
                    batches[prop] = (batch_x, batch_y)
            
            # Combine the batches
            batch_x = batches[list(batches.keys())[0]][0]
            batch_y = [batches[prop][1] for prop in batches]
            
            yield batch_x, batch_y
    
    # Calculate steps per epoch
    steps_per_epoch = min([len(generators[prop]['train']) for prop in generators])
    validation_steps = min([len(generators[prop]['validation']) for prop in generators])
    
    # Set up early stopping
    early_stopping = EarlyStopping(
        monitor='val_loss',
        patience=5,
        restore_best_weights=True
    )
    
    # Train the model
    start_time = time.time()
    
    history = model.fit(
        combined_generator(generators, batch_size),
        steps_per_epoch=steps_per_epoch,
        epochs=epochs,
        validation_data=combined_validation_generator(generators, batch_size),
        validation_steps=validation_steps,
        callbacks=[early_stopping]
    )
    
    training_time = time.time() - start_time
    
    # Save the model
    model.save(os.path.join(model_dir, 'model.h5'))
    
    # Save class indices
    class_indices = {}
    for prop in generators:
        class_indices[prop] = {v: k for k, v in generators[prop]['class_indices'].items()}
    
    with open(os.path.join(model_dir, 'class_indices.json'), 'w') as f:
        json.dump(class_indices, f, indent=2)
    
    # Evaluate the model
    accuracy = {}
    for i, prop in enumerate(generators):
        val_accuracy = history.history[f'{prop}_accuracy'][-1]
        accuracy[prop] = float(val_accuracy)
    
    # Create training history plot
    plt.figure(figsize=(12, 4))
    
    plt.subplot(1, 2, 1)
    for prop in generators:
        plt.plot(history.history[f'{prop}_accuracy'], label=f'{prop}')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.title('Model Accuracy')
    plt.ylabel('Accuracy')
    plt.xlabel('Epoch')
    plt.legend(loc='upper left')
    
    plt.subplot(1, 2, 2)
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.title('Model Loss')
    plt.ylabel('Loss')
    plt.xlabel('Epoch')
    plt.legend(loc='upper left')
    
    plt.tight_layout()
    
    # Save plot
    plt.savefig(os.path.join(model_dir, 'training_history.png'))
    
    # Calculate total training data size
    training_data_size = sum([len(generators[prop]['train'].filenames) for prop in generators])
    
    # Return results
    result = {
        'modelId': model_id,
        'accuracy': accuracy,
        'trainingDataSize': training_data_size,
        'epochs': len(history.history['loss']),
        'trainingTime': training_time,
        'properties': list(generators.keys()),
        'classIndices': class_indices
    }
    
    print(json.dumps(result))
    
    return result

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python train_cross_property_model.py <config_path>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    train_cross_property_model(config_path)
