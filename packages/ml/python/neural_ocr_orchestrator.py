#!/usr/bin/env python3
"""
Neural OCR Orchestrator

This module provides a document orchestration layer that integrates multiple advanced OCR and 
document understanding engines (Tesseract, thepipe, Nougat, and Marker) to process different 
types of document content optimally.

The orchestrator:
1. Analyzes document content and structure
2. Routes document segments to the most appropriate OCR engine
3. Consolidates results from multiple engines
4. Provides a unified API for document processing

Integration with existing OCR:
- Enhances the specialized_ocr.py capabilities
- Maintains compatibility with the existing OCR pipeline
- Provides seamless fallback to Tesseract when needed
"""

import os
import sys
import json
import logging
import tempfile
from typing import Dict, List, Any, Tuple, Optional, Union
from pathlib import Path
import time
import numpy as np
import cv2

# Import OCR engines (with fallback to Tesseract)
try:
    # Standard OCR (always available)
    from specialized_ocr import SpecializedOCR
    from layout_analysis import LayoutAnalyzer
    
    # Advanced neural OCR engines (may not be available)
    from nougat_engine import NougatEngine
    from marker_engine import MarkerEngine
    from thepipe_engine import ThePipeEngine
except ImportError as e:
    print(f"Warning: Some OCR engines could not be imported: {e}")
    print("Neural OCR orchestrator will use only available engines.")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RegionType:
    """Enum-like class for document region types"""
    TEXT = "text"
    TABLE = "table"
    TECHNICAL = "technical"
    FORMULA = "formula"
    FORM = "form"
    HEADING = "heading"
    DIAGRAM = "diagram"
    CODE = "code"
    HANDWRITING = "handwriting"


class EngineCapability:
    """Enum-like class for engine capabilities"""
    GENERAL_TEXT = "general_text"
    TABLES = "tables"
    TECHNICAL = "technical"
    FORMULAS = "formulas"
    FORMS = "forms"
    LAYOUTS = "layouts"
    SCIENTIFIC = "scientific"
    DIAGRAMS = "diagrams"
    CODE_BLOCKS = "code_blocks"
    HANDWRITING = "handwriting"


class DocumentRegion:
    """Represents a region in a document"""
    
    def __init__(
        self,
        region_type: str,
        coordinates: Tuple[int, int, int, int],
        image_path: str = None,
        content: Dict[str, Any] = None,
        confidence: float = 0.0
    ):
        """
        Initialize a document region
        
        Args:
            region_type: Type of region
            coordinates: (x, y, width, height)
            image_path: Path to the region image
            content: Extracted content
            confidence: Confidence score (0-1)
        """
        self.region_type = region_type
        self.coordinates = coordinates
        self.image_path = image_path
        self.content = content or {}
        self.confidence = confidence
        
        # Track processing history
        self.processed_by = []
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert region to dictionary"""
        return {
            "region_type": self.region_type,
            "coordinates": {
                "x": self.coordinates[0],
                "y": self.coordinates[1],
                "width": self.coordinates[2],
                "height": self.coordinates[3]
            },
            "content": self.content,
            "confidence": self.confidence,
            "processed_by": self.processed_by
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DocumentRegion':
        """Create region from dictionary"""
        coords = data["coordinates"]
        coordinates = (coords["x"], coords["y"], coords["width"], coords["height"])
        
        region = cls(
            region_type=data["region_type"],
            coordinates=coordinates,
            image_path=data.get("image_path"),
            content=data.get("content", {}),
            confidence=data.get("confidence", 0.0)
        )
        
        region.processed_by = data.get("processed_by", [])
        return region


class NeuralOCROrchestrator:
    """
    Orchestrates multiple OCR engines to process document content
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the neural OCR orchestrator
        
        Args:
            config: Configuration dictionary
        """
        self.config = {
            # General configuration
            'available_engines': ['tesseract'],  # Will be updated with available engines
            'engine_priority': ['nougat', 'marker', 'thepipe', 'tesseract'],
            'confidence_threshold': 0.6,
            'enable_parallel_processing': True,
            'max_parallel_regions': 4,
            'result_aggregation': 'confidence_weighted',
            
            # Layout analysis configuration
            'layout_analysis_mode': 'advanced',
            'region_extraction_dpi': 300,
            
            # Content classification configuration
            'content_classification_mode': 'hybrid',
            'min_region_size': 100,  # Minimum region size in pixels
            
            # Engine-specific configuration
            'tesseract_config': {
                'languages': ['eng'],
                'psm': 'auto',
                'fallback_engine': True
            },
            'nougat_config': {
                'model_path': None,
                'batch_size': 1,
                'half_precision': True
            },
            'marker_config': {
                'model_path': None,
                'preserve_layout': True
            },
            'thepipe_config': {
                'pipeline_path': None,
                'extract_structured_data': True
            }
        }
        
        if config:
            # Update the configuration with provided values
            self._update_config_recursive(self.config, config)
        
        # Initialize engines
        self.engines = {}
        self._init_engines()
        
        # Initialize layout analyzer
        self.layout_analyzer = LayoutAnalyzer({
            'extract_tables': True,
            'visualization_enabled': False,
            'multi_column_detection': True,
            'table_detection_mode': self.config['layout_analysis_mode']
        })
        
        logger.info(f"Neural OCR Orchestrator initialized with engines: {', '.join(self.engines.keys())}")
    
    def _update_config_recursive(self, target: Dict, source: Dict):
        """Update configuration recursively"""
        for key, value in source.items():
            if key in target and isinstance(target[key], dict) and isinstance(value, dict):
                self._update_config_recursive(target[key], value)
            else:
                target[key] = value
    
    def _init_engines(self):
        """Initialize available OCR engines"""
        # Always initialize Tesseract-based engine
        self.engines['tesseract'] = SpecializedOCR(self.config['tesseract_config'])
        self.config['available_engines'] = ['tesseract']
        
        # Try to initialize Nougat engine
        try:
            if 'NougatEngine' in globals():
                nougat = NougatEngine(self.config['nougat_config'])
                self.engines['nougat'] = nougat
                self.config['available_engines'].append('nougat')
                logger.info("Nougat engine initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize Nougat engine: {e}")
        
        # Try to initialize Marker engine
        try:
            if 'MarkerEngine' in globals():
                marker = MarkerEngine(self.config['marker_config'])
                self.engines['marker'] = marker
                self.config['available_engines'].append('marker')
                logger.info("Marker engine initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize Marker engine: {e}")
        
        # Try to initialize thepipe engine
        try:
            if 'ThePipeEngine' in globals():
                thepipe = ThePipeEngine(self.config['thepipe_config'])
                self.engines['thepipe'] = thepipe
                self.config['available_engines'].append('thepipe')
                logger.info("thepipe engine initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize thepipe engine: {e}")
    
    def process_document(self, document_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process a document with the orchestrated OCR engines
        
        Args:
            document_path: Path to the document
            output_dir: Output directory for results
            
        Returns:
            Dictionary with processing results
        """
        start_time = time.time()
        
        if not os.path.exists(document_path):
            raise FileNotFoundError(f"Document not found: {document_path}")
        
        # Create output directory if specified
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        # Determine document type
        document_ext = os.path.splitext(document_path)[1].lower()
        is_pdf = document_ext == '.pdf'
        
        # Step 1: Analyze document layout
        logger.info(f"Analyzing document layout: {document_path}")
        layout_result = self.layout_analyzer.analyze_document(document_path)
        
        # Step 2: Extract and classify regions
        logger.info("Extracting and classifying document regions")
        regions = self._extract_regions(document_path, layout_result, output_dir)
        
        # Step 3: Process regions with appropriate engines
        logger.info(f"Processing {len(regions)} document regions")
        processed_regions = self._process_regions(regions, output_dir)
        
        # Step 4: Aggregate results
        logger.info("Aggregating results")
        aggregated_result = self._aggregate_results(processed_regions, document_path)
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Create final result
        result = {
            "document": {
                "path": document_path,
                "type": "pdf" if is_pdf else "image",
                "filename": os.path.basename(document_path)
            },
            "processing": {
                "time": processing_time,
                "engines_used": list(self.engines.keys()),
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            },
            "regions": [region.to_dict() for region in processed_regions],
            "result": aggregated_result
        }
        
        # Save result if output directory is specified
        if output_dir:
            result_path = os.path.join(output_dir, f"{Path(document_path).stem}_ocr_result.json")
            with open(result_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        
        return result
    
    def _extract_regions(
        self, 
        document_path: str, 
        layout_result: Dict[str, Any],
        output_dir: str = None
    ) -> List[DocumentRegion]:
        """
        Extract regions from document based on layout analysis
        
        Args:
            document_path: Path to the document
            layout_result: Layout analysis result
            output_dir: Output directory for extracted regions
            
        Returns:
            List of document regions
        """
        regions = []
        
        # Create temporary directory for region images if output_dir is not specified
        if not output_dir:
            temp_dir = tempfile.mkdtemp(prefix="ocr_regions_")
            region_dir = temp_dir
        else:
            region_dir = os.path.join(output_dir, "regions")
            os.makedirs(region_dir, exist_ok=True)
        
        # Process layout elements
        if 'elements' in layout_result:
            for element in layout_result['elements']:
                element_type = element.get('type', 'unknown')
                bbox = element.get('bbox', {})
                
                # Skip elements without proper bounding box
                if not all(key in bbox for key in ['x', 'y', 'width', 'height']):
                    continue
                
                # Convert element type to region type
                region_type = self._map_element_to_region_type(element_type, element)
                
                # Extract region image
                region_image_path = os.path.join(
                    region_dir, 
                    f"{Path(document_path).stem}_region_{len(regions)}.png"
                )
                
                # Extract and save region image
                try:
                    self._extract_region_image(
                        document_path,
                        region_image_path,
                        (bbox['x'], bbox['y'], bbox['width'], bbox['height'])
                    )
                    
                    # Create document region
                    region = DocumentRegion(
                        region_type=region_type,
                        coordinates=(bbox['x'], bbox['y'], bbox['width'], bbox['height']),
                        image_path=region_image_path
                    )
                    
                    regions.append(region)
                except Exception as e:
                    logger.error(f"Failed to extract region: {e}")
        
        # If no regions were extracted, use the entire document as a single region
        if not regions:
            region_image_path = os.path.join(
                region_dir, 
                f"{Path(document_path).stem}_full.png"
            )
            
            # Copy or convert the document to PNG
            if document_path.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp')):
                import shutil
                shutil.copy(document_path, region_image_path)
            else:
                # For PDFs, convert first page to image
                self._convert_document_to_image(document_path, region_image_path)
            
            # Get image dimensions
            img = cv2.imread(region_image_path)
            if img is not None:
                height, width = img.shape[:2]
                
                # Create document region for the entire document
                region = DocumentRegion(
                    region_type=RegionType.TEXT,
                    coordinates=(0, 0, width, height),
                    image_path=region_image_path
                )
                
                regions.append(region)
        
        return regions
    
    def _map_element_to_region_type(self, element_type: str, element: Dict[str, Any]) -> str:
        """Map layout element type to region type"""
        # Direct mappings
        type_mapping = {
            'text': RegionType.TEXT,
            'table': RegionType.TABLE,
            'heading': RegionType.HEADING,
            'form': RegionType.FORM,
            'handwriting': RegionType.HANDWRITING,
            'formula': RegionType.FORMULA,
            'diagram': RegionType.DIAGRAM,
            'code': RegionType.CODE
        }
        
        # Return mapped type or default to TEXT
        return type_mapping.get(element_type.lower(), RegionType.TEXT)
    
    def _extract_region_image(
        self, 
        document_path: str, 
        output_path: str, 
        bbox: Tuple[int, int, int, int]
    ):
        """
        Extract region image from document
        
        Args:
            document_path: Path to the document
            output_path: Path for the extracted region
            bbox: Bounding box (x, y, width, height)
        """
        # For image documents
        if document_path.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff')):
            # Read the image
            img = cv2.imread(document_path)
            if img is None:
                raise ValueError(f"Failed to read image: {document_path}")
            
            # Extract region
            x, y, width, height = bbox
            region = img[y:y+height, x:x+width]
            
            # Save the region
            cv2.imwrite(output_path, region)
        
        # For PDF documents, use PyMuPDF (import locally to avoid unnecessary dependency)
        elif document_path.lower().endswith('.pdf'):
            import fitz  # PyMuPDF
            
            doc = fitz.open(document_path)
            
            # Assume first page for now
            # TODO: Handle multi-page documents with proper page detection
            page = doc[0]
            
            # Extract region from the page
            x, y, width, height = bbox
            region = page.get_pixmap(
                matrix=fitz.Matrix(2, 2),  # 2x zoom for better quality
                clip=fitz.Rect(x, y, x+width, y+height)
            )
            
            # Save the region
            region.save(output_path)
        else:
            raise ValueError(f"Unsupported document type: {document_path}")
    
    def _convert_document_to_image(self, document_path: str, output_path: str):
        """
        Convert document to image (first page for PDFs)
        
        Args:
            document_path: Path to the document
            output_path: Path for the output image
        """
        # For PDFs, use PyMuPDF (import locally to avoid unnecessary dependency)
        if document_path.lower().endswith('.pdf'):
            import fitz  # PyMuPDF
            
            doc = fitz.open(document_path)
            
            # Convert first page to image
            page = doc[0]
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
            pix.save(output_path)
        
        # For image documents, just copy
        elif document_path.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff')):
            import shutil
            shutil.copy(document_path, output_path)
        else:
            raise ValueError(f"Unsupported document type: {document_path}")
    
    def _get_optimal_engine(self, region: DocumentRegion) -> str:
        """
        Determine the optimal engine for a document region
        
        Args:
            region: Document region
            
        Returns:
            Engine name
        """
        # Define engine capabilities
        engine_capabilities = {
            'nougat': {
                RegionType.TECHNICAL: 0.9,
                RegionType.FORMULA: 0.95,
                RegionType.TABLE: 0.85,
                RegionType.SCIENTIFIC: 0.9,
                RegionType.TEXT: 0.8
            },
            'marker': {
                RegionType.TEXT: 0.9,
                RegionType.TABLE: 0.8,
                RegionType.HEADING: 0.9,
                RegionType.LAYOUT: 0.95
            },
            'thepipe': {
                RegionType.FORM: 0.95,
                RegionType.TECHNICAL: 0.85,
                RegionType.TEXT: 0.7
            },
            'tesseract': {
                RegionType.TEXT: 0.8,
                RegionType.HEADING: 0.85,
                RegionType.TABLE: 0.7,
                RegionType.FORM: 0.75
            }
        }
        
        # Calculate scores for each available engine
        scores = {}
        for engine_name in self.config['available_engines']:
            if engine_name in engine_capabilities:
                capability = engine_capabilities[engine_name]
                scores[engine_name] = capability.get(region.region_type, 0.5)
        
        # Select the engine with the highest score
        if scores:
            return max(scores.items(), key=lambda x: x[1])[0]
        
        # Fallback to tesseract if no engine is suitable
        return 'tesseract'
    
    def _process_regions(
        self, 
        regions: List[DocumentRegion],
        output_dir: str = None
    ) -> List[DocumentRegion]:
        """
        Process document regions with appropriate engines
        
        Args:
            regions: List of document regions
            output_dir: Output directory for results
            
        Returns:
            List of processed document regions
        """
        processed_regions = []
        
        for region in regions:
            # Determine optimal engine
            engine_name = self._get_optimal_engine(region)
            
            # Get engine
            engine = self.engines.get(engine_name)
            
            if engine:
                try:
                    # Process region with the selected engine
                    logger.info(f"Processing region with {engine_name} engine")
                    
                    # Process with the engine
                    result = engine.process_image(region.image_path)
                    
                    # Update region with processed content
                    region.content = result
                    region.confidence = result.get('confidence', 0.0)
                    region.processed_by.append(engine_name)
                    
                    # If confidence is too low, try with fallback engine
                    if region.confidence < self.config['confidence_threshold'] and engine_name != 'tesseract':
                        fallback_result = self.engines['tesseract'].process_image(region.image_path)
                        
                        # If fallback has higher confidence, use it instead
                        fallback_confidence = fallback_result.get('confidence', 0.0)
                        if fallback_confidence > region.confidence:
                            region.content = fallback_result
                            region.confidence = fallback_confidence
                            region.processed_by.append('tesseract')
                    
                    processed_regions.append(region)
                    
                except Exception as e:
                    logger.error(f"Error processing region with {engine_name}: {e}")
                    
                    # Try with fallback engine
                    if engine_name != 'tesseract':
                        try:
                            fallback_result = self.engines['tesseract'].process_image(region.image_path)
                            
                            region.content = fallback_result
                            region.confidence = fallback_result.get('confidence', 0.0)
                            region.processed_by.append('tesseract')
                            
                            processed_regions.append(region)
                        except Exception as fallback_error:
                            logger.error(f"Fallback engine also failed: {fallback_error}")
            else:
                logger.warning(f"Engine {engine_name} not available, falling back to tesseract")
                
                # Fallback to tesseract
                try:
                    fallback_result = self.engines['tesseract'].process_image(region.image_path)
                    
                    region.content = fallback_result
                    region.confidence = fallback_result.get('confidence', 0.0)
                    region.processed_by.append('tesseract')
                    
                    processed_regions.append(region)
                except Exception as fallback_error:
                    logger.error(f"Fallback engine failed: {fallback_error}")
        
        return processed_regions
    
    def _aggregate_results(
        self, 
        regions: List[DocumentRegion],
        document_path: str
    ) -> Dict[str, Any]:
        """
        Aggregate results from all processed regions
        
        Args:
            regions: List of processed document regions
            document_path: Path to the original document
            
        Returns:
            Aggregated results
        """
        # Initialize result structure
        result = {
            "text": "",
            "structured_content": {
                "headings": [],
                "paragraphs": [],
                "tables": [],
                "forms": [],
                "technical_content": []
            },
            "statistics": {
                "region_count": len(regions),
                "average_confidence": 0.0,
                "engine_usage": {}
            }
        }
        
        # Track engine usage
        engine_usage = {}
        
        # Collect text and structured content
        total_confidence = 0.0
        
        for region in regions:
            # Update engine usage
            for engine in region.processed_by:
                engine_usage[engine] = engine_usage.get(engine, 0) + 1
            
            # Extract text based on region type
            if 'text' in region.content:
                region_text = region.content['text']
                
                # Add text to appropriate section
                if region.region_type == RegionType.HEADING:
                    result["structured_content"]["headings"].append({
                        "text": region_text,
                        "confidence": region.confidence,
                        "coordinates": region.coordinates
                    })
                
                elif region.region_type == RegionType.TABLE:
                    result["structured_content"]["tables"].append({
                        "text": region_text,
                        "data": region.content.get("table_data", []),
                        "confidence": region.confidence,
                        "coordinates": region.coordinates
                    })
                
                elif region.region_type == RegionType.FORM:
                    result["structured_content"]["forms"].append({
                        "text": region_text,
                        "fields": region.content.get("form_fields", {}),
                        "confidence": region.confidence,
                        "coordinates": region.coordinates
                    })
                
                elif region.region_type == RegionType.TECHNICAL:
                    result["structured_content"]["technical_content"].append({
                        "text": region_text,
                        "confidence": region.confidence,
                        "coordinates": region.coordinates
                    })
                
                else:
                    # Add to paragraphs
                    result["structured_content"]["paragraphs"].append({
                        "text": region_text,
                        "confidence": region.confidence,
                        "coordinates": region.coordinates
                    })
                
                # Add to full text
                result["text"] += region_text + "\n\n"
            
            # Update total confidence
            total_confidence += region.confidence
        
        # Calculate average confidence
        if regions:
            result["statistics"]["average_confidence"] = total_confidence / len(regions)
        
        # Update engine usage statistics
        result["statistics"]["engine_usage"] = engine_usage
        
        return result


def main():
    """Main function to parse arguments and run neural OCR orchestrator"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Neural OCR Orchestrator")
    parser.add_argument("document_path", help="Path to the document")
    parser.add_argument("--output-dir", help="Output directory")
    parser.add_argument("--engines", help="Comma-separated list of engines to use")
    parser.add_argument("--confidence", type=float, default=0.6, 
                       help="Minimum confidence threshold (0-1)")
    
    args = parser.parse_args()
    
    # Build configuration
    config = {
        'confidence_threshold': args.confidence
    }
    
    # Set engines if specified
    if args.engines:
        engines = [e.strip() for e in args.engines.split(',')]
        config['engine_priority'] = engines
    
    # Create orchestrator
    orchestrator = NeuralOCROrchestrator(config)
    
    # Process document
    result = orchestrator.process_document(args.document_path, args.output_dir)
    
    # Print summary
    print(json.dumps({
        "document": os.path.basename(args.document_path),
        "engine_usage": result["result"]["statistics"]["engine_usage"],
        "average_confidence": result["result"]["statistics"]["average_confidence"],
        "output_dir": args.output_dir or os.path.dirname(args.document_path)
    }, indent=2))


if __name__ == "__main__":
    main()