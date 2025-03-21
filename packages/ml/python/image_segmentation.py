#!/usr/bin/env python3
"""
Image Segmentation for Multiple Tile Detection

This script implements techniques to identify and segment multiple tiles 
within a single image using computer vision techniques including:
1. Edge detection and contour analysis
2. Color-based segmentation 
3. Region-based segmentation
4. Grid detection for tiled surfaces

Usage:
    python image_segmentation.py <input_image_path> [options]

Arguments:
    input_image_path   Path to the input image
    
Options:
    --output-dir       Directory to save segmented images
    --method           Segmentation method (edge, color, region, grid)
    --min-tile-size    Minimum tile size as percentage of image (default: 0.05)
    --max-tiles        Maximum number of tiles to extract (default: 10)
    --visualize        Generate visualization of detected segments
"""

import os
import sys
import json
import argparse
import numpy as np
import cv2
from typing import Dict, List, Any, Tuple, Optional
from skimage import measure
from skimage.segmentation import slic, felzenszwalb
from sklearn.cluster import KMeans


class TileSegmenter:
    """Class for detecting and segmenting multiple tiles in an image"""
    
    def __init__(self, min_tile_size: float = 0.05, max_tiles: int = 10):
        """
        Initialize the tile segmenter
        
        Args:
            min_tile_size: Minimum tile size as percentage of image area
            max_tiles: Maximum number of tiles to extract
        """
        self.min_tile_size = min_tile_size
        self.max_tiles = max_tiles
    
    def segment_image(self, image_path: str, method: str = "edge") -> List[Dict[str, Any]]:
        """
        Segment an image to detect multiple tiles
        
        Args:
            image_path: Path to the input image
            method: Segmentation method (edge, color, region, grid)
            
        Returns:
            List of dictionaries with segmented tile information
        """
        # Check if image exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        # Apply segmentation based on selected method
        if method == "edge":
            segments = self._edge_based_segmentation(image)
        elif method == "color":
            segments = self._color_based_segmentation(image)
        elif method == "region":
            segments = self._region_based_segmentation(image)
        elif method == "grid":
            segments = self._grid_detection(image)
        else:
            # Default to edge-based if method is not recognized
            segments = self._edge_based_segmentation(image)
        
        # Return segments sorted by size (descending)
        segments.sort(key=lambda x: x["area"], reverse=True)
        
        # Assign confidence score based on segmentation quality
        for segment in segments:
            # Calculate a confidence score based on metrics like size, regularity, etc.
            regularity_score = self._calculate_regularity(segment["contour"])
            area_ratio = segment["area"] / (image.shape[0] * image.shape[1])
            segment["confidence"] = min(0.95, (regularity_score * 0.6 + area_ratio * 0.4))
        
        return segments[:self.max_tiles]
    
    def _edge_based_segmentation(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Segment image using edge detection and contour analysis
        
        Args:
            image: Input image as numpy array
            
        Returns:
            List of dictionaries with segmented tile information
        """
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply Canny edge detection
        edges = cv2.Canny(blurred, 50, 150)
        
        # Dilate edges to close small gaps
        kernel = np.ones((3, 3), np.uint8)
        dilated = cv2.dilate(edges, kernel, iterations=2)
        
        # Find contours
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Get image dimensions
        height, width = image.shape[:2]
        image_area = height * width
        min_area = self.min_tile_size * image_area
        
        # Process contours
        segments = []
        for contour in contours:
            # Calculate area
            area = cv2.contourArea(contour)
            
            # Skip small contours
            if area < min_area:
                continue
            
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate aspect ratio
            aspect_ratio = w / h if h > 0 else 0
            
            # Skip if aspect ratio is extreme (likely not a tile)
            if aspect_ratio > 5 or aspect_ratio < 0.2:
                continue
            
            # Extract region of interest
            roi = image[y:y+h, x:x+w]
            
            segments.append({
                "contour": contour,
                "bbox": (x, y, w, h),
                "area": area,
                "aspect_ratio": aspect_ratio,
                "roi": roi,
                "center": (x + w//2, y + h//2)
            })
        
        return segments
    
    def _color_based_segmentation(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Segment image using color clustering and segmentation
        
        Args:
            image: Input image as numpy array
            
        Returns:
            List of dictionaries with segmented tile information
        """
        # Reshape image for K-means
        pixels = image.reshape(-1, 3).astype(np.float32)
        
        # Determine number of clusters based on image complexity
        # For simplicity, let's use a fixed number for now
        n_clusters = min(8, self.max_tiles + 2)
        
        # Apply K-means clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(pixels)
        
        # Reshape labels back to image shape
        segmented = labels.reshape(image.shape[:2])
        
        # Get image dimensions
        height, width = image.shape[:2]
        image_area = height * width
        min_area = self.min_tile_size * image_area
        
        # Process segments
        segments = []
        for label in range(n_clusters):
            # Create mask for this cluster
            mask = np.zeros(image.shape[:2], dtype=np.uint8)
            mask[segmented == label] = 255
            
            # Find contours in the mask
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Process each contour
            for contour in contours:
                # Calculate area
                area = cv2.contourArea(contour)
                
                # Skip small contours
                if area < min_area:
                    continue
                
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(contour)
                
                # Calculate aspect ratio
                aspect_ratio = w / h if h > 0 else 0
                
                # Skip if aspect ratio is extreme (likely not a tile)
                if aspect_ratio > 5 or aspect_ratio < 0.2:
                    continue
                
                # Extract region of interest
                roi = image[y:y+h, x:x+w]
                
                segments.append({
                    "contour": contour,
                    "bbox": (x, y, w, h),
                    "area": area,
                    "aspect_ratio": aspect_ratio,
                    "roi": roi,
                    "center": (x + w//2, y + h//2)
                })
        
        return segments
    
    def _region_based_segmentation(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Segment image using region-based methods
        
        Args:
            image: Input image as numpy array
            
        Returns:
            List of dictionaries with segmented tile information
        """
        # Convert image to LAB color space for better segmentation
        lab_image = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        
        # Apply SLIC segmentation
        segments_slic = slic(lab_image, n_segments=100, compactness=10, sigma=1, start_label=1)
        
        # Apply Felzenszwalb segmentation as alternative
        segments_fz = felzenszwalb(lab_image, scale=100, sigma=0.5, min_size=50)
        
        # Get image dimensions
        height, width = image.shape[:2]
        image_area = height * width
        min_area = self.min_tile_size * image_area
        
        # Function to process segments from a segmentation result
        def process_segments(segments_map):
            result = []
            # Get unique labels
            labels = np.unique(segments_map)
            
            for label in labels:
                # Create mask for this segment
                mask = np.zeros(segments_map.shape, dtype=np.uint8)
                mask[segments_map == label] = 255
                
                # Calculate area
                area = np.sum(mask > 0)
                
                # Skip small segments
                if area < min_area:
                    continue
                
                # Find contours in the mask
                contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                if not contours:
                    continue
                
                # Get largest contour
                contour = max(contours, key=cv2.contourArea)
                
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(contour)
                
                # Calculate aspect ratio
                aspect_ratio = w / h if h > 0 else 0
                
                # Skip if aspect ratio is extreme (likely not a tile)
                if aspect_ratio > 5 or aspect_ratio < 0.2:
                    continue
                
                # Extract region of interest
                roi = image[y:y+h, x:x+w]
                
                result.append({
                    "contour": contour,
                    "bbox": (x, y, w, h),
                    "area": area,
                    "aspect_ratio": aspect_ratio,
                    "roi": roi,
                    "center": (x + w//2, y + h//2)
                })
            
            return result
        
        # Process both segmentation methods
        segments1 = process_segments(segments_slic)
        segments2 = process_segments(segments_fz)
        
        # Combine segments from both methods
        segments = segments1 + segments2
        
        # Remove overlapping segments
        return self._remove_overlapping_segments(segments)
    
    def _grid_detection(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect grid pattern in tiled surfaces
        
        Args:
            image: Input image as numpy array
            
        Returns:
            List of dictionaries with segmented tile information
        """
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                       cv2.THRESH_BINARY_INV, 11, 2)
        
        # Apply morphological operations to enhance grid lines
        kernel = np.ones((3, 3), np.uint8)
        morph = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=1)
        
        # Find contours
        contours, _ = cv2.findContours(morph, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        
        # Get image dimensions
        height, width = image.shape[:2]
        image_area = height * width
        min_area = self.min_tile_size * image_area
        
        # Process contours as potential tiles
        segments = []
        for contour in contours:
            # Calculate area
            area = cv2.contourArea(contour)
            
            # Skip small contours
            if area < min_area:
                continue
            
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate aspect ratio
            aspect_ratio = w / h if h > 0 else 0
            
            # Skip if aspect ratio is extreme (likely not a tile)
            if aspect_ratio > 5 or aspect_ratio < 0.2:
                continue
            
            # Extract region of interest
            roi = image[y:y+h, x:x+w]
            
            segments.append({
                "contour": contour,
                "bbox": (x, y, w, h),
                "area": area,
                "aspect_ratio": aspect_ratio,
                "roi": roi,
                "center": (x + w//2, y + h//2)
            })
        
        # Detect grid patterns using Hough transform
        edges = cv2.Canny(blurred, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=100, maxLineGap=10)
        
        if lines is not None:
            # Group lines into horizontal and vertical
            h_lines = []
            v_lines = []
            
            for line in lines:
                x1, y1, x2, y2 = line[0]
                if abs(x2 - x1) > abs(y2 - y1):
                    h_lines.append((y1 + y2) // 2)  # y-coordinate of horizontal line
                else:
                    v_lines.append((x1 + x2) // 2)  # x-coordinate of vertical line
            
            # Sort and filter closely spaced lines
            h_lines.sort()
            v_lines.sort()
            
            h_filtered = self._filter_close_lines(h_lines)
            v_filtered = self._filter_close_lines(v_lines)
            
            # Create grid cells from line intersections
            if len(h_filtered) > 1 and len(v_filtered) > 1:
                for i in range(len(h_filtered) - 1):
                    for j in range(len(v_filtered) - 1):
                        x = v_filtered[j]
                        y = h_filtered[i]
                        w = v_filtered[j + 1] - x
                        h = h_filtered[i + 1] - y
                        
                        # Skip cells that are too small
                        if w * h < min_area:
                            continue
                        
                        # Extract region of interest
                        roi = image[y:y+h, x:x+w]
                        
                        # Create a rectangular contour
                        rect_contour = np.array([
                            [[x, y]],
                            [[x + w, y]],
                            [[x + w, y + h]],
                            [[x, y + h]]
                        ], dtype=np.int32)
                        
                        segments.append({
                            "contour": rect_contour,
                            "bbox": (x, y, w, h),
                            "area": w * h,
                            "aspect_ratio": w / h if h > 0 else 0,
                            "roi": roi,
                            "center": (x + w//2, y + h//2)
                        })
        
        return segments
    
    def _filter_close_lines(self, lines: List[int], min_gap: int = 20) -> List[int]:
        """
        Filter closely spaced lines
        
        Args:
            lines: List of line positions
            min_gap: Minimum gap between lines
            
        Returns:
            Filtered list of line positions
        """
        if not lines:
            return []
        
        filtered = [lines[0]]
        
        for line in lines:
            if line - filtered[-1] >= min_gap:
                filtered.append(line)
        
        return filtered
    
    def _remove_overlapping_segments(self, segments: List[Dict[str, Any]], iou_threshold: float = 0.3) -> List[Dict[str, Any]]:
        """
        Remove overlapping segments based on IoU
        
        Args:
            segments: List of segment dictionaries
            iou_threshold: Threshold for overlap detection
            
        Returns:
            Filtered list of segments
        """
        if not segments:
            return []
        
        # Sort segments by area (descending)
        segments.sort(key=lambda x: x["area"], reverse=True)
        
        # Function to calculate IoU
        def calculate_iou(bbox1, bbox2):
            x1, y1, w1, h1 = bbox1
            x2, y2, w2, h2 = bbox2
            
            # Calculate coordinates of intersection
            x_left = max(x1, x2)
            y_top = max(y1, y2)
            x_right = min(x1 + w1, x2 + w2)
            y_bottom = min(y1 + h1, y2 + h2)
            
            # No intersection
            if x_right < x_left or y_bottom < y_top:
                return 0.0
            
            # Calculate areas
            intersection_area = (x_right - x_left) * (y_bottom - y_top)
            bbox1_area = w1 * h1
            bbox2_area = w2 * h2
            union_area = bbox1_area + bbox2_area - intersection_area
            
            # Calculate IoU
            return intersection_area / union_area if union_area > 0 else 0.0
        
        # Keep track of which segments to keep
        keep = [True] * len(segments)
        
        # Check each pair of segments
        for i in range(len(segments)):
            if not keep[i]:
                continue
            
            for j in range(i + 1, len(segments)):
                if not keep[j]:
                    continue
                
                # Calculate IoU
                iou = calculate_iou(segments[i]["bbox"], segments[j]["bbox"])
                
                # If overlap is significant, remove the smaller segment
                if iou > iou_threshold:
                    keep[j] = False
        
        # Filter segments based on keep flags
        return [segment for i, segment in enumerate(segments) if keep[i]]
    
    def _calculate_regularity(self, contour: np.ndarray) -> float:
        """
        Calculate regularity score for a contour
        
        Args:
            contour: Contour points
            
        Returns:
            Regularity score between 0 and 1
        """
        # Calculate the perimeter and area
        perimeter = cv2.arcLength(contour, True)
        area = cv2.contourArea(contour)
        
        # Calculate circularity (1 for a perfect circle)
        circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
        
        # Calculate the similarity to a rectangle
        x, y, w, h = cv2.boundingRect(contour)
        rect_area = w * h
        area_ratio = area / rect_area if rect_area > 0 else 0
        
        # Approximate the contour with a polygon
        epsilon = 0.02 * perimeter
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # Check if it's quadrilateral (4 corners)
        is_quad = len(approx) == 4
        
        # Calculate final regularity score
        regularity = (0.3 * circularity + 0.4 * area_ratio + 0.3 * (1 if is_quad else 0))
        
        return min(1.0, max(0.0, regularity))
    
    def save_segments(self, image_path: str, segments: List[Dict[str, Any]], output_dir: str) -> List[str]:
        """
        Save segmented tile images to output directory
        
        Args:
            image_path: Path to the original image
            segments: List of segment dictionaries
            output_dir: Directory to save segmented images
            
        Returns:
            List of paths to saved segment images
        """
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Get the base filename without extension
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        
        # Save each segment
        segment_paths = []
        for i, segment in enumerate(segments):
            # Create output path
            output_path = os.path.join(output_dir, f"{base_name}_segment_{i + 1}.jpg")
            
            # Save the ROI
            cv2.imwrite(output_path, segment["roi"])
            
            # Add path to list
            segment_paths.append(output_path)
        
        return segment_paths
    
    def create_visualization(self, image_path: str, segments: List[Dict[str, Any]], output_path: str) -> str:
        """
        Create a visualization of detected segments
        
        Args:
            image_path: Path to the original image
            segments: List of segment dictionaries
            output_path: Path to save the visualization
            
        Returns:
            Path to the saved visualization
        """
        # Load the original image
        image = cv2.imread(image_path)
        
        # Create a copy for visualization
        vis_image = image.copy()
        
        # Define colors for visualization
        colors = [
            (0, 255, 0),    # Green
            (0, 0, 255),    # Red
            (255, 0, 0),    # Blue
            (0, 255, 255),  # Yellow
            (255, 0, 255),  # Magenta
            (255, 255, 0),  # Cyan
            (128, 0, 0),    # Dark blue
            (0, 128, 0),    # Dark green
            (0, 0, 128),    # Dark red
            (128, 128, 0)   # Dark cyan
        ]
        
        # Draw contours and labels
        for i, segment in enumerate(segments):
            # Get color for this segment
            color = colors[i % len(colors)]
            
            # Draw contour
            cv2.drawContours(vis_image, [segment["contour"]], 0, color, 2)
            
            # Get bounding box and center
            x, y, w, h = segment["bbox"]
            cx, cy = segment["center"]
            
            # Draw bounding box
            cv2.rectangle(vis_image, (x, y), (x + w, y + h), color, 1)
            
            # Draw label
            confidence = segment.get("confidence", 0.0)
            label = f"#{i+1} ({confidence:.2f})"
            cv2.putText(vis_image, label, (cx - 20, cy), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
        
        # Save visualization
        cv2.imwrite(output_path, vis_image)
        
        return output_path


def process_image(
    input_path: str, 
    output_dir: str, 
    method: str = "edge", 
    min_tile_size: float = 0.05, 
    max_tiles: int = 10, 
    visualize: bool = False
) -> Dict[str, Any]:
    """
    Process an image to detect and segment multiple tiles
    
    Args:
        input_path: Path to the input image
        output_dir: Directory to save segmented images
        method: Segmentation method
        min_tile_size: Minimum tile size as percentage of image
        max_tiles: Maximum number of tiles to extract
        visualize: Whether to create visualization
        
    Returns:
        Dictionary with segmentation results
    """
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Create segmenter
    segmenter = TileSegmenter(min_tile_size=min_tile_size, max_tiles=max_tiles)
    
    # Segment the image
    segments = segmenter.segment_image(input_path, method=method)
    
    # Save segmented images
    segment_paths = segmenter.save_segments(input_path, segments, output_dir)
    
    # Create visualization if requested
    vis_path = None
    if visualize:
        vis_path = os.path.join(output_dir, f"{os.path.splitext(os.path.basename(input_path))[0]}_visualization.jpg")
        segmenter.create_visualization(input_path, segments, vis_path)
    
    # Prepare result object
    result = {
        "input_image": input_path,
        "segments_count": len(segments),
        "segment_paths": segment_paths,
        "segments": [
            {
                "id": i,
                "bbox": list(segment["bbox"]),
                "area": float(segment["area"]),
                "aspect_ratio": float(segment["aspect_ratio"]),
                "center": list(segment["center"]),
                "confidence": segment.get("confidence", 0.0),
                "path": segment_paths[i]
            }
            for i, segment in enumerate(segments)
        ]
    }
    
    if visualize and vis_path:
        result["visualization_path"] = vis_path
    
    return result


def main():
    """Main function to parse arguments and run the segmentation"""
    parser = argparse.ArgumentParser(description="Segment image to detect multiple tiles")
    parser.add_argument("input_path", help="Path to the input image")
    parser.add_argument("--output-dir", default="./output", help="Directory to save segmented images")
    parser.add_argument("--method", choices=["edge", "color", "region", "grid"], 
                        default="edge", help="Segmentation method")
    parser.add_argument("--min-tile-size", type=float, default=0.05,
                        help="Minimum tile size as percentage of image")
    parser.add_argument("--max-tiles", type=int, default=10,
                        help="Maximum number of tiles to extract")
    parser.add_argument("--visualize", action="store_true",
                        help="Generate visualization of detected segments")
    
    args = parser.parse_args()
    
    try:
        # Process the image
        result = process_image(
            args.input_path,
            args.output_dir,
            method=args.method,
            min_tile_size=args.min_tile_size,
            max_tiles=args.max_tiles,
            visualize=args.visualize
        )
        
        # Print result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()