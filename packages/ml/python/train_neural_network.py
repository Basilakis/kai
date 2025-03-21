#!/usr/bin/env python3
"""
Neural Network Trainer for Material Recognition

This script trains neural network models for material recognition using TensorFlow or PyTorch.
It implements transfer learning from pre-trained models and includes data augmentation.

Usage:
    python train_neural_network.py <dataset_dir> <output_dir> [options]

Arguments:
    dataset_dir    Directory containing material images organized by material ID
    output_dir     Directory to save the trained model and metadata

Options:
    --framework    Neural network framework to use (tensorflow, pytorch)
    --model        Base model architecture (mobilenetv2, resnet18, efficientnet)
    --epochs       Number of training epochs
    --batch-size   Batch size for training
    --img-size     Input image size (e.g., 224 for 224x224)
    --lr           Learning rate
"""

import os
import sys
import json
import argparse
import numpy as np
from pathlib import Path
import time
from tqdm import tqdm
import matplotlib.pyplot as plt

# Check for TensorFlow
try:
    import tensorflow as tf
    from tensorflow.keras import layers, models, applications, optimizers
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

# Check for PyTorch
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import Dataset, DataLoader, random_split
    import torchvision
    from torchvision import transforms, datasets, models
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


def create_tensorflow_model(num_classes, base_model_name='mobilenetv2', img_size=224):
    """
    Create a TensorFlow model for material classification
    
    Args:
        num_classes: Number of material classes
        base_model_name: Name of the base model architecture
        img_size: Input image size
        
    Returns:
        TensorFlow model
    """
    input_shape = (img_size, img_size, 3)
    
    # Select base model
    if base_model_name.lower() == 'mobilenetv2':
        base_model = applications.MobileNetV2(
            input_shape=input_shape,
            include_top=False,
            weights='imagenet'
        )
    elif base_model_name.lower() == 'resnet50':
        base_model = applications.ResNet50(
            input_shape=input_shape,
            include_top=False,
            weights='imagenet'
        )
    elif base_model_name.lower() == 'efficientnetb0':
        base_model = applications.EfficientNetB0(
            input_shape=input_shape,
            include_top=False,
            weights='imagenet'
        )
    else:
        raise ValueError(f"Unsupported base model: {base_model_name}")
    
    # Freeze the base model layers
    base_model.trainable = False
    
    # Create the model with custom classification head
    model = models.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.BatchNormalization(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation='softmax')
    ])
    
    # Compile the model
    model.compile(
        optimizer=optimizers.Adam(learning_rate=0.001),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model


def train_tensorflow_model(dataset_dir, output_dir, base_model_name='mobilenetv2', 
                          epochs=10, batch_size=32, img_size=224, learning_rate=0.001):
    """
    Train a TensorFlow model for material recognition
    
    Args:
        dataset_dir: Directory containing material images organized by material ID
        output_dir: Directory to save the trained model
        base_model_name: Name of the base model architecture
        epochs: Number of training epochs
        batch_size: Batch size for training
        img_size: Input image size
        learning_rate: Learning rate for optimizer
        
    Returns:
        Dictionary with training results
    """
    if not TF_AVAILABLE:
        raise ImportError("TensorFlow is not available")
    
    print(f"Training TensorFlow model with {base_model_name} architecture")
    
    # Create data generators with augmentation
    train_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        fill_mode='nearest',
        validation_split=0.2  # 20% for validation
    )
    
    # Load training data
    train_generator = train_datagen.flow_from_directory(
        dataset_dir,
        target_size=(img_size, img_size),
        batch_size=batch_size,
        class_mode='sparse',
        subset='training'
    )
    
    # Load validation data
    validation_generator = train_datagen.flow_from_directory(
        dataset_dir,
        target_size=(img_size, img_size),
        batch_size=batch_size,
        class_mode='sparse',
        subset='validation'
    )
    
    # Get class mapping
    class_indices = train_generator.class_indices
    num_classes = len(class_indices)
    
    print(f"Found {num_classes} classes: {class_indices}")
    
    # Create model
    model = create_tensorflow_model(num_classes, base_model_name, img_size)
    
    # Create callbacks
    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=os.path.join(output_dir, 'best_model'),
            save_best_only=True,
            monitor='val_accuracy'
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=5,
            restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.2,
            patience=3,
            min_lr=0.00001
        )
    ]
    
    # Train the model
    start_time = time.time()
    history = model.fit(
        train_generator,
        epochs=epochs,
        validation_data=validation_generator,
        callbacks=callbacks
    )
    training_time = time.time() - start_time
    
    # Save the final model
    model_path = os.path.join(output_dir, 'material_classifier_tf')
    model.save(model_path)
    
    # Save class indices mapping
    class_mapping = {v: k for k, v in class_indices.items()}
    with open(os.path.join(output_dir, 'class_mapping.json'), 'w') as f:
        json.dump(class_mapping, f, indent=2)
    
    # Create material metadata
    material_metadata = {
        "model_type": "ml-based-tensorflow",
        "base_model": base_model_name,
        "input_size": img_size,
        "materials": {}
    }
    
    for class_name, class_idx in class_indices.items():
        material_metadata["materials"][class_name] = {
            "id": class_name,
            "name": class_name.replace("_", " ").title(),
            "index": int(class_idx)
        }
    
    # Save material metadata
    with open(os.path.join(output_dir, 'material_metadata.json'), 'w') as f:
        json.dump(material_metadata, f, indent=2)
    
    # Plot training history
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
    plt.savefig(os.path.join(output_dir, 'training_history.png'))
    
    # Return training results
    return {
        "model_path": model_path,
        "metadata_path": os.path.join(output_dir, 'material_metadata.json'),
        "class_mapping_path": os.path.join(output_dir, 'class_mapping.json'),
        "num_classes": num_classes,
        "training_time": training_time,
        "final_accuracy": float(history.history['accuracy'][-1]),
        "final_val_accuracy": float(history.history['val_accuracy'][-1]),
        "final_loss": float(history.history['loss'][-1]),
        "final_val_loss": float(history.history['val_loss'][-1])
    }


def create_pytorch_model(num_classes, base_model_name='resnet18'):
    """
    Create a PyTorch model for material classification
    
    Args:
        num_classes: Number of material classes
        base_model_name: Name of the base model architecture
        
    Returns:
        PyTorch model
    """
    # Select base model
    if base_model_name.lower() == 'resnet18':
        model = models.resnet18(pretrained=True)
        num_features = model.fc.in_features
    elif base_model_name.lower() == 'mobilenet_v2':
        model = models.mobilenet_v2(pretrained=True)
        num_features = model.classifier[1].in_features
    elif base_model_name.lower() == 'efficientnet_b0':
        model = models.efficientnet_b0(pretrained=True)
        num_features = model.classifier[1].in_features
    else:
        raise ValueError(f"Unsupported base model: {base_model_name}")
    
    # Freeze the base model layers
    for param in model.parameters():
        param.requires_grad = False
    
    # Replace the final fully connected layer
    if base_model_name.lower() == 'resnet18':
        model.fc = nn.Sequential(
            nn.Linear(num_features, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes)
        )
    else:
        model.classifier = nn.Sequential(
            nn.Linear(num_features, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes)
        )
    
    return model


def train_pytorch_model(dataset_dir, output_dir, base_model_name='resnet18', 
                       epochs=10, batch_size=32, img_size=224, learning_rate=0.001):
    """
    Train a PyTorch model for material recognition
    
    Args:
        dataset_dir: Directory containing material images organized by material ID
        output_dir: Directory to save the trained model
        base_model_name: Name of the base model architecture
        epochs: Number of training epochs
        batch_size: Batch size for training
        img_size: Input image size
        learning_rate: Learning rate for optimizer
        
    Returns:
        Dictionary with training results
    """
    if not TORCH_AVAILABLE:
        raise ImportError("PyTorch is not available")
    
    print(f"Training PyTorch model with {base_model_name} architecture")
    
    # Set device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    # Data transformations
    data_transforms = {
        'train': transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(20),
            transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1, hue=0.1),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
        'val': transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
    }
    
    # Load the dataset
    dataset = datasets.ImageFolder(dataset_dir, transform=data_transforms['train'])
    
    # Split into training and validation sets
    val_size = int(0.2 * len(dataset))
    train_size = len(dataset) - val_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])
    
    # Apply validation transforms to validation dataset
    val_dataset.dataset.transform = data_transforms['val']
    
    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=4)
    
    # Get class mapping
    class_to_idx = dataset.class_to_idx
    num_classes = len(class_to_idx)
    
    print(f"Found {num_classes} classes: {class_to_idx}")
    
    # Create model
    model = create_pytorch_model(num_classes, base_model_name)
    model = model.to(device)
    
    # Define loss function and optimizer
    criterion = nn.CrossEntropyLoss()
    
    # Only train the classifier parameters, feature parameters are frozen
    if base_model_name.lower() == 'resnet18':
        optimizer = optim.Adam(model.fc.parameters(), lr=learning_rate)
    else:
        optimizer = optim.Adam(model.classifier.parameters(), lr=learning_rate)
    
    # Learning rate scheduler
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, 'min', patience=3, factor=0.2, min_lr=0.00001)
    
    # Training loop
    start_time = time.time()
    best_val_loss = float('inf')
    best_model_state = None
    
    # History for plotting
    history = {
        'train_loss': [],
        'train_acc': [],
        'val_loss': [],
        'val_acc': []
    }
    
    for epoch in range(epochs):
        # Training phase
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        for inputs, labels in tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs} - Training"):
            inputs, labels = inputs.to(device), labels.to(device)
            
            optimizer.zero_grad()
            
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * inputs.size(0)
            
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
        
        epoch_loss = running_loss / len(train_loader.dataset)
        epoch_acc = correct / total
        history['train_loss'].append(epoch_loss)
        history['train_acc'].append(epoch_acc)
        
        # Validation phase
        model.eval()
        val_running_loss = 0.0
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for inputs, labels in tqdm(val_loader, desc=f"Epoch {epoch+1}/{epochs} - Validation"):
                inputs, labels = inputs.to(device), labels.to(device)
                
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                
                val_running_loss += loss.item() * inputs.size(0)
                
                _, predicted = outputs.max(1)
                val_total += labels.size(0)
                val_correct += predicted.eq(labels).sum().item()
        
        val_epoch_loss = val_running_loss / len(val_loader.dataset)
        val_epoch_acc = val_correct / val_total
        history['val_loss'].append(val_epoch_loss)
        history['val_acc'].append(val_epoch_acc)
        
        # Update learning rate
        scheduler.step(val_epoch_loss)
        
        # Save best model
        if val_epoch_loss < best_val_loss:
            best_val_loss = val_epoch_loss
            best_model_state = model.state_dict().copy()
        
        print(f"Epoch {epoch+1}/{epochs} - "
              f"Loss: {epoch_loss:.4f}, Accuracy: {epoch_acc:.4f}, "
              f"Val Loss: {val_epoch_loss:.4f}, Val Accuracy: {val_epoch_acc:.4f}")
    
    training_time = time.time() - start_time
    
    # Load best model
    if best_model_state is not None:
        model.load_state_dict(best_model_state)
    
    # Save the model
    os.makedirs(output_dir, exist_ok=True)
    model_path = os.path.join(output_dir, 'material_classifier_torch.pt')
    torch.save(model, model_path)
    
    # Save class indices mapping
    idx_to_class = {v: k for k, v in class_to_idx.items()}
    with open(os.path.join(output_dir, 'class_mapping.json'), 'w') as f:
        json.dump(idx_to_class, f, indent=2)
    
    # Create material metadata
    material_metadata = {
        "model_type": "ml-based-pytorch",
        "base_model": base_model_name,
        "input_size": img_size,
        "materials": {}
    }
    
    for class_name, class_idx in class_to_idx.items():
        material_metadata["materials"][class_name] = {
            "id": class_name,
            "name": class_name.replace("_", " ").title(),
            "index": int(class_idx)
        }
    
    # Save material metadata
    with open(os.path.join(output_dir, 'material_metadata.json'), 'w') as f:
        json.dump(material_metadata, f, indent=2)
    
    # Plot training history
    plt.figure(figsize=(12, 4))
    
    plt.subplot(1, 2, 1)
    plt.plot(history['train_acc'])
    plt.plot(history['val_acc'])
    plt.title('Model Accuracy')
    plt.ylabel('Accuracy')
    plt.xlabel('Epoch')
    plt.legend(['Train', 'Validation'], loc='upper left')
    
    plt.subplot(1, 2, 2)
    plt.plot(history['train_loss'])
    plt.plot(history['val_loss'])
    plt.title('Model Loss')
    plt.ylabel('Loss')
    plt.xlabel('Epoch')
    plt.legend(['Train', 'Validation'], loc='upper left')
    
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'training_history.png'))
    
    # Return training results
    return {
        "model_path": model_path,
        "metadata_path": os.path.join(output_dir, 'material_metadata.json'),
        "class_mapping_path": os.path.join(output_dir, 'class_mapping.json'),
        "num_classes": num_classes,
        "training_time": training_time,
        "final_accuracy": float(history['train_acc'][-1]),
        "final_val_accuracy": float(history['val_acc'][-1]),
        "final_loss": float(history['train_loss'][-1]),
        "final_val_loss": float(history['val_loss'][-1])
    }


def main():
    """Main function to parse arguments and train the model"""
    parser = argparse.ArgumentParser(description="Train neural network for material recognition")
    parser.add_argument("dataset_dir", help="Directory containing material images organized by material ID")
    parser.add_argument("output_dir", help="Directory to save the trained model")
    parser.add_argument("--framework", choices=["tensorflow", "pytorch"], default="tensorflow",
                        help="Neural network framework to use")
    parser.add_argument("--model", default="mobilenetv2",
                        help="Base model architecture (mobilenetv2, resnet18, efficientnet)")
    parser.add_argument("--epochs", type=int, default=10,
                        help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32,
                        help="Batch size for training")
    parser.add_argument("--img-size", type=int, default=224,
                        help="Input image size")
    parser.add_argument("--lr", type=float, default=0.001,
                        help="Learning rate")
    
    args = parser.parse_args()
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    try:
        # Train model based on framework
        if args.framework == "tensorflow":
            if not TF_AVAILABLE:
                raise ImportError("TensorFlow is not available. Please install TensorFlow or use --framework=pytorch")
            
            result = train_tensorflow_model(
                args.dataset_dir,
                args.output_dir,
                base_model_name=args.model,
                epochs=args.epochs,
                batch_size=args.batch_size,
                img_size=args.img_size,
                learning_rate=args.lr
            )
        else:  # pytorch
            if not TORCH_AVAILABLE:
                raise ImportError("PyTorch is not available. Please install PyTorch or use --framework=tensorflow")
            
            result = train_pytorch_model(
                args.dataset_dir,
                args.output_dir,
                base_model_name=args.model,
                epochs=args.epochs,
                batch_size=args.batch_size,
                img_size=args.img_size,
                learning_rate=args.lr
            )
        
        # Print results
        print("\nTraining completed successfully:")
        print(f"- Model saved to: {result['model_path']}")
        print(f"- Metadata saved to: {result['metadata_path']}")
        print(f"- Number of classes: {result['num_classes']}")
        print(f"- Training time: {result['training_time']:.2f} seconds")
        print(f"- Final training accuracy: {result['final_accuracy']:.4f}")
        print(f"- Final validation accuracy: {result['final_val_accuracy']:.4f}")
        
        # Save results to JSON
        with open(os.path.join(args.output_dir, 'training_results.json'), 'w') as f:
            json.dump(result, f, indent=2)
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()