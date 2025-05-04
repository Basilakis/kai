#!/usr/bin/env python
"""
Material-Specific OCR Extraction

This script extracts metadata from OCR text using material-specific patterns
and context-aware extraction for complex fields.
"""

import os
import sys
import json
import re
import time
import argparse
import logging
from typing import Dict, Any, List, Optional, Tuple, Union
import uuid

# Import material type detector
from material_type_detector import MaterialTypeDetector

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('material-specific-ocr')


class MaterialSpecificOCR:
    """Extracts metadata from OCR text using material-specific patterns"""
    
    def __init__(self, metadata_fields_path: Optional[str] = None, model_path: Optional[str] = None):
        """
        Initialize the OCR extractor
        
        Args:
            metadata_fields_path: Path to metadata fields JSON file
            model_path: Optional path to ML model for material type detection
        """
        self.metadata_fields_path = metadata_fields_path
        self.metadata_fields = self._load_metadata_fields()
        self.material_type_detector = MaterialTypeDetector(model_path)
    
    def _load_metadata_fields(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Load metadata fields from file
        
        Returns:
            Dictionary mapping material types to lists of metadata fields
        """
        fields_by_type = {
            'tile': [],
            'wood': [],
            'lighting': [],
            'furniture': [],
            'decoration': [],
            'all': []  # Common fields for all material types
        }
        
        if self.metadata_fields_path and os.path.exists(self.metadata_fields_path):
            try:
                with open(self.metadata_fields_path, 'r', encoding='utf-8') as f:
                    all_fields = json.load(f)
                    
                    # Group fields by material type
                    for field in all_fields:
                        if 'categories' in field:
                            for category in field['categories']:
                                if category in fields_by_type:
                                    fields_by_type[category].append(field)
                        elif 'materialType' in field:
                            material_type = field['materialType']
                            if material_type in fields_by_type:
                                fields_by_type[material_type].append(field)
                
                logger.info(f"Loaded metadata fields from {self.metadata_fields_path}")
                
                # Log field counts by type
                for material_type, fields in fields_by_type.items():
                    logger.info(f"  {material_type}: {len(fields)} fields")
                
            except Exception as e:
                logger.error(f"Error loading metadata fields: {e}")
        else:
            logger.warning("No metadata fields file provided or file not found")
        
        return fields_by_type
    
    def extract_value_from_ocr(
        self, 
        field: Dict[str, Any], 
        ocr_text: str
    ) -> Optional[Dict[str, Any]]:
        """
        Extract value for a metadata field from OCR text
        
        Args:
            field: Metadata field
            ocr_text: OCR text
            
        Returns:
            Extraction result or None if not found
        """
        # Check if field has extraction patterns
        if 'extractionPatterns' not in field or not field['extractionPatterns']:
            return None
        
        # Try extraction patterns
        for pattern in field['extractionPatterns']:
            try:
                match = re.search(pattern, ocr_text, re.IGNORECASE)
                
                if match and match.group(1):
                    value = match.group(1).strip()
                    
                    # Convert value based on field type
                    converted_value = self._convert_field_value(field, value)
                    
                    return {
                        'value': converted_value,
                        'confidence': 0.9,  # High confidence for pattern match
                        'method': 'pattern',
                        'pattern': pattern
                    }
            except Exception as e:
                logger.warning(f"Invalid extraction pattern {pattern} for field {field.get('name')}: {e}")
        
        # If no pattern matched, try hint-based extraction
        if 'hint' in field and field['hint']:
            hint_result = self._extract_value_using_hint(field, ocr_text)
            if hint_result:
                return hint_result
        
        return None
    
    def _extract_value_using_hint(
        self, 
        field: Dict[str, Any], 
        ocr_text: str
    ) -> Optional[Dict[str, Any]]:
        """
        Extract value using field hint
        
        Args:
            field: Metadata field
            ocr_text: OCR text
            
        Returns:
            Extraction result or None if not found
        """
        # Split text into lines
        lines = ocr_text.split('\n')
        
        # Look for lines containing field name or display name
        field_name = field.get('name', '').lower()
        display_name = field.get('displayName', '').lower()
        
        for line in lines:
            lower_line = line.lower()
            
            if field_name and field_name in lower_line or display_name and display_name in lower_line:
                # Extract value after the field name or display name
                parts = re.split(r'[:：]', line, 1)
                
                if len(parts) > 1 and parts[1]:
                    value = parts[1].strip()
                    converted_value = self._convert_field_value(field, value)
                    
                    return {
                        'value': converted_value,
                        'confidence': 0.7,  # Medium confidence for hint-based extraction
                        'method': 'hint'
                    }
        
        return None
    
    def _convert_field_value(self, field: Dict[str, Any], value: str) -> Any:
        """
        Convert field value based on field type
        
        Args:
            field: Metadata field
            value: String value
            
        Returns:
            Converted value
        """
        field_type = field.get('fieldType', 'text')
        
        if field_type == 'number':
            # Extract numeric value
            num_match = re.search(r'[\d.]+', value)
            if num_match:
                return float(num_match.group(0))
            return None
            
        elif field_type == 'boolean':
            # Convert to boolean
            lower_value = value.lower()
            if lower_value in ['yes', 'true', '1', 'y']:
                return True
            if lower_value in ['no', 'false', '0', 'n']:
                return False
            return None
            
        elif field_type == 'dropdown':
            # Match with dropdown options
            if 'options' in field and field['options']:
                # Try exact match first
                for option in field['options']:
                    option_value = option.get('value', '').lower()
                    option_label = option.get('label', '').lower()
                    
                    if value.lower() == option_value or value.lower() == option_label:
                        return option.get('value')
                
                # Try partial match
                for option in field['options']:
                    option_value = option.get('value', '').lower()
                    option_label = option.get('label', '').lower()
                    
                    if option_value in value.lower() or option_label in value.lower():
                        return option.get('value')
            
            return value  # Return as is if no match
            
        else:
            return value
    
    def extract_metadata(
        self, 
        ocr_text: str, 
        image_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract metadata from OCR text
        
        Args:
            ocr_text: OCR text
            image_path: Optional path to the image file
            
        Returns:
            Extraction result
        """
        start_time = time.time()
        
        logger.info('Extracting metadata from OCR text')
        
        # First, detect material type
        material_type_result = self.material_type_detector.detect(ocr_text, image_path)
        material_type = material_type_result['materialType']
        
        logger.info(f"Detected material type: {material_type} with confidence {material_type_result['confidence']}")
        
        # Get metadata fields for this material type
        fields = self.metadata_fields.get(material_type, []) + self.metadata_fields.get('all', [])
        
        logger.info(f"Found {len(fields)} metadata fields for material type {material_type}")
        
        # Extract values for each field
        extracted_fields = {}
        extraction_confidence = {}
        extraction_methods = {}
        
        for field in fields:
            field_name = field.get('name')
            if not field_name:
                continue
                
            extraction_result = self.extract_value_from_ocr(field, ocr_text)
            
            if extraction_result:
                extracted_fields[field_name] = extraction_result['value']
                extraction_confidence[field_name] = extraction_result['confidence']
                extraction_methods[field_name] = extraction_result['method']
                
                logger.debug(f"Extracted {field_name}: {extraction_result['value']} "
                            f"(confidence: {extraction_result['confidence']}, "
                            f"method: {extraction_result['method']})")
        
        # Add context-aware extraction for complex fields
        self._enhance_extraction_with_context(
            extracted_fields,
            extraction_confidence,
            extraction_methods,
            ocr_text,
            material_type,
            fields
        )
        
        processing_time = time.time() - start_time
        
        return {
            'materialType': material_type,
            'materialTypeConfidence': material_type_result['confidence'],
            'extractedFields': extracted_fields,
            'extractionConfidence': extraction_confidence,
            'extractionMethods': extraction_methods,
            'rawText': ocr_text,
            'processingTime': processing_time
        }
    
    def _enhance_extraction_with_context(
        self,
        extracted_fields: Dict[str, Any],
        extraction_confidence: Dict[str, float],
        extraction_methods: Dict[str, str],
        ocr_text: str,
        material_type: str,
        fields: List[Dict[str, Any]]
    ) -> None:
        """
        Enhance extraction with context-aware processing
        
        Args:
            extracted_fields: Extracted fields
            extraction_confidence: Extraction confidence
            extraction_methods: Extraction methods
            ocr_text: OCR text
            material_type: Material type
            fields: Metadata fields
        """
        # Implement material-specific context-aware extraction
        
        # Example: For tiles, extract size from dimensions
        if material_type == 'tile':
            # If we have dimensions but not size, try to extract size
            if 'dimensions' in extracted_fields and 'size' not in extracted_fields:
                dimensions = extracted_fields['dimensions']
                if isinstance(dimensions, str):
                    size_match = re.search(r'(\d+)\s*[xX×]\s*(\d+)', dimensions)
                    
                    if size_match:
                        extracted_fields['size'] = f"{size_match.group(1)}x{size_match.group(2)}"
                        extraction_confidence['size'] = 0.8
                        extraction_methods['size'] = 'context'
                        
                        logger.debug(f"Context-aware extraction: size = {extracted_fields['size']}")
            
            # If we have size but not dimensions, use size as dimensions
            if 'size' in extracted_fields and 'dimensions' not in extracted_fields:
                extracted_fields['dimensions'] = extracted_fields['size']
                extraction_confidence['dimensions'] = extraction_confidence['size']
                extraction_methods['dimensions'] = 'context'
                
                logger.debug(f"Context-aware extraction: dimensions = {extracted_fields['dimensions']}")
        
        # Example: For wood, extract width and length from dimensions
        elif material_type == 'wood':
            # If we have dimensions but not width/length, try to extract them
            if ('dimensions' in extracted_fields and 
                    ('width' not in extracted_fields or 'length' not in extracted_fields)):
                dimensions = extracted_fields['dimensions']
                if isinstance(dimensions, str):
                    dimensions_match = re.search(r'(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)', dimensions)
                    
                    if dimensions_match:
                        if 'width' not in extracted_fields:
                            extracted_fields['width'] = float(dimensions_match.group(1))
                            extraction_confidence['width'] = 0.8
                            extraction_methods['width'] = 'context'
                            
                            logger.debug(f"Context-aware extraction: width = {extracted_fields['width']}")
                        
                        if 'length' not in extracted_fields:
                            extracted_fields['length'] = float(dimensions_match.group(2))
                            extraction_confidence['length'] = 0.8
                            extraction_methods['length'] = 'context'
                            
                            logger.debug(f"Context-aware extraction: length = {extracted_fields['length']}")
        
        # Add more material-specific context-aware extraction as needed


def main():
    """Main function to parse arguments and run the extraction"""
    parser = argparse.ArgumentParser(description="Extract metadata from OCR text using material-specific patterns")
    parser.add_argument("--text", help="OCR text to analyze")
    parser.add_argument("--text-file", help="Path to OCR text file to analyze")
    parser.add_argument("--image", help="Path to image file (optional)")
    parser.add_argument("--metadata-fields", help="Path to metadata fields JSON file")
    parser.add_argument("--model", help="Path to ML model for material type detection")
    parser.add_argument("--output", help="Path to output JSON file (optional)")
    
    args = parser.parse_args()
    
    # Ensure we have either text or text file
    if not args.text and not args.text_file:
        parser.error("Either --text or --text-file is required")
    
    # Get text from file if provided
    ocr_text = args.text
    if args.text_file:
        try:
            with open(args.text_file, 'r', encoding='utf-8') as f:
                ocr_text = f.read()
        except Exception as e:
            logger.error(f"Error reading text file: {e}")
            sys.exit(1)
    
    try:
        # Create extractor
        extractor = MaterialSpecificOCR(args.metadata_fields, args.model)
        
        # Extract metadata
        result = extractor.extract_metadata(ocr_text, args.image)
        
        # Save to output file if provided
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
            logger.info(f"Saved extraction result to {args.output}")
        
        # Print result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        logger.error(f"Error in metadata extraction: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
