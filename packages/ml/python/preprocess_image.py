#!/usr/bin/env python3
"""
Image Preprocessor for OCR

This script preprocesses images to improve OCR accuracy by:
1. Converting to grayscale
2. Applying adaptive thresholding
3. Noise removal
4. Deskewing (straightening)
5. Contrast enhancement

Usage:
    python preprocess_image.py <input_image_path> <output_image_path>

Arguments:
    input_image_path   Path to the input image
    output_image_path  Path to save the preprocessed image
"""

import os
import sys
import cv2
import numpy as np
import argparse
from PIL import Image, ImageEnhance, ImageFilter


def preprocess_image(input_path, output_path):
    """
    Preprocess an image to improve OCR accuracy
    
    Args:
        input_path (str): Path to the input image
        output_path (str): Path to save the preprocessed image
        
    Returns:
        bool: True if preprocessing was successful, False otherwise
    """
    try:
        # Check if input file exists
        if not os.path.exists(input_path):
            print(f"Error: Input file {input_path} does not exist", file=sys.stderr)
            return False
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Read the image using OpenCV
        image = cv2.imread(input_path)
        if image is None:
            print(f"Error: Failed to read image {input_path}", file=sys.stderr)
            return False
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply adaptive thresholding
        # This helps with varying lighting conditions
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        # Deskew the image if needed
        # This straightens text that might be slightly rotated
        coords = np.column_stack(np.where(thresh > 0))
        angle = cv2.minAreaRect(coords)[-1]
        
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
            
        # Only deskew if the angle is significant
        if abs(angle) > 0.5:
            (h, w) = thresh.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(
                thresh, M, (w, h), 
                flags=cv2.INTER_CUBIC, 
                borderMode=cv2.BORDER_REPLICATE
            )
        else:
            rotated = thresh
        
        # Further enhance using PIL for better results
        pil_img = Image.fromarray(rotated)
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(pil_img)
        enhanced = enhancer.enhance(2.0)  # Increase contrast
        
        # Apply sharpening filter
        sharpened = enhanced.filter(ImageFilter.SHARPEN)
        
        # Save the preprocessed image
        sharpened.save(output_path)
        
        print(f"Image preprocessed successfully and saved to {output_path}")
        return True
        
    except Exception as e:
        print(f"Error preprocessing image: {str(e)}", file=sys.stderr)
        return False


def main():
    """Main function to parse arguments and run the preprocessing"""
    parser = argparse.ArgumentParser(description="Preprocess an image for OCR")
    parser.add_argument("input_path", help="Path to the input image")
    parser.add_argument("output_path", help="Path to save the preprocessed image")
    
    args = parser.parse_args()
    
    success = preprocess_image(args.input_path, args.output_path)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()