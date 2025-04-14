<![CDATA[
import argparse
import json
import os
import sys
import io
import time
import logging
import tempfile
import statistics
import concurrent.futures
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('quality_assessor')

# Try to import image processing libraries
try:
    from PIL import Image, ImageFilter, ImageStat, ImageOps
    PILLOW_AVAILABLE = True
except ImportError:
    logger.warning("Pillow not available, some image analysis features will be limited")
    PILLOW_AVAILABLE = False

try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    logger.warning("OpenCV not available, some image analysis features will be limited")
    OPENCV_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    logger.warning("Requests not available, will use urllib for downloads")
    REQUESTS_AVAILABLE = False
    import urllib.request

# Define allowed quality levels per subscription tier
# Mirroring ResourceManager logic for consistency within the worker
ALLOWED_QUALITY_LEVELS = {
    'free': ['low'],
    'standard': ['low', 'medium'],
    'premium': ['low', 'medium', 'high']
}

# Define quality thresholds
QUALITY_THRESHOLDS = {
    'resolution': {
        'low': 0.3 * 1024 * 768,     # Minimum 0.3 megapixels
        'medium': 1.0 * 1024 * 768,  # Minimum 1.0 megapixels
        'high': 2.0 * 1024 * 768     # Minimum 2.0 megapixels
    },
    'sharpness': {
        'low': 10,      # Minimum sharpness score
        'medium': 50,   # Medium sharpness score
        'high': 100     # High sharpness score
    },
    'count': {
        'low': 4,       # Minimum 4 images
        'medium': 10,   # Minimum 10 images
        'high': 20      # Minimum 20 images
    },
    'lighting': {
        'low': 0.1,     # Minimum lighting variance score
        'medium': 0.2,  # Medium lighting variance score
        'high': 0.3     # High lighting variance score
    },
    'coverage': {
        'low': 0.3,     # Minimum coverage score
        'medium': 0.5,  # Medium coverage score
        'high': 0.7     # High coverage score
    }
}

def parse_arguments():
    """Parses command-line arguments."""
    parser = argparse.ArgumentParser(description="Assess quality level for 3D reconstruction workflow.")
    parser.add_argument('--input-images', type=str, required=True, help='JSON string array of input image URLs')
    parser.add_argument('--quality-target', type=str, default='auto', choices=['auto', 'low', 'medium', 'high'], help='Desired quality level')
    parser.add_argument('--subscription-tier', type=str, default='standard', choices=['free', 'standard', 'premium'], help='User subscription tier')
    parser.add_argument('--output-path', type=str, required=True, help='Path to write the determined quality level')
    parser.add_argument('--max-downloads', type=int, default=10, help='Maximum number of images to download for analysis')
    parser.add_argument('--download-timeout', type=int, default=10, help='Timeout for downloading images (seconds)')
    return parser.parse_args()

def download_image(url: str, timeout: int = 10) -> Optional[bytes]:
    """
    Download an image from a URL
    
    Args:
        url: URL of the image to download
        timeout: Timeout in seconds
        
    Returns:
        Image data as bytes, or None if download failed
    """
    logger.debug(f"Downloading image from {url}")
    try:
        # Use requests if available, fallback to urllib
        if REQUESTS_AVAILABLE:
            response = requests.get(url, timeout=timeout, stream=True)
            if response.status_code != 200:
                logger.warning(f"Failed to download image from {url}: HTTP {response.status_code}")
                return None
            return response.content
        else:
            # Using urllib with a timeout
            with urllib.request.urlopen(url, timeout=timeout) as response:
                return response.read()
    except Exception as e:
        logger.warning(f"Error downloading image from {url}: {e}")
        return None

def analyze_image_quality(image_data: bytes) -> Dict[str, Any]:
    """
    Analyze the quality of an image
    
    Args:
        image_data: Image data as bytes
        
    Returns:
        Dictionary of quality metrics
    """
    results = {
        'resolution': 0,
        'sharpness': 0,
        'brightness': 0,
        'contrast': 0,
        'noise': 0,
        'error': None
    }
    
    try:
        # Open the image with PIL
        if PILLOW_AVAILABLE:
            with Image.open(io.BytesIO(image_data)) as img:
                # Get basic image properties
                width, height = img.size
                results['resolution'] = width * height
                results['aspect_ratio'] = width / height if height != 0 else 0
                
                # Convert to grayscale for analysis
                gray_img = img.convert('L')
                
                # Calculate sharpness using variance of Laplacian
                laplacian_filtered = gray_img.filter(ImageFilter.FIND_EDGES)
                stat = ImageStat.Stat(laplacian_filtered)
                results['sharpness'] = stat.variance[0] if stat.variance else 0
                
                # Calculate brightness and contrast
                stat = ImageStat.Stat(gray_img)
                results['brightness'] = stat.mean[0] / 255 if stat.mean else 0
                results['contrast'] = (stat.stddev[0] / 255) if stat.stddev else 0
        
        # Use OpenCV for more advanced analysis if available
        if OPENCV_AVAILABLE:
            # Load image with OpenCV
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Failed to decode image with OpenCV")
            
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Calculate Laplacian variance for sharpness
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            results['sharpness'] = laplacian.var()
            
            # Calculate noise using median filter difference
            median = cv2.medianBlur(gray, 5)
            noise = cv2.absdiff(gray, median)
            results['noise'] = np.mean(noise)
            
            # Calculate features for coverage estimation
            # More features indicate better coverage for 3D reconstruction
            detector = cv2.SIFT_create() if hasattr(cv2, 'SIFT_create') else cv2.ORB_create()
            keypoints = detector.detect(gray, None)
            results['feature_count'] = len(keypoints)
            results['feature_density'] = len(keypoints) / (img.shape[0] * img.shape[1])
        
        return results
    
    except Exception as e:
        logger.warning(f"Error analyzing image: {e}")
        results['error'] = str(e)
        return results

def analyze_images(image_urls_json: str, max_downloads: int = 10, download_timeout: int = 10) -> Dict[str, Any]:
    """
    Download and analyze images to determine feasible quality level
    
    Args:
        image_urls_json: JSON string array of image URLs
        max_downloads: Maximum number of images to download for analysis
        download_timeout: Timeout for downloading images (seconds)
        
    Returns:
        Dictionary of analysis results
    """
    logger.info("Starting image analysis")
    
    try:
        # Parse image URLs
        image_urls = json.loads(image_urls_json)
        total_images = len(image_urls)
        logger.info(f"Found {total_images} images in input")
        
        if total_images == 0:
            logger.warning("No images provided for analysis")
            return {
                'feasible_quality': 'low',
                'count': 0,
                'reason': 'No images provided'
            }
        
        # Limit the number of images to download
        analysis_urls = image_urls[:max_downloads]
        logger.info(f"Analyzing {len(analysis_urls)} of {total_images} images")
        
        # Download and analyze images in parallel
        image_results = []
        successful_downloads = 0
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(5, len(analysis_urls))) as executor:
            # Submit download tasks
            future_to_url = {
                executor.submit(download_image, url, download_timeout): url 
                for url in analysis_urls
            }
            
            # Process results as they complete
            for future in concurrent.futures.as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    image_data = future.result()
                    if image_data:
                        # Analyze the downloaded image
                        result = analyze_image_quality(image_data)
                        result['url'] = url
                        image_results.append(result)
                        successful_downloads += 1
                    else:
                        logger.warning(f"Failed to download image from {url}")
                except Exception as e:
                    logger.error(f"Error processing {url}: {e}")
        
        logger.info(f"Successfully analyzed {successful_downloads} of {len(analysis_urls)} images")
        
        # If no images could be analyzed, return low quality
        if not image_results:
            return {
                'feasible_quality': 'low',
                'count': total_images,
                'analyzed_count': 0,
                'reason': 'Failed to analyze any images'
            }
        
        # Calculate aggregate metrics
        resolutions = [r['resolution'] for r in image_results if 'resolution' in r and r['resolution'] > 0]
        sharpness_scores = [r['sharpness'] for r in image_results if 'sharpness' in r and r['sharpness'] > 0]
        brightness_values = [r['brightness'] for r in image_results if 'brightness' in r]
        contrast_values = [r['contrast'] for r in image_results if 'contrast' in r]
        feature_counts = [r.get('feature_count', 0) for r in image_results if 'feature_count' in r]
        
        avg_resolution = statistics.mean(resolutions) if resolutions else 0
        avg_sharpness = statistics.mean(sharpness_scores) if sharpness_scores else 0
        brightness_variance = statistics.variance(brightness_values) if len(brightness_values) > 1 else 0
        avg_feature_count = statistics.mean(feature_counts) if feature_counts else 0
        
        # Estimate coverage based on feature density and count
        coverage_score = min(1.0, avg_feature_count / 1000)  # Normalize to 0-1 range
        
        # Determine feasible quality levels for each metric
        resolution_quality = 'low'
        for level in ['high', 'medium', 'low']:
            if avg_resolution >= QUALITY_THRESHOLDS['resolution'][level]:
                resolution_quality = level
                break
        
        sharpness_quality = 'low'
        for level in ['high', 'medium', 'low']:
            if avg_sharpness >= QUALITY_THRESHOLDS['sharpness'][level]:
                sharpness_quality = level
                break
        
        count_quality = 'low'
        for level in ['high', 'medium', 'low']:
            if total_images >= QUALITY_THRESHOLDS['count'][level]:
                count_quality = level
                break
        
        lighting_quality = 'low'
        for level in ['high', 'medium', 'low']:
            if brightness_variance >= QUALITY_THRESHOLDS['lighting'][level]:
                lighting_quality = level
                break
        
        coverage_quality = 'low'
        for level in ['high', 'medium', 'low']:
            if coverage_score >= QUALITY_THRESHOLDS['coverage'][level]:
                coverage_quality = level
                break
        
        # Map quality levels to numeric values
        quality_values = {'low': 0, 'medium': 1, 'high': 2}
        
        # Calculate weighted average quality
        quality_scores = [
            (quality_values[resolution_quality], 0.25),  # Resolution: 25% weight
            (quality_values[sharpness_quality], 0.25),   # Sharpness: 25% weight
            (quality_values[count_quality], 0.20),       # Image count: 20% weight
            (quality_values[lighting_quality], 0.15),    # Lighting variance: 15% weight
            (quality_values[coverage_quality], 0.15)     # Coverage: 15% weight
        ]
        
        weighted_sum = sum(score * weight for score, weight in quality_scores)
        weighted_avg = weighted_sum / sum(weight for _, weight in quality_scores)
        
        # Convert back to quality level
        feasible_quality = 'low'
        if weighted_avg >= 1.5:
            feasible_quality = 'high'
        elif weighted_avg >= 0.5:
            feasible_quality = 'medium'
        
        # Return detailed analysis results
        return {
            'feasible_quality': feasible_quality,
            'count': total_images,
            'analyzed_count': successful_downloads,
            'avg_resolution': avg_resolution,
            'avg_sharpness': avg_sharpness,
            'brightness_variance': brightness_variance,
            'coverage_score': coverage_score,
            'metrics': {
                'resolution': resolution_quality,
                'sharpness': sharpness_quality,
                'count': count_quality,
                'lighting': lighting_quality,
                'coverage': coverage_quality
            },
            'weighted_score': weighted_avg
        }
    
    except Exception as e:
        logger.error(f"Error during image analysis: {e}")
        return {
            'feasible_quality': 'low',
            'count': 0,
            'error': str(e),
            'reason': 'Analysis error'
        }

def determine_quality_level(args, image_analysis_results):
    """Determines the final quality level based on inputs."""
    
    # 1. Determine max quality allowed by subscription
    allowed_levels = ALLOWED_QUALITY_LEVELS.get(args.subscription_tier, ['low'])
    max_allowed_quality = allowed_levels[-1] # Highest allowed level
    
    print(f"Subscription tier '{args.subscription_tier}' allows max quality '{max_allowed_quality}'")

    # 2. Determine quality based on target and feasibility
    target_quality = args.quality_target
    feasible_quality = image_analysis_results.get('feasible_quality', 'low') # Get from placeholder analysis

    # Output detailed analysis results if available
    metrics = image_analysis_results.get('metrics', {})
    if metrics:
        logger.info("Detailed quality analysis:")
        for metric, quality in metrics.items():
            logger.info(f"  - {metric}: {quality}")
    
    weighted_score = image_analysis_results.get('weighted_score')
    if weighted_score is not None:
        logger.info(f"Overall weighted quality score: {weighted_score:.2f}")
    
    # Determine final quality based on target and feasibility
    final_quality = 'low'  # Default
    
    if target_quality == 'auto':
        # If auto, use the feasible quality determined by analysis
        final_quality = feasible_quality
        logger.info(f"Quality target is 'auto', using feasible quality: '{final_quality}'")
    else:
        # If specific target, use it but cap by feasibility
        final_quality = target_quality
        logger.info(f"User requested quality target: '{final_quality}'")
        
        # Don't allow higher than feasible quality
        quality_ranking = {'low': 0, 'medium': 1, 'high': 2}
        if quality_ranking.get(final_quality, 0) > quality_ranking.get(feasible_quality, 0):
            logger.info(f"Requested quality '{final_quality}' exceeds feasible quality '{feasible_quality}'. Downgrading.")
            final_quality = feasible_quality

    # 3. Cap the quality by subscription limits
    allowed_indices = {'low': 0, 'medium': 1, 'high': 2}
    max_allowed_index = allowed_indices.get(max_allowed_quality, 0)
    final_quality_index = allowed_indices.get(final_quality, 0)

    if final_quality_index > max_allowed_index:
        logger.info(f"Requested/Feasible quality '{final_quality}' exceeds subscription limit '{max_allowed_quality}'. Downgrading.")
        # Find the highest allowed quality level by index
        for level, index in reversed(allowed_indices.items()):
             if index <= max_allowed_index:
                  final_quality = level
                  break
    
    # Output reason for quality selection
    reason = image_analysis_results.get('reason')
    if reason:
        logger.info(f"Quality assessment reason: {reason}")

    print(f"Final determined quality level: '{final_quality}'")
    return final_quality

def main():
    """Main execution function."""
    args = parse_arguments()
    
    print("--- Starting Quality Assessment ---")
    print(f"Input Images JSON: {args.input_images}")
    print(f"Quality Target: {args.quality_target}")
    print(f"Subscription Tier: {args.subscription_tier}")
    print(f"Output Path: {args.output_path}")
    
    # Analyze the images
    analysis_results = analyze_images(
        args.input_images,
        max_downloads=args.max_downloads,
        download_timeout=args.download_timeout
    )
    
    # Determine the final quality level
    quality_level = determine_quality_level(args, analysis_results)
    
    # Ensure output directory exists
    output_dir = os.path.dirname(args.output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        
    # Write the result to the output file
    try:
        with open(args.output_path, 'w') as f:
            f.write(quality_level)
        print(f"Successfully wrote quality level '{quality_level}' to {args.output_path}")
    except IOError as e:
        print(f"Error writing output file {args.output_path}: {e}", file=sys.stderr)
        sys.exit(1)
        
    print("--- Quality Assessment Finished ---")

if __name__ == "__main__":
    main()
]]>