#!/usr/bin/env python3
"""
PDF Extractor

This script extracts images and text from PDF files using PyMuPDF (fitz).
It identifies images, extracts them to files, and captures text content
with their positions.

Usage:
    python pdf_extractor.py <pdf_path> <output_dir>

Arguments:
    pdf_path    Path to the PDF file
    output_dir  Directory to save extracted images and metadata

Output:
    - Extracted images saved to the output directory
    - JSON file with metadata about extracted images and text
"""

import os
import sys
import json
import uuid
import fitz  # PyMuPDF
import argparse
from PIL import Image
import io
import numpy as np
from datetime import datetime


def extract_images_from_pdf(pdf_path, output_dir):
    """
    Extract images from a PDF file and save them to the output directory.
    
    Args:
        pdf_path (str): Path to the PDF file
        output_dir (str): Directory to save extracted images
        
    Returns:
        dict: Extraction results with image metadata and text content
    """
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Open the PDF
    doc = fitz.open(pdf_path)
    
    # Prepare result structure
    result = {
        "images": [],
        "text": [],
        "metadata": {
            "filename": os.path.basename(pdf_path),
            "page_count": len(doc),
            "extraction_time": datetime.now().isoformat(),
        }
    }
    
    # Extract document metadata if available
    metadata = doc.metadata
    if metadata:
        result["metadata"]["title"] = metadata.get("title", "")
        result["metadata"]["author"] = metadata.get("author", "")
        result["metadata"]["subject"] = metadata.get("subject", "")
        result["metadata"]["keywords"] = metadata.get("keywords", "")
        result["metadata"]["creator"] = metadata.get("creator", "")
        result["metadata"]["producer"] = metadata.get("producer", "")
    
    # Process each page
    for page_num, page in enumerate(doc):
        # Extract text with positions
        text_blocks = page.get_text("dict")["blocks"]
        for block in text_blocks:
            if "lines" in block:
                for line in block["lines"]:
                    if "spans" in line:
                        for span in line["spans"]:
                            text_content = span["text"].strip()
                            if text_content:
                                # Convert coordinates to a more standard format
                                # PyMuPDF uses a bottom-left origin coordinate system
                                # We convert to top-left origin for consistency
                                x0, y0, x1, y1 = span["bbox"]
                                height = page.rect.height
                                
                                result["text"].append({
                                    "page": page_num + 1,
                                    "content": text_content,
                                    "coordinates": {
                                        "x": x0,
                                        "y": height - y1,  # Convert to top-left origin
                                        "width": x1 - x0,
                                        "height": y1 - y0
                                    },
                                    "font": span.get("font", ""),
                                    "font_size": span.get("size", 0),
                                    "color": span.get("color", 0)
                                })
        
        # Extract images
        image_list = page.get_images(full=True)
        
        for img_index, img_info in enumerate(image_list):
            img_id = img_info[0]
            base_img = doc.extract_image(img_id)
            
            if not base_img:
                continue
                
            image_bytes = base_img["image"]
            image_ext = base_img["ext"]
            
            # Generate a unique filename
            image_id = str(uuid.uuid4())
            image_filename = f"page_{page_num+1}_img_{img_index+1}_{image_id}.{image_ext}"
            image_path = os.path.join(output_dir, image_filename)
            
            # Save the image
            with open(image_path, "wb") as img_file:
                img_file.write(image_bytes)
            
            # Get image dimensions
            try:
                with Image.open(io.BytesIO(image_bytes)) as img:
                    width, height = img.size
            except Exception as e:
                print(f"Warning: Could not determine image dimensions: {e}", file=sys.stderr)
                width, height = 0, 0
            
            # Get image position on the page
            # This is an approximation as PyMuPDF doesn't directly provide image positions
            # In a real implementation, you would use more sophisticated methods
            xref = img_info[0]
            rect = page.get_image_bbox(xref)
            
            if rect:
                x0, y0, x1, y1 = rect
                page_height = page.rect.height
                
                # Add image metadata to result
                result["images"].append({
                    "id": image_id,
                    "path": image_path,
                    "page": page_num + 1,
                    "filename": image_filename,
                    "width": width,
                    "height": height,
                    "coordinates": {
                        "x": x0,
                        "y": page_height - y1,  # Convert to top-left origin
                        "width": x1 - x0,
                        "height": y1 - y0
                    }
                })
    
    # Close the document
    doc.close()
    
    # Save metadata to JSON file
    metadata_path = os.path.join(output_dir, "extraction_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(result, f, indent=2)
    
    return result


def main():
    """Main function to parse arguments and run the extraction"""
    parser = argparse.ArgumentParser(description="Extract images and text from PDF files")
    parser.add_argument("pdf_path", help="Path to the PDF file")
    parser.add_argument("output_dir", help="Directory to save extracted images")
    
    args = parser.parse_args()
    
    try:
        result = extract_images_from_pdf(args.pdf_path, args.output_dir)
        # Print the result as JSON to stdout for the Node.js process to capture
        print(json.dumps(result))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()