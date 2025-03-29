#!/usr/bin/env python3
"""
Material-Specific Document Processor

This module provides specialized processing for material catalogs,
datasheets, and technical documentation with domain-specific knowledge.

Key features:
1. Material code recognition and normalization
2. Technical specifications extraction and validation
3. Material category and type identification
4. Dimensional information parsing
5. Property-value pair extraction with domain validation
6. Cross-reference detection between related materials
"""

import os
import sys
import json
import re
import logging
import numpy as np
import cv2
from typing import Dict, List, Any, Tuple, Optional, Union, Set
from dataclasses import dataclass, field
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class MaterialField:
    """Represents a specific field from material documentation"""
    name: str
    value: Any
    confidence: float = 0.0
    source_region: Tuple[int, int, int, int] = None
    alternatives: List[Any] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    normalized_value: Any = None
    validation_status: str = "unvalidated"  # unvalidated, valid, invalid, warning
    validation_message: str = ""


@dataclass
class MaterialDocument:
    """Represents a processed material document with extracted fields"""
    document_id: str
    material_type: str = None
    fields: Dict[str, MaterialField] = field(default_factory=dict)
    related_materials: List[str] = field(default_factory=list)
    images: Dict[str, Any] = field(default_factory=dict)
    processing_metadata: Dict[str, Any] = field(default_factory=dict)
    raw_text: str = None
    confidence_score: float = 0.0


class MaterialSpecificProcessor:
    """
    Processes material catalogs and technical documentation
    with domain-specific knowledge and validation.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the material processor
        
        Args:
            config: Configuration dictionary
        """
        self.config = {
            'material_types': ['tile', 'stone', 'wood', 'carpet', 'vinyl', 'laminate'],
            'enable_technical_validation': True,
            'enable_code_normalization': True,
            'enable_cross_reference': True,
            'enable_unit_conversion': True,
            'confidence_threshold': 0.6,
            'validation_rules_path': None,
            'domain_vocabulary_path': None,
            'catalog_templates_path': None,
            'output_format': 'json',
            'store_images': True,
            'extraction_models': {
                'dimension': 'default',
                'code': 'enhanced',
                'property': 'default'
            }
        }
        
        if config:
            self.config.update(config)
        
        # Load domain knowledge
        self.validation_rules = {}
        self.domain_vocabulary = {}
        self.catalog_templates = {}
        
        self._load_domain_knowledge()
        
        # Initialize extractors
        self.extractors = self._initialize_extractors()
    
    def _load_domain_knowledge(self):
        """Load domain-specific knowledge bases"""
        # Load validation rules
        if self.config['validation_rules_path'] and os.path.exists(self.config['validation_rules_path']):
            try:
                with open(self.config['validation_rules_path'], 'r', encoding='utf-8') as f:
                    self.validation_rules = json.load(f)
                logger.info(f"Loaded {len(self.validation_rules)} validation rules")
            except Exception as e:
                logger.error(f"Error loading validation rules: {e}")
        else:
            # Use default built-in rules
            self.validation_rules = self._get_default_validation_rules()
        
        # Load domain vocabulary
        if self.config['domain_vocabulary_path'] and os.path.exists(self.config['domain_vocabulary_path']):
            try:
                with open(self.config['domain_vocabulary_path'], 'r', encoding='utf-8') as f:
                    self.domain_vocabulary = json.load(f)
                logger.info(f"Loaded domain vocabulary with {len(self.domain_vocabulary)} terms")
            except Exception as e:
                logger.error(f"Error loading domain vocabulary: {e}")
        else:
            # Use default built-in vocabulary
            self.domain_vocabulary = self._get_default_domain_vocabulary()
        
        # Load catalog templates
        if self.config['catalog_templates_path'] and os.path.exists(self.config['catalog_templates_path']):
            try:
                with open(self.config['catalog_templates_path'], 'r', encoding='utf-8') as f:
                    self.catalog_templates = json.load(f)
                logger.info(f"Loaded {len(self.catalog_templates)} catalog templates")
            except Exception as e:
                logger.error(f"Error loading catalog templates: {e}")
        else:
            # Use default built-in templates
            self.catalog_templates = self._get_default_catalog_templates()
    
    def _get_default_validation_rules(self) -> Dict[str, Any]:
        """Get default built-in validation rules"""
        return {
            "dimension": {
                "rules": [
                    {
                        "field": "width",
                        "type": "range",
                        "min": 10,
                        "max": 2000,
                        "unit": "mm"
                    },
                    {
                        "field": "length",
                        "type": "range",
                        "min": 10,
                        "max": 2000,
                        "unit": "mm"
                    },
                    {
                        "field": "thickness",
                        "type": "range",
                        "min": 3,
                        "max": 30,
                        "unit": "mm"
                    }
                ]
            },
            "technical": {
                "rules": [
                    {
                        "field": "water_absorption",
                        "type": "range",
                        "min": 0,
                        "max": 20,
                        "unit": "%"
                    },
                    {
                        "field": "breaking_strength",
                        "type": "range",
                        "min": 500,
                        "max": 10000,
                        "unit": "N"
                    },
                    {
                        "field": "pei_rating",
                        "type": "enum",
                        "values": ["I", "II", "III", "IV", "V"]
                    },
                    {
                        "field": "slip_resistance",
                        "type": "enum",
                        "values": ["R9", "R10", "R11", "R12", "R13"]
                    }
                ]
            },
            "code": {
                "rules": [
                    {
                        "field": "product_code",
                        "type": "pattern",
                        "pattern": "^[A-Z0-9\\-]{3,15}$"
                    },
                    {
                        "field": "sku",
                        "type": "pattern",
                        "pattern": "^[A-Z0-9]{5,10}$"
                    }
                ]
            }
        }
    
    def _get_default_domain_vocabulary(self) -> Dict[str, Any]:
        """Get default built-in domain vocabulary"""
        return {
            "material_types": {
                "tile": ["ceramic", "porcelain", "glass", "mosaic", "subway"],
                "stone": ["granite", "marble", "limestone", "travertine", "slate", "quartzite"],
                "wood": ["hardwood", "engineered", "oak", "maple", "walnut", "bamboo"],
                "carpet": ["nylon", "polyester", "wool", "berber", "frieze", "loop"],
                "vinyl": ["lvt", "lvp", "sheet", "plank", "luxury vinyl"],
                "laminate": ["laminate", "pergo"]
            },
            "finishes": {
                "tile": ["matte", "glossy", "polished", "honed", "textured", "rectified"],
                "stone": ["polished", "honed", "brushed", "antiqued", "flamed", "tumbled"],
                "wood": ["matte", "satin", "semi-gloss", "gloss", "distressed", "brushed"],
                "vinyl": ["embossed", "smooth", "textured"],
                "laminate": ["embossed", "smooth", "hand-scraped", "distressed"]
            },
            "technical_terms": {
                "tile": {
                    "pei_rating": "Porcelain Enamel Institute rating for wear resistance",
                    "mohs_hardness": "Mineral hardness scale from 1-10",
                    "water_absorption": "Percentage of water absorption by weight",
                    "breaking_strength": "Load in Newtons to break tile",
                    "dcof": "Dynamic Coefficient of Friction for slip resistance"
                }
            },
            "units": {
                "dimension": {
                    "mm": {"aliases": ["millimeter", "millimeters", "mm."], "base": 1.0},
                    "cm": {"aliases": ["centimeter", "centimeters", "cm."], "base": 10.0},
                    "in": {"aliases": ["inch", "inches", "in.", "\""], "base": 25.4},
                    "ft": {"aliases": ["foot", "feet", "ft.", "'"], "base": 304.8}
                },
                "area": {
                    "m2": {"aliases": ["sq m", "square meter", "square meters", "m²"], "base": 1.0},
                    "sqft": {"aliases": ["sq ft", "square foot", "square feet", "ft²"], "base": 0.0929}
                },
                "weight": {
                    "kg": {"aliases": ["kilogram", "kilograms", "kg."], "base": 1.0},
                    "lb": {"aliases": ["pound", "pounds", "lb.", "lbs", "lbs."], "base": 0.4536}
                }
            }
        }
    
    def _get_default_catalog_templates(self) -> Dict[str, Any]:
        """Get default built-in catalog templates"""
        return {
            "tile_catalog": {
                "regions": {
                    "header": {"position": "top", "content_type": "title"},
                    "product_grid": {"position": "middle", "content_type": "grid"},
                    "specs_table": {"position": "bottom", "content_type": "table"}
                },
                "fields": {
                    "product_name": {"patterns": ["([A-Z][a-z]+\\s*)+"]},
                    "dimensions": {"patterns": ["(\\d+)\\s*[xX×]\\s*(\\d+)", "(\\d+)\\s*by\\s*(\\d+)"]},
                    "product_code": {"patterns": ["([A-Z0-9]{3,10})", "Code[:]?\\s*([A-Z0-9-]+)"]}
                }
            },
            "stone_catalog": {
                "regions": {
                    "header": {"position": "top", "content_type": "title"},
                    "product_image": {"position": "middle", "content_type": "image"},
                    "specs_list": {"position": "middle_right", "content_type": "list"}
                },
                "fields": {
                    "stone_name": {"patterns": ["([A-Z][a-z]+\\s*)+"]},
                    "stone_type": {"patterns": ["Type[:]?\\s*([A-Za-z]+)", "([A-Za-z]+)\\s*stone"]},
                    "origin": {"patterns": ["Origin[:]?\\s*([A-Za-z]+)", "from\\s*([A-Za-z]+)"]}
                }
            }
        }
    
    def _initialize_extractors(self) -> Dict[str, Any]:
        """Initialize specialized field extractors"""
        extractors = {}
        
        # Initialize dimension extractor
        extractors['dimension'] = DimensionExtractor(
            model_type=self.config['extraction_models']['dimension'],
            vocabulary=self.domain_vocabulary.get('units', {}).get('dimension', {}),
            enable_unit_conversion=self.config['enable_unit_conversion']
        )
        
        # Initialize code extractor
        extractors['code'] = CodeExtractor(
            model_type=self.config['extraction_models']['code'],
            enable_normalization=self.config['enable_code_normalization']
        )
        
        # Initialize property extractor
        extractors['property'] = PropertyExtractor(
            model_type=self.config['extraction_models']['property'],
            technical_terms=self.domain_vocabulary.get('technical_terms', {})
        )
        
        # Initialize other specialized extractors
        extractors['material_type'] = MaterialTypeClassifier(
            vocabulary=self.domain_vocabulary.get('material_types', {})
        )
        
        extractors['relation'] = RelationExtractor(
            enable_cross_reference=self.config['enable_cross_reference']
        )
        
        extractors['image'] = MaterialImageClassifier()
        
        return extractors
    
    def process_document(self, document_path: str, ocr_result: Dict[str, Any] = None) -> MaterialDocument:
        """
        Process a material document with OCR results
        
        Args:
            document_path: Path to the original document
            ocr_result: Pre-computed OCR results
            
        Returns:
            MaterialDocument with extracted fields
        """
        document_id = os.path.basename(document_path)
        
        # Create document container
        doc = MaterialDocument(document_id=document_id)
        
        # Add processing metadata
        doc.processing_metadata = {
            'processor_version': '1.0',
            'processing_time': datetime.now().isoformat(),
            'source_path': document_path,
            'extractors_used': list(self.extractors.keys())
        }
        
        # If OCR result not provided, just return empty document
        if not ocr_result:
            doc.confidence_score = 0.0
            doc.processing_metadata['status'] = 'no_ocr_data'
            return doc
        
        # Extract raw text from OCR result
        doc.raw_text = self._extract_raw_text(ocr_result)
        
        # Determine material type
        doc.material_type = self.extractors['material_type'].extract(
            ocr_result, doc.raw_text
        )
        
        # Process layout elements in OCR result
        for element in self._get_elements_from_ocr(ocr_result):
            element_type = element.get('element_type', '')
            element_text = element.get('text', '')
            element_bbox = element.get('bbox')
            
            # Process by element type
            if element_type in ['text', 'paragraph']:
                self._process_text_element(doc, element_text, element_bbox)
            elif element_type == 'table':
                self._process_table_element(doc, element, element_bbox)
            elif element_type in ['figure', 'image']:
                self._process_image_element(doc, element, document_path)
            elif element_type == 'form_field':
                self._process_form_element(doc, element, element_bbox)
            elif element_type.startswith('material_'):
                # This is a specialized material region detected by layout analyzer
                self._process_material_region(doc, element, element_type)
        
        # Extract relationships between materials
        if self.config['enable_cross_reference']:
            doc.related_materials = self.extractors['relation'].extract(
                doc.raw_text, doc.fields
            )
        
        # Validate extracted fields
        if self.config['enable_technical_validation']:
            self._validate_extracted_fields(doc)
        
        # Calculate overall confidence score
        doc.confidence_score = self._calculate_confidence(doc)
        
        return doc
    
    def _extract_raw_text(self, ocr_result: Dict[str, Any]) -> str:
        """Extract concatenated raw text from OCR result"""
        raw_text = ""
        
        # Check for pages in OCR result (PDF case)
        if 'pages' in ocr_result:
            for page in ocr_result['pages']:
                if 'text' in page:
                    raw_text += page['text'] + "\n\n"
                elif 'elements' in page:
                    # Concatenate text from elements
                    for element in page['elements']:
                        if 'text' in element:
                            raw_text += element['text'] + "\n"
        
        # Check for direct elements
        elif 'elements' in ocr_result:
            for element in ocr_result['elements']:
                if 'text' in element:
                    raw_text += element['text'] + "\n"
        
        # If there's a direct 'text' field, use it
        elif 'text' in ocr_result:
            raw_text = ocr_result['text']
        
        return raw_text
    
    def _get_elements_from_ocr(self, ocr_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get a flattened list of elements from OCR result"""
        elements = []
        
        # Check for pages in OCR result (PDF case)
        if 'pages' in ocr_result:
            for page in ocr_result['pages']:
                if 'elements' in page:
                    for element in page['elements']:
                        # Add page number to element
                        element['page_num'] = page.get('page_num', 1)
                        elements.append(element)
        
        # Check for direct elements
        elif 'elements' in ocr_result:
            elements = ocr_result['elements']
        
        return elements
    
    def _process_text_element(self, doc: MaterialDocument, text: str, bbox: Tuple[int, int, int, int]):
        """Process a text element for field extraction"""
        if not text:
            return
        
        # Try dimension extraction
        dimensions = self.extractors['dimension'].extract(text)
        for dim_name, dim_value in dimensions.items():
            field = MaterialField(
                name=dim_name,
                value=dim_value['value'],
                confidence=dim_value['confidence'],
                source_region=bbox,
                normalized_value=dim_value.get('normalized_value')
            )
            
            # Only add if confidence is above threshold
            if field.confidence >= self.config['confidence_threshold']:
                doc.fields[dim_name] = field
        
        # Try code extraction
        codes = self.extractors['code'].extract(text)
        for code_name, code_value in codes.items():
            field = MaterialField(
                name=code_name,
                value=code_value['value'],
                confidence=code_value['confidence'],
                source_region=bbox,
                normalized_value=code_value.get('normalized_value')
            )
            
            if field.confidence >= self.config['confidence_threshold']:
                doc.fields[code_name] = field
        
        # Try property extraction
        properties = self.extractors['property'].extract(text, doc.material_type)
        for prop_name, prop_value in properties.items():
            field = MaterialField(
                name=prop_name,
                value=prop_value['value'],
                confidence=prop_value['confidence'],
                source_region=bbox,
                normalized_value=prop_value.get('normalized_value'),
                metadata=prop_value.get('metadata', {})
            )
            
            if field.confidence >= self.config['confidence_threshold']:
                doc.fields[prop_name] = field
    
    def _process_table_element(self, doc: MaterialDocument, element: Dict[str, Any], bbox: Tuple[int, int, int, int]):
        """Process a table element for structured field extraction"""
        # Table structure should be in attributes
        table_structure = element.get('attributes', {}).get('structure', {})
        
        # If no table structure, try to extract from text as property-value pairs
        if not table_structure and 'text' in element:
            self._process_text_element(doc, element['text'], bbox)
            return
        
        # Process structured table
        rows = table_structure.get('rows', 0)
        columns = table_structure.get('columns', 0)
        cells = table_structure.get('cells', [])
        
        # Process each cell
        for cell in cells:
            row = cell.get('row', 0)
            col = cell.get('col', 0)
            cell_text = cell.get('text', '')
            
            # Skip empty cells
            if not cell_text:
                continue
            
            # Assume first column contains field names in key-value tables
            if col == 0 and columns >= 2:
                # This cell likely contains a field name
                field_name = self._normalize_field_name(cell_text)
                
                # Look for corresponding value in next column
                value_cell = self._find_value_cell(row, cells)
                if value_cell:
                    value_text = value_cell.get('text', '')
                    
                    field = MaterialField(
                        name=field_name,
                        value=value_text,
                        confidence=0.8,  # Higher confidence for tabular data
                        source_region=bbox
                    )
                    
                    # Try to normalize and validate the value
                    if field_name in ['width', 'length', 'thickness', 'height']:
                        # Apply dimension extraction to normalize
                        dim_result = self.extractors['dimension'].extract_single(value_text)
                        if dim_result:
                            field.normalized_value = dim_result.get('normalized_value')
                            field.metadata = dim_result.get('metadata', {})
                    
                    doc.fields[field_name] = field
            
            # Process general table cell content
            cell_bbox = cell.get('bbox', None)
            self._process_text_element(doc, cell_text, cell_bbox or bbox)
    
    def _find_value_cell(self, row: int, cells: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Find the value cell for a given row in a key-value table"""
        for cell in cells:
            if cell.get('row') == row and cell.get('col') == 1:
                return cell
        return None
    
    def _normalize_field_name(self, field_name: str) -> str:
        """Normalize field name for consistency"""
        # Remove trailing characters
        field_name = field_name.strip(' :-\t\n')
        
        # Convert to lowercase and replace spaces with underscores
        normalized = field_name.lower().replace(' ', '_')
        
        # Handle common variations
        mapping = {
            'width': ['width', 'wide', 'w', 'w.'],
            'length': ['length', 'long', 'l', 'l.'],
            'thickness': ['thickness', 'thick', 't', 't.', 'depth'],
            'height': ['height', 'high', 'h', 'h.'],
            'product_code': ['product_code', 'code', 'item_code', 'reference', 'ref', 'ref.', 'sku'],
            'water_absorption': ['water_absorption', 'absorption', 'water_abs', 'abs'],
            'slip_resistance': ['slip_resistance', 'slip', 'coefficient_of_friction', 'cof', 'dcof']
        }
        
        for standard, variations in mapping.items():
            if normalized in variations:
                return standard
        
        return normalized
    
    def _process_image_element(self, doc: MaterialDocument, element: Dict[str, Any], document_path: str):
        """Process an image element for visual features"""
        if not self.config['store_images']:
            return
        
        try:
            # Get image data
            image_data = element.get('image_data')
            
            # If no embedded image data, try to extract from document
            if not image_data and document_path:
                bbox = element.get('bbox')
                if bbox:
                    # Try to extract image region from document
                    page_num = element.get('page_num', 1)
                    image_data = self._extract_image_region(document_path, bbox, page_num)
            
            if image_data:
                # Classify image content
                classification = self.extractors['image'].classify(image_data)
                
                # Store with metadata
                image_id = f"img_{len(doc.images) + 1}"
                doc.images[image_id] = {
                    'classification': classification,
                    'confidence': classification.get('confidence', 0.0),
                    'bbox': element.get('bbox'),
                    'data': image_data if self.config['store_images'] else None
                }
        except Exception as e:
            logger.error(f"Error processing image element: {e}")
    
    def _extract_image_region(self, document_path: str, bbox: Tuple[int, int, int, int], page_num: int = 1) -> Optional[bytes]:
        """Extract image region from document"""
        # This is a placeholder for actual image extraction logic
        # It would use a PDF library for PDFs or image processing for images
        
        try:
            # For image documents, read and crop
            if document_path.lower().endswith(('.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp')):
                img = cv2.imread(document_path)
                if img is not None:
                    x1, y1, x2, y2 = bbox
                    cropped = img[y1:y2, x1:x2]
                    if cropped.size > 0:
                        # Convert to bytes
                        _, buffer = cv2.imencode('.png', cropped)
                        return buffer.tobytes()
            
            # For PDFs, would use a library like PyMuPDF or pdf2image
            # This is just a placeholder
            return None
            
        except Exception as e:
            logger.error(f"Error extracting image region: {e}")
            return None
    
    def _process_form_element(self, doc: MaterialDocument, element: Dict[str, Any], bbox: Tuple[int, int, int, int]):
        """Process a form field element"""
        field_type = element.get('attributes', {}).get('field_type', 'text')
        field_text = element.get('text', '')
        
        if not field_text:
            return
        
        # Identify field name and value from form field
        if field_type == 'checkbox':
            # For checkboxes, determine if checked
            field_name = self._normalize_field_name(field_text)
            field_value = element.get('attributes', {}).get('checked', False)
            
            field = MaterialField(
                name=field_name,
                value=field_value,
                confidence=0.9,  # High confidence for form fields
                source_region=bbox
            )
            
            doc.fields[field_name] = field
            
        elif field_type in ['text', 'field']:
            # Try to extract property-value pairs
            self._process_text_element(doc, field_text, bbox)
    
    def _process_material_region(self, doc: MaterialDocument, element: Dict[str, Any], element_type: str):
        """Process a specialized material region"""
        # Extract region type from element_type (e.g., material_specs -> specs)
        region_type = element_type.replace('material_', '')
        
        # Get region text
        region_text = element.get('text', '')
        
        # Process based on region type
        if region_type == 'specs':
            # This is a specifications region, likely containing key technical details
            self._process_text_element(doc, region_text, element.get('bbox'))
            
        elif region_type == 'dimensions':
            # This is a dimensions region
            dimensions = self.extractors['dimension'].extract(region_text)
            
            for dim_name, dim_value in dimensions.items():
                field = MaterialField(
                    name=dim_name,
                    value=dim_value['value'],
                    confidence=dim_value['confidence'] * 1.2,  # Boost confidence for specialized region
                    source_region=element.get('bbox'),
                    normalized_value=dim_value.get('normalized_value')
                )
                
                # Override existing field only if confidence is higher
                if dim_name in doc.fields and doc.fields[dim_name].confidence > field.confidence:
                    continue
                    
                doc.fields[dim_name] = field
                
        elif region_type == 'codes':
            # This is a product codes region
            codes = self.extractors['code'].extract(region_text)
            
            for code_name, code_value in codes.items():
                field = MaterialField(
                    name=code_name,
                    value=code_value['value'],
                    confidence=code_value['confidence'] * 1.2,  # Boost confidence
                    source_region=element.get('bbox'),
                    normalized_value=code_value.get('normalized_value')
                )
                
                # Override existing field only if confidence is higher
                if code_name in doc.fields and doc.fields[code_name].confidence > field.confidence:
                    continue
                    
                doc.fields[code_name] = field
                
        elif region_type == 'technical_properties':
            # This is a technical properties region
            properties = self.extractors['property'].extract(region_text, doc.material_type)
            
            for prop_name, prop_value in properties.items():
                field = MaterialField(
                    name=prop_name,
                    value=prop_value['value'],
                    confidence=prop_value['confidence'] * 1.2,  # Boost confidence
                    source_region=element.get('bbox'),
                    normalized_value=prop_value.get('normalized_value'),
                    metadata=prop_value.get('metadata', {})
                )
                
                # Override existing field only if confidence is higher
                if prop_name in doc.fields and doc.fields[prop_name].confidence > field.confidence:
                    continue
                    
                doc.fields[prop_name] = field
                
        elif region_type == 'title':
            # Extract product name from title
            field = MaterialField(
                name='product_name',
                value=region_text.strip(),
                confidence=0.9,
                source_region=element.get('bbox')
            )
            
            doc.fields['product_name'] = field
    
    def _validate_extracted_fields(self, doc: MaterialDocument):
        """Validate extracted fields against domain rules"""
        for field_name, field in doc.fields.items():
            # Skip already validated fields
            if field.validation_status != 'unvalidated':
                continue
            
            # Find applicable validation rules
            rules = self._find_validation_rules(field_name)
            
            if not rules:
                field.validation_status = 'no_rules'
                continue
            
            # Apply each rule
            for rule in rules:
                validation_result = self._apply_validation_rule(field, rule)
                
                # Update field with validation result
                field.validation_status = validation_result['status']
                field.validation_message = validation_result['message']
                
                # Stop on first failure
                if field.validation_status == 'invalid':
                    break
    
    def _find_validation_rules(self, field_name: str) -> List[Dict[str, Any]]:
        """Find validation rules applicable to a field"""
        rules = []
        
        # Check each rule category
        for category, category_rules in self.validation_rules.items():
            if 'rules' in category_rules:
                for rule in category_rules['rules']:
                    if rule.get('field') == field_name:
                        rules.append(rule)
        
        return rules
    
    def _apply_validation_rule(self, field: MaterialField, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Apply a validation rule to a field value"""
        rule_type = rule.get('type')
        
        # Get normalized value if available, otherwise use raw value
        value = field.normalized_value if field.normalized_value is not None else field.value
        
        # Handle different rule types
        if rule_type == 'range':
            return self._validate_range(value, rule)
        elif rule_type == 'enum':
            return self._validate_enum(value, rule)
        elif rule_type == 'pattern':
            return self._validate_pattern(value, rule)
        else:
            return {'status': 'warning', 'message': f"Unknown validation rule type: {rule_type}"}
    
    def _validate_range(self, value: Any, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Validate a value is within a specified range"""
        try:
            # Extract numeric value
            if isinstance(value, str):
                # Try to parse numeric part
                numeric_str = re.search(r'[\d\.]+', value)
                if numeric_str:
                    numeric_value = float(numeric_str.group(0))
                else:
                    return {'status': 'invalid', 'message': f"Cannot extract numeric value from '{value}'"}
            elif isinstance(value, (int, float)):
                numeric_value = float(value)
            else:
                return {'status': 'invalid', 'message': f"Value '{value}' is not numeric"}
            
            # Check range
            min_value = rule.get('min')
            max_value = rule.get('max')
            
            if min_value is not None and numeric_value < min_value:
                return {
                    'status': 'invalid', 
                    'message': f"Value {numeric_value} is below minimum {min_value} {rule.get('unit', '')}"
                }
            
            if max_value is not None and numeric_value > max_value:
                return {
                    'status': 'invalid', 
                    'message': f"Value {numeric_value} is above maximum {max_value} {rule.get('unit', '')}"
                }
            
            return {'status': 'valid', 'message': ''}
            
        except Exception as e:
            return {'status': 'invalid', 'message': f"Validation error: {str(e)}"}
    
    def _validate_enum(self, value: Any, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Validate a value is in a set of allowed values"""
        allowed_values = rule.get('values', [])
        
        if not allowed_values:
            return {'status': 'warning', 'message': 'No allowed values specified in rule'}
        
        # Normalize for comparison
        normalized_value = str(value).strip().upper()
        normalized_allowed = [str(v).strip().upper() for v in allowed_values]
        
        if normalized_value in normalized_allowed:
            return {'status': 'valid', 'message': ''}
        else:
            return {
                'status': 'invalid',
                'message': f"Value '{value}' not in allowed values: {', '.join(allowed_values)}"
            }
    
    def _validate_pattern(self, value: Any, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Validate a value matches a regular expression pattern"""
        pattern = rule.get('pattern')
        
        if not pattern:
            return {'status': 'warning', 'message': 'No pattern specified in rule'}
        
        value_str = str(value)
        
        if re.match(pattern, value_str):
            return {'status': 'valid', 'message': ''}
        else:
            return {
                'status': 'invalid',
                'message': f"Value '{value}' does not match pattern '{pattern}'"
            }
    
    def _calculate_confidence(self, doc: MaterialDocument) -> float:
        """Calculate overall confidence score for the document"""
        if not doc.fields:
            return 0.0
        
        # Calculate weighted average confidence
        total_confidence = 0.0
        total_weight = 0.0
        
        for field_name, field in doc.fields.items():
            # Determine field weight based on importance
            weight = 1.0
            
            # Key fields have higher weight
            if field_name in ['product_code', 'product_name', 'material_type']:
                weight = 2.0
            elif field_name in ['width', 'length', 'thickness']:
                weight = 1.5
            
            # Adjust weight based on validation status
            if field.validation_status == 'valid':
                weight *= 1.2
            elif field.validation_status == 'invalid':
                weight *= 0.5
            
            total_confidence += field.confidence * weight
            total_weight += weight
        
        # Return normalized confidence
        if total_weight > 0:
            return min(1.0, total_confidence / total_weight)
        else:
            return 0.0
    
    def export_document(self, doc: MaterialDocument, output_format: str = None) -> Any:
        """
        Export the processed document in the specified format
        
        Args:
            doc: MaterialDocument to export
            output_format: Output format ('json', 'dict', 'xml', etc.)
            
        Returns:
            Exported document in specified format
        """
        format_type = output_format or self.config['output_format']
        
        if format_type == 'json':
            return self._export_to_json(doc)
        elif format_type == 'dict':
            return self._export_to_dict(doc)
        elif format_type == 'xml':
            return self._export_to_xml(doc)
        else:
            logger.warning(f"Unsupported export format: {format_type}, using dict")
            return self._export_to_dict(doc)
    
    def _export_to_dict(self, doc: MaterialDocument) -> Dict[str, Any]:
        """Export document to dictionary"""
        # Convert fields to dictionary
        fields_dict = {}
        for field_name, field in doc.fields.items():
            # Use normalized value if available
            value = field.normalized_value if field.normalized_value is not None else field.value
            
            fields_dict[field_name] = {
                'value': value,
                'confidence': field.confidence,
                'validation': {
                    'status': field.validation_status,
                    'message': field.validation_message
                }
            }
            
            # Add metadata if present
            if field.metadata:
                fields_dict[field_name]['metadata'] = field.metadata
        
        # Convert images to dictionary
        images_dict = {}
        for image_id, image in doc.images.items():
            # Don't include binary data in export unless explicitly requested
            image_export = {
                'classification': image['classification'],
                'confidence': image['confidence'],
                'bbox': image['bbox']
            }
            
            # Include data only if configured and available
            if self.config['store_images'] and image.get('data'):
                # In a real implementation, this would likely be a base64 encoded string
                # For now, just indicate data is available
                image_export['has_data'] = True
            
            images_dict[image_id] = image_export
        
        # Build main export dictionary
        export_dict = {
            'document_id': doc.document_id,
            'material_type': doc.material_type,
            'confidence_score': doc.confidence_score,
            'fields': fields_dict,
            'related_materials': doc.related_materials,
            'images': images_dict,
            'metadata': doc.processing_metadata
        }
        
        return export_dict
    
    def _export_to_json(self, doc: MaterialDocument) -> str:
        """Export document to JSON string"""
        export_dict = self._export_to_dict(doc)
        return json.dumps(export_dict, indent=2)
    
    def _export_to_xml(self, doc: MaterialDocument) -> str:
        """Export document to XML string"""
        # This is a simplified XML export
        export_dict = self._export_to_dict(doc)
        
        # Convert dictionary to XML
        xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>']
        xml_parts.append(f'<MaterialDocument id="{doc.document_id}">')
        
        # Add material type
        xml_parts.append(f'  <MaterialType confidence="{doc.confidence_score:.2f}">{doc.material_type or ""}</MaterialType>')
        
        # Add fields
        xml_parts.append('  <Fields>')
        for field_name, field_data in export_dict['fields'].items():
            value = field_data['value'] or ""
            confidence = field_data['confidence']
            validation_status = field_data['validation']['status']
            
            xml_parts.append(f'    <Field name="{field_name}" confidence="{confidence:.2f}" validation="{validation_status}">{value}</Field>')
        xml_parts.append('  </Fields>')
        
        # Add related materials
        if export_dict['related_materials']:
            xml_parts.append('  <RelatedMaterials>')
            for related in export_dict['related_materials']:
                xml_parts.append(f'    <RelatedMaterial>{related}</RelatedMaterial>')
            xml_parts.append('  </RelatedMaterials>')
        
        # Add images
        if export_dict['images']:
            xml_parts.append('  <Images>')
            for image_id, image_data in export_dict['images'].items():
                xml_parts.append(f'    <Image id="{image_id}" confidence="{image_data["confidence"]:.2f}">')
                xml_parts.append(f'      <Classification>{image_data["classification"].get("type", "")}</Classification>')
                xml_parts.append('    </Image>')
            xml_parts.append('  </Images>')
        
        # Close document tag
        xml_parts.append('</MaterialDocument>')
        
        return '\n'.join(xml_parts)
    
    def batch_process(self, documents: List[Tuple[str, Dict[str, Any]]]) -> List[MaterialDocument]:
        """
        Process a batch of documents with their OCR results
        
        Args:
            documents: List of (document_path, ocr_result) tuples
            
        Returns:
            List of processed MaterialDocument objects
        """
        results = []
        
        for doc_path, ocr_result in documents:
            try:
                result = self.process_document(doc_path, ocr_result)
                results.append(result)
            except Exception as e:
                logger.error(f"Error processing document {doc_path}: {e}")
                # Create error document
                error_doc = MaterialDocument(document_id=os.path.basename(doc_path))
                error_doc.processing_metadata = {
                    'error': str(e),
                    'status': 'error',
                    'processor_version': '1.0',
                    'processing_time': datetime.now().isoformat()
                }
                results.append(error_doc)
        
        return results


class DimensionExtractor:
    """Extracts dimensional information from text"""
    
    def __init__(self, model_type: str = 'default', vocabulary: Dict[str, Any] = None, enable_unit_conversion: bool = True):
        """
        Initialize the dimension extractor
        
        Args:
            model_type: Type of extraction model to use
            vocabulary: Unit vocabulary for normalization
            enable_unit_conversion: Whether to enable unit conversion
        """
        self.model_type = model_type
        self.vocabulary = vocabulary or {}
        self.enable_unit_conversion = enable_unit_conversion
        
        # Regular expressions for dimension patterns
        self.patterns = {
            # Width x Length
            'dimension': [
                # 300x600 mm or 300 x 600 mm
                r'(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft|inch)?',
                
                # Length: 300 mm, Width: 600 mm
                r'(?:length|long|l)[:\s]+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft|inch)?',
                r'(?:width|wide|w)[:\s]+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft|inch)?',
                
                # 300mm x 600mm
                r'(\d+(?:\.\d+)?)(mm|cm|m|in|ft|inch)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft|inch)?',
                
                # General dimensions with units
                r'(\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft|inch)'
            ],
            
            # Thickness
            'thickness': [
                r'(?:thickness|thick|t)[:\s]+(\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft|inch)?',
                r'thickness[:\s]+(\d+(?:\.\d+)?)'
            ]
        }
    
    def extract(self, text: str) -> Dict[str, Dict[str, Any]]:
        """
        Extract dimensional information from text
        
        Args:
            text: Text to extract from
            
        Returns:
            Dictionary of dimension names mapped to values and metadata
        """
        results = {}
        
        # Look for width x length patterns
        dimension_matches = []
        for pattern in self.patterns['dimension']:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            dimension_matches.extend(matches)
        
        # Process dimension matches
        for match in dimension_matches:
            match_groups = match.groups()
            
            # Check for WxL pattern
            if 'x' in match.group(0).lower() or '×' in match.group(0):
                # This is a width x length pattern
                width_value = None
                length_value = None
                width_unit = None
                length_unit = None
                
                if len(match_groups) >= 2:
                    # Extract width and length values
                    width_value = float(match_groups[0])
                    length_value = float(match_groups[1])
                    
                    # Extract units if present
                    if len(match_groups) >= 3 and match_groups[2]:
                        width_unit = match_groups[2].lower()
                        length_unit = match_groups[2].lower()
                    
                    # Check for separate units
                    if len(match_groups) >= 4 and match_groups[3]:
                        length_unit = match_groups[3].lower()
                
                # Add width result
                if width_value is not None:
                    width_result = self._create_dimension_result(
                        'width', width_value, width_unit, match
                    )
                    results['width'] = width_result
                
                # Add length result
                if length_value is not None:
                    length_result = self._create_dimension_result(
                        'length', length_value, length_unit, match
                    )
                    results['length'] = length_result
                
            else:
                # This is a single dimension
                if 'width' in match.group(0).lower() or 'wide' in match.group(0).lower() or 'w:' in match.group(0).lower():
                    # This is a width specification
                    if len(match_groups) >= 1:
                        value = float(match_groups[0])
                        unit = match_groups[1].lower() if len(match_groups) >= 2 and match_groups[1] else None
                        
                        width_result = self._create_dimension_result(
                            'width', value, unit, match
                        )
                        results['width'] = width_result
                        
                elif 'length' in match.group(0).lower() or 'long' in match.group(0).lower() or 'l:' in match.group(0).lower():
                    # This is a length specification
                    if len(match_groups) >= 1:
                        value = float(match_groups[0])
                        unit = match_groups[1].lower() if len(match_groups) >= 2 and match_groups[1] else None
                        
                        length_result = self._create_dimension_result(
                            'length', value, unit, match
                        )
                        results['length'] = length_result
                        
                elif 'height' in match.group(0).lower() or 'high' in match.group(0).lower() or 'h:' in match.group(0).lower():
                    # This is a height specification
                    if len(match_groups) >= 1:
                        value = float(match_groups[0])
                        unit = match_groups[1].lower() if len(match_groups) >= 2 and match_groups[1] else None
                        
                        height_result = self._create_dimension_result(
                            'height', value, unit, match
                        )
                        results['height'] = height_result
        
        # Look for thickness patterns
        for pattern in self.patterns['thickness']:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            
            for match in matches:
                match_groups = match.groups()
                
                if len(match_groups) >= 1:
                    value = float(match_groups[0])
                    unit = match_groups[1].lower() if len(match_groups) >= 2 and match_groups[1] else None
                    
                    thickness_result = self._create_dimension_result(
                        'thickness', value, unit, match
                    )
                    results['thickness'] = thickness_result
        
        return results
    
    def extract_single(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Extract a single dimension value from text
        
        Args:
            text: Text to extract from
            
        Returns:
            Dimension extraction result or None
        """
        # Look for numeric value with optional unit
        match = re.search(r'(\d+(?:\.\d+)?)\s*(mm|cm|m|in|ft|inch)?', text, re.IGNORECASE)
        
        if match:
            value = float(match.group(1))
            unit = match.group(2).lower() if match.group(2) else None
            
            # Generic dimension result
            return self._create_dimension_result('dimension', value, unit, match)
        
        return None
    
    def _create_dimension_result(self, dim_name: str, value: float, unit: Optional[str], match) -> Dict[str, Any]:
        """
        Create a standardized dimension result
        
        Args:
            dim_name: Dimension name (width, length, etc.)
            value: Numeric value
            unit: Unit of measurement
            match: Regex match object
            
        Returns:
            Dimension result dictionary
        """
        # Default to millimeters if no unit specified
        unit = unit or 'mm'
        
        # Normalize unit (handle aliases)
        normalized_unit = self._normalize_unit(unit)
        
        # Convert to base unit (mm) if enabled
        normalized_value = value
        if self.enable_unit_conversion and normalized_unit in self.vocabulary:
            base_factor = self.vocabulary[normalized_unit].get('base', 1.0)
            normalized_value = value * base_factor
        
        return {
            'value': f"{value} {unit}",
            'numeric_value': value,
            'unit': unit,
            'normalized_unit': normalized_unit,
            'normalized_value': normalized_value,
            'confidence': 0.85,  # Base confidence for dimension extraction
            'metadata': {
                'match_text': match.group(0),
                'position': match.span()
            }
        }
    
    def _normalize_unit(self, unit: str) -> str:
        """
        Normalize unit to standard form
        
        Args:
            unit: Unit string
            
        Returns:
            Normalized unit string
        """
        unit_lower = unit.lower()
        
        # Check each unit in vocabulary for matches
        for norm_unit, unit_info in self.vocabulary.items():
            if unit_lower == norm_unit:
                return norm_unit
            
            aliases = unit_info.get('aliases', [])
            if unit_lower in aliases:
                return norm_unit
        
        # If no match found, return as is
        return unit_lower


class CodeExtractor:
    """Extracts product codes and identifiers from text"""
    
    def __init__(self, model_type: str = 'default', enable_normalization: bool = True):
        """
        Initialize the code extractor
        
        Args:
            model_type: Type of extraction model to use
            enable_normalization: Whether to enable code normalization
        """
        self.model_type = model_type
        self.enable_normalization = enable_normalization
        
        # Regular expressions for code patterns
        self.patterns = {
            'product_code': [
                # Product code: ABC123
                r'(?:product\s*code|item\s*code|code|ref)[:\s]+([A-Z0-9\-]{3,15})',
                
                # Code ABC123
                r'code[:\s]*([A-Z0-9\-]{3,15})',
                
                # Reference: ABC123
                r'reference[:\s]+([A-Z0-9\-]{3,15})',
                
                # Standalone codes (more prone to false positives)
                r'(?<!\w)([A-Z]{2,4}[0-9]{3,6})(?!\w)'
            ],
            
            'sku': [
                # SKU: 12345
                r'(?:sku|item\s*number|product\s*number)[:\s]+([A-Z0-9]{5,10})',
                
                # #12345
                r'#\s*([A-Z0-9]{5,10})(?!\w)'
            ],
            
            'upc': [
                # UPC: 123456789012
                r'(?:upc|gtin|ean)[:\s]+(\d{12,14})',
                
                # Standalone UPC
                r'(?<!\d)(\d{12,14})(?!\d)'
            ]
        }
    
    def extract(self, text: str) -> Dict[str, Dict[str, Any]]:
        """
        Extract code information from text
        
        Args:
            text: Text to extract from
            
        Returns:
            Dictionary of code types mapped to values and metadata
        """
        results = {}
        
        # Process each code type
        for code_type, patterns in self.patterns.items():
            for pattern in patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                
                for match in matches:
                    # Only take the first match for each code type
                    if code_type not in results:
                        code_value = match.group(1)
                        
                        # Create code result
                        code_result = self._create_code_result(
                            code_type, code_value, match
                        )
                        
                        results[code_type] = code_result
        
        return results
    
    def _create_code_result(self, code_type: str, value: str, match) -> Dict[str, Any]:
        """
        Create a standardized code result
        
        Args:
            code_type: Type of code (product_code, sku, etc.)
            value: Code value
            match: Regex match object
            
        Returns:
            Code result dictionary
        """
        # Normalize code if enabled
        normalized_value = self._normalize_code(code_type, value) if self.enable_normalization else value
        
        # Set confidence based on match context
        confidence = 0.8  # Base confidence
        
        # Adjust confidence based on context
        match_text = match.group(0).lower()
        
        # Higher confidence if it has a clear label
        if 'code' in match_text or 'sku' in match_text or 'reference' in match_text:
            confidence = 0.9
        
        # Lower confidence for standalone patterns (more prone to false positives)
        if len(match_text) == len(value) + 1 and '#' in match_text:  # Just a hash and the code
            confidence = 0.7
        
        if len(match_text) == len(value):  # The match is just the code itself
            confidence = 0.6
        
        return {
            'value': value,
            'normalized_value': normalized_value,
            'confidence': confidence,
            'metadata': {
                'match_text': match.group(0),
                'position': match.span()
            }
        }
    
    def _normalize_code(self, code_type: str, value: str) -> str:
        """
        Normalize code to standard format
        
        Args:
            code_type: Type of code
            value: Code value
            
        Returns:
            Normalized code value
        """
        if code_type == 'product_code':
            # Remove spaces, convert to uppercase
            normalized = value.replace(' ', '').upper()
            return normalized
            
        elif code_type == 'sku':
            # Remove spaces, convert to uppercase
            normalized = value.replace(' ', '').upper()
            return normalized
            
        elif code_type == 'upc':
            # Remove spaces and dashes, ensure 12-14 digits
            normalized = re.sub(r'[^0-9]', '', value)
            
            # Pad with leading zeros if needed for consistency
            if len(normalized) < 14:
                normalized = normalized.zfill(14)
                
            return normalized
        
        # Default: return as is
        return value


class PropertyExtractor:
    """Extracts material properties from text"""
    
    def __init__(self, model_type: str = 'default', technical_terms: Dict[str, Any] = None):
        """
        Initialize the property extractor
        
        Args:
            model_type: Type of extraction model to use
            technical_terms: Dictionary of technical terms by material type
        """
        self.model_type = model_type
        self.technical_terms = technical_terms or {}
        
        # Regular expressions for property patterns
        self.patterns = {
            # Generic property patterns
            'generic': [
                # Property: Value
                r'([\w\s\-]+)[:\s]+([^:]+?)(?=\s*(?:[\w\s\-]+:|$))',
                
                # Value: Property (reversed)
                r'([^:]+?):\s*([\w\s\-]+?)(?=\s*(?:[^:]+?:|$))'
            ],
            
            # Material-specific patterns
            'tile': {
                'pei_rating': [
                    r'(?:pei|abrasion)[:\s]+([\dIVXivx]{1,3})',
                    r'pei\s*(?:rating|class|grade)[:\s]+([\dIVXivx]{1,3})'
                ],
                'water_absorption': [
                    r'(?:water\s*absorption|absorption)[:\s]+([\d\.]+)\s*\%',
                    r'absorption\s*(?:rate|value)[:\s]+([\d\.]+)'
                ],
                'slip_resistance': [
                    r'(?:slip\s*resistance|coefficient\s*of\s*friction|cof|dcof)[:\s]+([A-Za-z0-9\+]+)',
                    r'r-rating[:\s]+([Rr]\d{1,2})',
                    r'(?<!\w)([Rr]\d{1,2})(?!\w)'
                ]
            },
            'stone': {
                'mohs_hardness': [
                    r'(?:mohs|hardness)[:\s]+([\d\.]+)'
                ],
                'density': [
                    r'density[:\s]+([\d\.]+)\s*(?:kg\/m3|g\/cm3)?'
                ]
            },
            'wood': {
                'janka_hardness': [
                    r'(?:janka|hardness)[:\s]+([\d\.]+)'
                ],
                'finish': [
                    r'finish[:\s]+([a-zA-Z\s]+)'
                ]
            }
        }
    
    def extract(self, text: str, material_type: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """
        Extract property information from text
        
        Args:
            text: Text to extract from
            material_type: Type of material, if known
            
        Returns:
            Dictionary of property names mapped to values and metadata
        """
        results = {}
        
        # Check material-specific patterns first
        if material_type and material_type in self.patterns:
            material_patterns = self.patterns[material_type]
            
            for property_name, patterns in material_patterns.items():
                for pattern in patterns:
                    matches = re.finditer(pattern, text, re.IGNORECASE)
                    
                    for match in matches:
                        if property_name not in results:
                            property_value = match.group(1)
                            
                            # Create property result
                            prop_result = self._create_property_result(
                                property_name, property_value, match, material_type
                            )
                            
                            results[property_name] = prop_result
        
        # Generic property extraction
        for pattern in self.patterns['generic']:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            
            for match in matches:
                property_name = match.group(1).strip().lower().replace(' ', '_')
                property_value = match.group(2).strip()
                
                # Skip if already found through specific patterns
                if property_name in results:
                    continue
                
                # Skip common stopwords or invalid property names
                if self._is_invalid_property(property_name):
                    continue
                
                # Create property result
                prop_result = self._create_property_result(
                    property_name, property_value, match, material_type
                )
                
                results[property_name] = prop_result
        
        return results
    
    def _create_property_result(self, property_name: str, value: str, match, material_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a standardized property result
        
        Args:
            property_name: Property name
            value: Property value
            match: Regex match object
            material_type: Type of material
            
        Returns:
            Property result dictionary
        """
        # Try to normalize the value based on property type
        normalized_value = self._normalize_property_value(property_name, value)
        
        # Set confidence based on match context
        confidence = 0.75  # Base confidence
        
        # Adjust confidence based on context
        if property_name in ['pei_rating', 'water_absorption', 'slip_resistance', 'mohs_hardness']:
            confidence = 0.85  # Higher confidence for known technical properties
        
        # Additional metadata
        metadata = {
            'match_text': match.group(0),
            'position': match.span()
        }
        
        # Add technical definition if available
        if material_type and material_type in self.technical_terms:
            tech_terms = self.technical_terms[material_type]
            if property_name in tech_terms:
                metadata['definition'] = tech_terms[property_name]
        
        return {
            'value': value,
            'normalized_value': normalized_value,
            'confidence': confidence,
            'metadata': metadata
        }
    
    def _normalize_property_value(self, property_name: str, value: str) -> Any:
        """
        Normalize property value based on property type
        
        Args:
            property_name: Property name
            value: Raw property value
            
        Returns:
            Normalized property value
        """
        value = value.strip()
        
        if property_name == 'pei_rating':
            # Convert roman numerals to integers if needed
            if value.upper() in ['I', 'II', 'III', 'IV', 'V']:
                roman_map = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5}
                return roman_map[value.upper()]
            
            # Try to convert to integer
            try:
                return int(value)
            except (ValueError, TypeError):
                return value
            
        elif property_name == 'water_absorption':
            # Extract numeric value and convert to float
            match = re.search(r'([\d\.]+)', value)
            if match:
                try:
                    return float(match.group(1))
                except (ValueError, TypeError):
                    pass
            
            return value
            
        elif property_name == 'slip_resistance':
            # Normalize R-rating
            r_match = re.search(r'([Rr]\d{1,2})', value)
            if r_match:
                return r_match.group(1).upper()
            
            return value
            
        elif property_name in ['mohs_hardness', 'janka_hardness', 'density']:
            # Extract numeric value and convert to float
            match = re.search(r'([\d\.]+)', value)
            if match:
                try:
                    return float(match.group(1))
                except (ValueError, TypeError):
                    pass
            
            return value
        
        # Default: return as is
        return value
    
    def _is_invalid_property(self, property_name: str) -> bool:
        """
        Check if a property name is invalid or a common stopword
        
        Args:
            property_name: Property name to check
            
        Returns:
            True if invalid, False otherwise
        """
        # Check for very short property names
        if len(property_name) <= 2:
            return True
        
        # Common stopwords and invalid property names
        stopwords = [
            'the', 'and', 'for', 'with', 'this', 'that', 'from', 'not', 'what',
            'page', 'section', 'note', 'please', 'contact', 'www', 'http', 'see',
            'email', 'phone', 'fax', 'description', 'product', 'material'
        ]
        
        return property_name in stopwords


class MaterialTypeClassifier:
    """Classifies the type of material in a document"""
    
    def __init__(self, vocabulary: Dict[str, List[str]] = None):
        """
        Initialize the material type classifier
        
        Args:
            vocabulary: Material type vocabulary
        """
        self.vocabulary = vocabulary or {}
    
    def extract(self, ocr_result: Dict[str, Any], text: Optional[str] = None) -> Optional[str]:
        """
        Extract material type from OCR result
        
        Args:
            ocr_result: OCR result dictionary
            text: Pre-extracted text (optional)
            
        Returns:
            Material type or None if not detected
        """
        # Use provided text or extract from OCR result
        content = text or self._extract_raw_text(ocr_result)
        
        # Count keyword occurrences for each material type
        type_scores = {}
        for material_type, keywords in self.vocabulary.items():
            score = 0
            for keyword in keywords:
                # Case-insensitive pattern matching
                pattern = r'\b' + re.escape(keyword) + r'\b'
                matches = re.findall(pattern, content, re.IGNORECASE)
                score += len(matches)
            
            type_scores[material_type] = score
        
        # Find type with highest score
        max_score = 0
        max_type = None
        
        for material_type, score in type_scores.items():
            if score > max_score:
                max_score = score
                max_type = material_type
        
        # Only return if score is above threshold
        if max_score >= 2:
            return max_type
        
        # Try to find explicit material type declarations
        material_matches = re.search(r'material[:\s]+([a-zA-Z]+)', content, re.IGNORECASE)
        if material_matches:
            material_name = material_matches.group(1).lower()
            
            # Check if this matches a known material type
            for material_type, keywords in self.vocabulary.items():
                if material_name in keywords or material_name == material_type:
                    return material_type
        
        return None
    
    def _extract_raw_text(self, ocr_result: Dict[str, Any]) -> str:
        """Extract concatenated raw text from OCR result"""
        raw_text = ""
        
        # Check for pages in OCR result (PDF case)
        if 'pages' in ocr_result:
            for page in ocr_result['pages']:
                if 'text' in page:
                    raw_text += page['text'] + "\n\n"
                elif 'elements' in page:
                    # Concatenate text from elements
                    for element in page['elements']:
                        if 'text' in element:
                            raw_text += element['text'] + "\n"
        
        # Check for direct elements
        elif 'elements' in ocr_result:
            for element in ocr_result['elements']:
                if 'text' in element:
                    raw_text += element['text'] + "\n"
        
        # If there's a direct 'text' field, use it
        elif 'text' in ocr_result:
            raw_text = ocr_result['text']
        
        return raw_text


class RelationExtractor:
    """Extracts relationships between materials"""
    
    def __init__(self, enable_cross_reference: bool = True):
        """
        Initialize the relation extractor
        
        Args:
            enable_cross_reference: Whether to enable cross-referencing
        """
        self.enable_cross_reference = enable_cross_reference
        
        # Patterns for related material references
        self.patterns = [
            # "Also available in: CODE1, CODE2"
            r'also\s+available\s+in:?\s+([A-Z0-9\-\s,]+)',
            
            # "Matching materials: CODE1, CODE2"
            r'matching\s+materials:?\s+([A-Z0-9\-\s,]+)',
            
            # "Related products: CODE1, CODE2"
            r'related\s+products:?\s+([A-Z0-9\-\s,]+)',
            
            # "Part of collection: NAME"
            r'(?:part\s+of|from)\s+(?:the)?\s*collection:?\s+([A-Z][a-zA-Z0-9\-\s]+)'
        ]
    
    def extract(self, text: str, fields: Dict[str, MaterialField]) -> List[str]:
        """
        Extract related materials from text
        
        Args:
            text: Text to extract from
            fields: Dictionary of extracted fields
            
        Returns:
            List of related material identifiers
        """
        if not self.enable_cross_reference:
            return []
        
        related_materials = set()
        
        # Extract relationships using patterns
        for pattern in self.patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            
            for match in matches:
                related_text = match.group(1)
                
                # Split by commas if present
                if ',' in related_text:
                    items = [item.strip() for item in related_text.split(',')]
                else:
                    items = [related_text.strip()]
                
                # Add to related materials
                for item in items:
                    # Skip if empty
                    if not item:
                        continue
                    
                    # Skip if same as this material's product code
                    if 'product_code' in fields and fields['product_code'].value == item:
                        continue
                    
                    related_materials.add(item)
        
        return list(related_materials)


class MaterialImageClassifier:
    """Classifies material images and extracts visual features"""
    
    def __init__(self):
        """Initialize the image classifier"""
        # This would normally initialize a CV model
        pass
    
    def classify(self, image_data: bytes) -> Dict[str, Any]:
        """
        Classify material image
        
        Args:
            image_data: Image data as bytes
            
        Returns:
            Classification result
        """
        # This is a placeholder for actual image classification
        # In a real implementation, this would use computer vision models
        
        result = {
            'type': 'material_sample',
            'confidence': 0.8,
            'attributes': {
                'color': 'not_analyzed',
                'texture': 'not_analyzed'
            }
        }
        
        return result


def main():
    """Main entry point for command-line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Material-Specific Document Processor")
    parser.add_argument('document_path', help='Path to the document to process')
    parser.add_argument('--ocr', help='Path to JSON file with OCR results')
    parser.add_argument('--output', '-o', help='Path to save the output')
    parser.add_argument('--format', choices=['json', 'xml', 'dict'], default='json',
                       help='Output format')
    
    args = parser.parse_args()
    
    # Load OCR results if provided
    ocr_result = None
    if args.ocr and os.path.exists(args.ocr):
        try:
            with open(args.ocr, 'r', encoding='utf-8') as f:
                ocr_result = json.load(f)
        except Exception as e:
            print(f"Error loading OCR results: {e}")
            return
    
    # Initialize processor
    processor = MaterialSpecificProcessor()
    
    # Process document
    result = processor.process_document(args.document_path, ocr_result)
    
    # Export result
    output = processor.export_document(result, args.format)
    
    # Save or print result
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output if isinstance(output, str) else json.dumps(output, indent=2))
        print(f"Results saved to {args.output}")
    else:
        if isinstance(output, str):
            print(output)
        else:
            print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()