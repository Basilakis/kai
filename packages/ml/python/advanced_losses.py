#!/usr/bin/env python3
"""
Advanced Loss Functions for Material Recognition Models

This module implements advanced loss functions like Focal Loss
for both TensorFlow and PyTorch frameworks to address challenges
like class imbalance during training.
"""

import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('advanced_losses')

# Conditionally import TensorFlow or PyTorch based on availability
try:
    import tensorflow as tf
    import tensorflow.keras.backend as K
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    logger.debug("TensorFlow not available.")

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.debug("PyTorch not available.")

# --- TensorFlow Focal Loss Implementation ---

if TF_AVAILABLE:
    def focal_loss_tf(gamma=2.0, alpha=0.25):
        """
        TensorFlow implementation of Focal Loss.
        Based on https://github.com/keras-team/keras/blob/v2.10.0/keras/losses.py#L2117-L2173
        and adjustments for compatibility.

        Args:
            gamma (float): Focusing parameter. Higher values give more weight to misclassified examples.
            alpha (float): Balancing parameter for positive/negative samples.

        Returns:
            A callable loss function.
        """
        def focal_loss_fixed(y_true, y_pred):
            """
            Args:
                y_true: Ground truth values. shape = [batch_size, d0, .. dN]
                y_pred: The predicted values. shape = [batch_size, d0, .. dN]

            Returns:
                Loss tensor with the reduction option applied.
            """
            # Ensure y_pred is within [epsilon, 1-epsilon] for numerical stability
            epsilon = K.epsilon()
            y_pred = K.clip(y_pred, epsilon, 1. - epsilon)

            # Calculate Cross Entropy
            cross_entropy = -y_true * K.log(y_pred)

            # Calculate Focal Loss components
            loss = alpha * K.pow(1 - y_pred, gamma) * cross_entropy

            # Sum the losses in mini_batch
            return K.sum(loss, axis=-1)

        # For sparse categorical crossentropy (integer labels)
        def sparse_focal_loss_fixed(y_true, y_pred):
            """
            Args:
                y_true: Ground truth values. shape = [batch_size, d0, .. dN-1] (integers)
                y_pred: The predicted values. shape = [batch_size, d0, .. dN] (probabilities)

            Returns:
                Loss tensor with the reduction option applied.
            """
            # Ensure y_pred is within [epsilon, 1-epsilon] for numerical stability
            epsilon = K.epsilon()
            y_pred = K.clip(y_pred, epsilon, 1. - epsilon)

            # Convert y_true to one-hot encoding
            num_classes = K.shape(y_pred)[-1]
            y_true_one_hot = tf.one_hot(tf.cast(y_true, tf.int32), num_classes)
            y_true_one_hot = tf.squeeze(y_true_one_hot, axis=-2) # Adjust shape if necessary

            # Calculate Cross Entropy for the true class
            cross_entropy = -y_true_one_hot * K.log(y_pred)

            # Calculate Focal Loss components
            loss = alpha * K.pow(1 - y_pred, gamma) * cross_entropy

            # Sum the losses in mini_batch
            return K.sum(loss, axis=-1)

        # Return the appropriate function based on expected y_true shape later
        # For now, assume sparse labels are used as in model_trainer.py
        logger.info(f"Using TensorFlow Sparse Focal Loss with gamma={gamma}, alpha={alpha}")
        return sparse_focal_loss_fixed

# --- PyTorch Focal Loss Implementation ---

if TORCH_AVAILABLE:
    class FocalLossTorch(nn.Module):
        """
        PyTorch implementation of Focal Loss.
        Adapted from various sources, e.g., https://github.com/clcarwin/focal_loss_pytorch
        """
        def __init__(self, gamma=2.0, alpha=0.25, reduction='mean'):
            """
            Args:
                gamma (float): Focusing parameter.
                alpha (float): Balancing parameter. Can be float or list/tensor for per-class alpha.
                reduction (str): Specifies the reduction to apply to the output: 'none' | 'mean' | 'sum'.
            """
            super(FocalLossTorch, self).__init__()
            self.gamma = gamma
            self.alpha = alpha
            self.reduction = reduction
            logger.info(f"Using PyTorch Focal Loss with gamma={gamma}, alpha={alpha}")

        def forward(self, inputs, targets):
            """
            Args:
                inputs: Model predictions (logits or probabilities). shape = [N, C]
                targets: Ground truth labels. shape = [N] (long tensor)

            Returns:
                Loss tensor.
            """
            # Calculate log probabilities
            logpt = F.log_softmax(inputs, dim=1)
            # Gather log probabilities for the target class
            logpt = logpt.gather(1, targets.view(-1, 1)).view(-1)
            # Calculate probabilities
            pt = logpt.exp()

            # Calculate the focal loss component
            loss = -1 * (1 - pt)**self.gamma * logpt

            # Apply alpha weighting
            if self.alpha is not None:
                if isinstance(self.alpha, (float, int)):
                    # Single alpha value
                    alpha_t = torch.tensor([self.alpha] * inputs.size(0)).to(inputs.device)
                    # Select alpha based on target class (alpha for positive, 1-alpha for negative - binary case)
                    # For multi-class, alpha might need to be a tensor of weights per class
                    # Simple approach: use alpha for target class, (1-alpha)/(C-1) for others?
                    # Common practice: alpha weights the contribution of the positive class loss.
                    # Let's assume alpha applies to the positive class (or target class here).
                    # A more robust implementation might take class weights.
                    # For simplicity, we apply alpha directly if it's a float.
                    # This interpretation might need refinement based on specific use case.
                    # A common multi-class alpha usage: alpha_t = self.alpha[targets.data.view(-1)]
                    # Assuming alpha is a weight for the positive class / foreground
                    # Here, let's apply alpha to the loss directly as a simple balancing factor.
                    # This assumes alpha balances the overall contribution of the loss term.
                    loss = alpha_t * loss
                elif isinstance(self.alpha, list) or isinstance(self.alpha, torch.Tensor):
                     # Per-class alpha weights
                     if isinstance(self.alpha, list):
                         self.alpha = torch.tensor(self.alpha).to(inputs.device)
                     # Select alpha based on target class
                     alpha_t = self.alpha.gather(0, targets.view(-1))
                     loss = alpha_t * loss
                else:
                    logger.warning("Invalid alpha type for Focal Loss. Alpha weighting skipped.")


            # Apply reduction
            if self.reduction == 'mean':
                loss = loss.mean()
            elif self.reduction == 'sum':
                loss = loss.sum()
            # else 'none', return loss per element

            return loss

# --- Factory Function ---

def get_loss_function(loss_name: str = 'crossentropy', framework: str = 'tensorflow', **kwargs):
    """
    Factory function to get the specified loss function.

    Args:
        loss_name (str): Name of the loss function ('crossentropy', 'focal').
        framework (str): ML framework ('tensorflow' or 'pytorch').
        **kwargs: Additional arguments for the loss function (e.g., gamma, alpha for focal loss).

    Returns:
        Callable loss function or loss class instance.
    """
    loss_name = loss_name.lower()

    if framework == 'tensorflow':
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow is not available.")
        if loss_name == 'focal':
            gamma = kwargs.get('gamma', 2.0)
            alpha = kwargs.get('alpha', 0.25)
            return focal_loss_tf(gamma=gamma, alpha=alpha)
        elif loss_name == 'crossentropy':
            # Keras default sparse categorical crossentropy
            return 'sparse_categorical_crossentropy'
        else:
            raise ValueError(f"Unsupported TensorFlow loss function: {loss_name}")

    elif framework == 'pytorch':
        if not TORCH_AVAILABLE:
            raise ImportError("PyTorch is not available.")
        if loss_name == 'focal':
            gamma = kwargs.get('gamma', 2.0)
            alpha = kwargs.get('alpha', 0.25)
            reduction = kwargs.get('reduction', 'mean')
            return FocalLossTorch(gamma=gamma, alpha=alpha, reduction=reduction)
        elif loss_name == 'crossentropy':
            # PyTorch default cross entropy loss
            return nn.CrossEntropyLoss(**kwargs) # Pass kwargs like reduction
        else:
            raise ValueError(f"Unsupported PyTorch loss function: {loss_name}")

    else:
        raise ValueError(f"Unsupported framework: {framework}")

if __name__ == "__main__":
    # Example usage
    print("Testing loss functions...")

    # TensorFlow Example (if available)
    if TF_AVAILABLE:
        print("\n--- TensorFlow ---")
        y_true_tf = tf.constant([1, 0], dtype=tf.int32)
        y_pred_tf_good = tf.constant([[0.1, 0.9], [0.8, 0.2]], dtype=tf.float32)
        y_pred_tf_bad = tf.constant([[0.9, 0.1], [0.2, 0.8]], dtype=tf.float32)

        ce_loss_fn_tf = get_loss_function('crossentropy', 'tensorflow')
        focal_loss_fn_tf = get_loss_function('focal', 'tensorflow', gamma=2.0, alpha=0.25)

        # Note: TF loss functions expect batch dimension usually, need careful testing
        # These direct calls might not work exactly like in model.compile/fit
        try:
            # Need to wrap in tf.function or use eager execution context
            @tf.function
            def compute_tf_loss(loss_fn, yt, yp):
                 # TF sparse CE expects shape [batch_size], predictions [batch_size, num_classes]
                 # Our focal loss wrapper also expects this.
                 return loss_fn(yt, yp)

            # Cross Entropy
            # ce_loss_good = compute_tf_loss(tf.keras.losses.SparseCategoricalCrossentropy(), y_true_tf, y_pred_tf_good)
            # ce_loss_bad = compute_tf_loss(tf.keras.losses.SparseCategoricalCrossentropy(), y_true_tf, y_pred_tf_bad)
            # print(f"TF CrossEntropy Loss (Good Pred): {ce_loss_good.numpy()}") # Expect low loss
            # print(f"TF CrossEntropy Loss (Bad Pred): {ce_loss_bad.numpy()}") # Expect high loss

            # Focal Loss
            fl_loss_good = compute_tf_loss(focal_loss_fn_tf, y_true_tf, y_pred_tf_good)
            fl_loss_bad = compute_tf_loss(focal_loss_fn_tf, y_true_tf, y_pred_tf_bad)
            print(f"TF Focal Loss (Good Pred): {fl_loss_good.numpy()}") # Expect low loss
            print(f"TF Focal Loss (Bad Pred): {fl_loss_bad.numpy()}") # Expect high loss, potentially higher than CE for hard examples

        except Exception as e:
            print(f"Error running TF example (might need adjustments for eager/graph mode): {e}")


    # PyTorch Example (if available)
    if TORCH_AVAILABLE:
        print("\n--- PyTorch ---")
        y_true_torch = torch.tensor([1, 0], dtype=torch.long)
        y_pred_torch_good = torch.tensor([[0.1, 0.9], [0.8, 0.2]], dtype=torch.float32) # Logits or Probs? Assume logits for CE
        y_pred_torch_bad = torch.tensor([[0.9, 0.1], [0.2, 0.8]], dtype=torch.float32) # Logits

        ce_loss_fn_torch = get_loss_function('crossentropy', 'pytorch')
        focal_loss_fn_torch = get_loss_function('focal', 'pytorch', gamma=2.0, alpha=0.25)

        # Cross Entropy
        ce_loss_good = ce_loss_fn_torch(y_pred_torch_good, y_true_torch)
        ce_loss_bad = ce_loss_fn_torch(y_pred_torch_bad, y_true_torch)
        print(f"PyTorch CrossEntropy Loss (Good Pred): {ce_loss_good.item():.4f}") # Expect low loss
        print(f"PyTorch CrossEntropy Loss (Bad Pred): {ce_loss_bad.item():.4f}") # Expect high loss

        # Focal Loss
        fl_loss_good = focal_loss_fn_torch(y_pred_torch_good, y_true_torch)
        fl_loss_bad = focal_loss_fn_torch(y_pred_torch_bad, y_true_torch)
        print(f"PyTorch Focal Loss (Good Pred): {fl_loss_good.item():.4f}") # Expect low loss
        print(f"PyTorch Focal Loss (Bad Pred): {fl_loss_bad.item():.4f}") # Expect high loss

    if not TF_AVAILABLE and not TORCH_AVAILABLE:
        print("Neither TensorFlow nor PyTorch is available. Cannot run examples.")