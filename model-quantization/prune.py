#!/usr/bin/env python3
import numpy as np
import tensorflow as tf

def apply_structured_filter_pruning(model, pruning_ratio=0.3):
    """
    Applies structured filter pruning to the Conv2D layers of MobileFaceNet.
    For each convolutional filter, it calculates the L1-norm of the weight tensor.
    Filters below the threshold are masked/pruned out.
    """
    print(f"[*] Initializing Structured Filter Pruning (Target Sparsity: {pruning_ratio * 100}%)")
    
    pruned_weights_count = 0
    total_weights_count = 0

    for layer in model.layers:
        if isinstance(layer, tf.keras.layers.Conv2D) and not isinstance(layer, tf.keras.layers.DepthwiseConv2D):
            weights = layer.get_weights()
            if len(weights) > 0:
                kernel = weights[0]  # shape: [height, width, in_channels, out_channels]
                biases = weights[1] if len(weights) > 1 else None
                
                out_channels = kernel.shape[-1]
                # Calculate L1-norm along the input dimensions for each output channel (filter)
                # L1-norm is the sum of absolute values
                l1_norms = np.sum(np.abs(kernel), axis=(0, 1, 2))
                
                # Determine weight cutoff threshold based on desired pruning ratio
                threshold = np.percentile(l1_norms, pruning_ratio * 100)
                
                # Zero out filters below the threshold (structured magnitude-based pruning)
                prune_mask = l1_norms >= threshold
                kernel[:, :, :, ~prune_mask] = 0.0
                
                if biases is not None:
                    biases[~prune_mask] = 0.0
                    layer.set_weights([kernel, biases])
                else:
                    layer.set_weights([kernel])
                    
                layer_pruned = np.sum(~prune_mask)
                print(f"[+] Layer '{layer.name}': Pruned {layer_pruned}/{out_channels} channels.")
                
                pruned_weights_count += layer_pruned
                total_weights_count += out_channels
                
    sparsity = (pruned_weights_count / total_weights_count) * 100
    print(f"[+] Structured Pruning Completed successfully!")
    print(f"[+] Total Pruned Channels: {pruned_weights_count} / {total_weights_count} ({sparsity:.2f}% Sparsity)")

def build_mock_mobilefacenet():
    """Builds a basic MobileFaceNet structure for demonstration."""
    inputs = tf.keras.Input(shape=(112, 112, 3))
    x = tf.keras.layers.Conv2D(64, (3, 3), strides=2, padding='same', name='conv_stem')(inputs)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.DepthwiseConv2D((3, 3), padding='same', name='dw_conv_1')(x)
    x = tf.keras.layers.Conv2D(128, (1, 1), padding='same', name='pw_conv_1')(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    outputs = tf.keras.layers.Dense(128, name='embedding')(x)
    return tf.keras.Model(inputs, outputs)

if __name__ == "__main__":
    # Load MobileFaceNet model
    model = build_mock_mobilefacenet()
    apply_structured_filter_pruning(model, pruning_ratio=0.3)
