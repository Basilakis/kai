#!/usr/bin/env python3
"""
Confidence Fusion for Hybrid Material Recognition

This script implements various algorithms for fusing confidence scores from
feature-based and ML-based material recognition approaches.

Usage:
    python confidence_fusion.py <feature_results> <ml_results> [options]

Arguments:
    feature_results    JSON file with feature-based recognition results
    ml_results         JSON file with ML-based recognition results
    
Options:
    --method           Fusion method (weighted, adaptive, max, product)
    --alpha            Weight for feature-based results (0-1)
    --output           Path to save fused results
"""

import os
import sys
import json
import argparse
import numpy as np
from typing import Dict, List, Any, Tuple, Optional
import cv2


def normalize_confidence_scores(matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normalize confidence scores to [0, 1] range
    
    Args:
        matches: List of match dictionaries with confidence scores
        
    Returns:
        List of matches with normalized confidence scores
    """
    if not matches:
        return []
    
    # Extract confidence scores
    confidence_scores = [match["confidence"] for match in matches]
    
    # Find min and max scores
    min_score = min(confidence_scores)
    max_score = max(confidence_scores)
    
    # Normalize scores
    normalized_matches = []
    for match in matches:
        normalized_match = match.copy()
        
        if max_score > min_score:
            normalized_match["confidence"] = (match["confidence"] - min_score) / (max_score - min_score)
        else:
            normalized_match["confidence"] = 1.0 if match["confidence"] > 0 else 0.0
            
        normalized_matches.append(normalized_match)
    
    return normalized_matches


def weighted_fusion(feature_matches: List[Dict[str, Any]], ml_matches: List[Dict[str, Any]], alpha: float = 0.5) -> List[Dict[str, Any]]:
    """
    Fuse confidence scores using weighted average
    
    Args:
        feature_matches: List of matches from feature-based approach
        ml_matches: List of matches from ML-based approach
        alpha: Weight for feature-based approach (1-alpha for ML-based)
        
    Returns:
        List of fused matches
    """
    # Normalize confidence scores
    feature_matches = normalize_confidence_scores(feature_matches)
    ml_matches = normalize_confidence_scores(ml_matches)
    
    # Create a dictionary to store combined matches
    combined_matches = {}
    
    # Process feature-based matches
    for match in feature_matches:
        material_id = match["materialId"]
        combined_matches[material_id] = {
            "materialId": material_id,
            "confidence": alpha * match["confidence"],
            "features": match.get("features", {}),
            "sources": ["feature"]
        }
    
    # Process ML-based matches
    for match in ml_matches:
        material_id = match["materialId"]
        if material_id in combined_matches:
            # Update existing match
            feature_conf = combined_matches[material_id]["confidence"]
            ml_conf = (1 - alpha) * match["confidence"]
            
            combined_matches[material_id]["confidence"] = feature_conf + ml_conf
            combined_matches[material_id]["features"].update(match.get("features", {}))
            combined_matches[material_id]["sources"].append("ml")
        else:
            # Add new match
            combined_matches[material_id] = {
                "materialId": material_id,
                "confidence": (1 - alpha) * match["confidence"],
                "features": match.get("features", {}),
                "sources": ["ml"]
            }
    
    # Convert to list and sort by confidence
    result_list = list(combined_matches.values())
    result_list.sort(key=lambda x: x["confidence"], reverse=True)
    
    return result_list


def adaptive_fusion(feature_matches: List[Dict[str, Any]], ml_matches: List[Dict[str, Any]], image_features: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """
    Fuse confidence scores using adaptive weighting based on image characteristics
    
    Args:
        feature_matches: List of matches from feature-based approach
        ml_matches: List of matches from ML-based approach
        image_features: Dictionary with image features for adaptive weighting
        
    Returns:
        List of fused matches
    """
    # Normalize confidence scores
    feature_matches = normalize_confidence_scores(feature_matches)
    ml_matches = normalize_confidence_scores(ml_matches)
    
    # Determine adaptive weights based on image features
    feature_weight = 0.5  # Default weight
    
    if image_features:
        # Adjust weights based on image characteristics
        
        # If image has many keypoints, favor feature-based approach
        if image_features.get("keypoint_count", 0) > 100:
            feature_weight = 0.7
        
        # If image has high contrast, favor feature-based approach
        if image_features.get("contrast", 0) > 0.8:
            feature_weight = 0.7
        
        # If image is blurry, favor ML-based approach
        if image_features.get("blur_score", 0) > 0.5:
            feature_weight = 0.3
        
        # If image has uniform texture, favor ML-based approach
        if image_features.get("texture_uniformity", 0) > 0.8:
            feature_weight = 0.3
    
    # Use weighted fusion with adaptive weights
    return weighted_fusion(feature_matches, ml_matches, feature_weight)


def max_fusion(feature_matches: List[Dict[str, Any]], ml_matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Fuse confidence scores by taking the maximum confidence
    
    Args:
        feature_matches: List of matches from feature-based approach
        ml_matches: List of matches from ML-based approach
        
    Returns:
        List of fused matches
    """
    # Normalize confidence scores
    feature_matches = normalize_confidence_scores(feature_matches)
    ml_matches = normalize_confidence_scores(ml_matches)
    
    # Create a dictionary to store combined matches
    combined_matches = {}
    
    # Process feature-based matches
    for match in feature_matches:
        material_id = match["materialId"]
        combined_matches[material_id] = {
            "materialId": material_id,
            "confidence": match["confidence"],
            "features": match.get("features", {}),
            "sources": ["feature"]
        }
    
    # Process ML-based matches
    for match in ml_matches:
        material_id = match["materialId"]
        if material_id in combined_matches:
            # Take the maximum confidence
            feature_conf = combined_matches[material_id]["confidence"]
            ml_conf = match["confidence"]
            
            if ml_conf > feature_conf:
                combined_matches[material_id]["confidence"] = ml_conf
                combined_matches[material_id]["sources"] = ["ml"]
            elif ml_conf == feature_conf:
                combined_matches[material_id]["sources"].append("ml")
                
            combined_matches[material_id]["features"].update(match.get("features", {}))
        else:
            # Add new match
            combined_matches[material_id] = {
                "materialId": material_id,
                "confidence": match["confidence"],
                "features": match.get("features", {}),
                "sources": ["ml"]
            }
    
    # Convert to list and sort by confidence
    result_list = list(combined_matches.values())
    result_list.sort(key=lambda x: x["confidence"], reverse=True)
    
    return result_list


def product_fusion(feature_matches: List[Dict[str, Any]], ml_matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Fuse confidence scores by taking the product of confidences
    
    Args:
        feature_matches: List of matches from feature-based approach
        ml_matches: List of matches from ML-based approach
        
    Returns:
        List of fused matches
    """
    # Normalize confidence scores
    feature_matches = normalize_confidence_scores(feature_matches)
    ml_matches = normalize_confidence_scores(ml_matches)
    
    # Create a dictionary to store combined matches
    combined_matches = {}
    
    # Create dictionaries for quick lookup
    feature_dict = {match["materialId"]: match for match in feature_matches}
    ml_dict = {match["materialId"]: match for match in ml_matches}
    
    # Get all material IDs
    all_material_ids = set(feature_dict.keys()) | set(ml_dict.keys())
    
    # Process all materials
    for material_id in all_material_ids:
        feature_conf = feature_dict.get(material_id, {"confidence": 0.5})["confidence"]
        ml_conf = ml_dict.get(material_id, {"confidence": 0.5})["confidence"]
        
        # Calculate product confidence
        product_conf = feature_conf * ml_conf
        
        # Combine features
        features = {}
        sources = []
        
        if material_id in feature_dict:
            features.update(feature_dict[material_id].get("features", {}))
            sources.append("feature")
            
        if material_id in ml_dict:
            features.update(ml_dict[material_id].get("features", {}))
            sources.append("ml")
        
        # Add to combined matches
        combined_matches[material_id] = {
            "materialId": material_id,
            "confidence": product_conf,
            "features": features,
            "sources": sources
        }
    
    # Convert to list and sort by confidence
    result_list = list(combined_matches.values())
    result_list.sort(key=lambda x: x["confidence"], reverse=True)
    
    return result_list


def extract_image_features(image_path: str) -> Dict[str, Any]:
    """
    Extract features from an image for adaptive fusion
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Dictionary with image features
    """
    # Check if image exists
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")
    
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Failed to load image: {image_path}")
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Extract keypoints
    sift = cv2.SIFT_create()
    keypoints, _ = sift.detectAndCompute(gray, None)
    keypoint_count = len(keypoints) if keypoints is not None else 0
    
    # Calculate blur score (Laplacian variance)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    blur_score = 1.0 - min(1.0, cv2.variance(laplacian)[0] / 500.0)
    
    # Calculate contrast
    min_val, max_val, _, _ = cv2.minMaxLoc(gray)
    contrast = (max_val - min_val) / 255.0
    
    # Calculate texture uniformity (using GLCM)
    try:
        from skimage.feature import graycomatrix, graycoprops
        
        # Quantize the image to 8 levels
        bins = np.linspace(0, 255, 9)
        quantized = np.digitize(gray, bins) - 1
        
        # Calculate GLCM
        glcm = graycomatrix(quantized.astype(np.uint8), [1], [0, np.pi/4, np.pi/2, 3*np.pi/4], levels=8, symmetric=True, normed=True)
        
        # Calculate uniformity (Angular Second Moment)
        uniformity = graycoprops(glcm, 'ASM').mean()
    except ImportError:
        # Fallback if scikit-image is not available
        uniformity = 0.5
    
    return {
        "keypoint_count": keypoint_count,
        "blur_score": blur_score,
        "contrast": contrast,
        "texture_uniformity": uniformity
    }


def fuse_recognition_results(feature_results: Dict[str, Any], ml_results: Dict[str, Any], 
                            method: str = "adaptive", alpha: float = 0.5, 
                            image_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Fuse recognition results from feature-based and ML-based approaches
    
    Args:
        feature_results: Results from feature-based approach
        ml_results: Results from ML-based approach
        method: Fusion method (weighted, adaptive, max, product)
        alpha: Weight for feature-based results (0-1)
        image_path: Path to the query image (for adaptive fusion)
        
    Returns:
        Dictionary with fused results
    """
    # Extract matches
    feature_matches = feature_results.get("matches", [])
    ml_matches = ml_results.get("matches", [])
    
    # Extract image features for adaptive fusion
    image_features = None
    if method == "adaptive" and image_path:
        try:
            image_features = extract_image_features(image_path)
        except Exception as e:
            print(f"Warning: Failed to extract image features: {e}", file=sys.stderr)
    
    # Apply fusion method
    if method == "weighted":
        fused_matches = weighted_fusion(feature_matches, ml_matches, alpha)
    elif method == "adaptive":
        fused_matches = adaptive_fusion(feature_matches, ml_matches, image_features)
    elif method == "max":
        fused_matches = max_fusion(feature_matches, ml_matches)
    elif method == "product":
        fused_matches = product_fusion(feature_matches, ml_matches)
    else:
        raise ValueError(f"Unknown fusion method: {method}")
    
    # Prepare fused results
    fused_results = {
        "matches": fused_matches,
        "fusion": {
            "method": method,
            "alpha": alpha,
            "feature_match_count": len(feature_matches),
            "ml_match_count": len(ml_matches),
            "fused_match_count": len(fused_matches)
        },
        "extractedFeatures": feature_results.get("extractedFeatures", {})
    }
    
    # Add image features if available
    if image_features:
        fused_results["fusion"]["image_features"] = image_features
    
    return fused_results


def main():
    """Main function to parse arguments and run fusion"""
    parser = argparse.ArgumentParser(description="Fuse confidence scores from different recognition approaches")
    parser.add_argument("feature_results", help="JSON file with feature-based recognition results")
    parser.add_argument("ml_results", help="JSON file with ML-based recognition results")
    parser.add_argument("--method", choices=["weighted", "adaptive", "max", "product"], 
                        default="adaptive", help="Fusion method")
    parser.add_argument("--alpha", type=float, default=0.5,
                        help="Weight for feature-based results (0-1)")
    parser.add_argument("--image-path", help="Path to the query image (for adaptive fusion)")
    parser.add_argument("--output", help="Path to save fused results")
    
    args = parser.parse_args()
    
    try:
        # Load feature-based results
        with open(args.feature_results, "r") as f:
            feature_results = json.load(f)
        
        # Load ML-based results
        with open(args.ml_results, "r") as f:
            ml_results = json.load(f)
        
        # Fuse results
        fused_results = fuse_recognition_results(
            feature_results,
            ml_results,
            method=args.method,
            alpha=args.alpha,
            image_path=args.image_path
        )
        
        # Save or print results
        if args.output:
            os.makedirs(os.path.dirname(args.output), exist_ok=True)
            with open(args.output, "w") as f:
                json.dump(fused_results, f, indent=2)
            print(f"Fused results saved to {args.output}")
        else:
            print(json.dumps(fused_results, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()