#!/usr/bin/env python3
"""
Enhanced OCR System for Material Data Processing

This module provides a comprehensive OCR solution for material datasheets by integrating:
1. Specialized OCR for technical specifications (specialized_ocr.py)
2. Layout analysis for complex document structures (layout_analysis.py)
3. Handwriting recognition capabilities (handwriting_recognition.py)
4. Form field extraction from structured forms (form_field_extraction.py)
5. Confidence scoring and post-processing rules (ocr_confidence_scoring.py)

Usage:
    python enhanced_ocr.py <input_path> [options]

Arguments:
    input_path    Path to the document image or PDF
    
Options:
    --output-dir           Directory to save results
    --language             OCR language(s) (comma-separated, default: eng)
    --material-type        Type of material (tile, stone, wood, etc.)
    --extract-forms        Enable form field extraction
    --extract-tables       Enable table extraction
    --detect-handwriting   Enable handwriting detection
    --confidence-threshold Minimum confidence threshold (0-100, default: 60)
    --visualization        Generate visualizations
"""

import os
import sys
import json
import argparse
import tempfile
from typing import Dict, List, Any, Tuple, Optional, Union
import logging
from pathlib import Path
import time
import shutil

# Import enhanced OCR components
try:
    from specialized_ocr import SpecializedOCR
    from layout_analysis import LayoutAnalyzer
    from handwriting_recognition import HandwritingDetector
    from form_field_extraction import FormFieldExtractor
    from ocr_confidence_scoring import OCRConfidenceScorer, RulesEngine
except ImportError as e:
    print(f"Error importing required modules: {e}")
    print("Please ensure all required modules are installed and in your Python path.")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EnhancedOCR:
    """
    Integrated OCR system with enhanced capabilities for material datasheets
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the enhanced OCR system
        
        Args:
            config: Configuration dictionary with settings
        """
        self.config = {
            'languages': ['eng'],
            'material_type': 'tile',
            'enable_form_extraction': True,
            'enable_table_extraction': True,
            'enable_handwriting_detection': True,
            'confidence_threshold': 60,
            'generate_visualizations': True,
            'preprocessing_level': 'advanced',
            'post_processing_enabled': True,
            'output_format': 'json',
            'dpi': 300,
            'max_pages': 20,
            'detailed_metrics': True
        }
        
        if config:
            self.config.update(config)
        
        # Initialize component modules
        self._init_components()
    
    def _init_components(self):
        """Initialize component modules"""
        # Convert languages from list to comma-separated string if needed
        lang_str = '+'.join(self.config['languages'])
        
        # Specialized OCR for material datasheets
        self.specialized_ocr = SpecializedOCR({
            'languages': self.config['languages'],
            'datasheet_type': self.config['material_type'],
            'min_confidence': self.config['confidence_threshold'],
            'dpi': self.config['dpi'],
            'preprocess_level': self.config['preprocessing_level'],
            'dictionary_boost': True
        })
        
        # Layout analyzer for document structure
        self.layout_analyzer = LayoutAnalyzer({
            'extract_tables': self.config['enable_table_extraction'],
            'visualization_enabled': self.config['generate_visualizations'],
            'multi_column_detection': True,
            'table_detection_mode': 'advanced'
        })
        
        # Handwriting detector
        self.handwriting_detector = HandwritingDetector({
            'language': lang_str,
            'min_confidence': self.config['confidence_threshold'],
            'preprocessing_level': self.config['preprocessing_level'],
            'visualization_enabled': self.config['generate_visualizations']
        })
        
        # Form field extractor
        self.form_extractor = FormFieldExtractor({
            'enable_ocr': True,
            'ocr_language': lang_str,
            'extract_tables': self.config['enable_table_extraction'],
            'visualization_enabled': self.config['generate_visualizations'],
            'output_format': self.config['output_format']
        })
        
        # Confidence scorer for post-processing
        self.confidence_scorer = OCRConfidenceScorer({
            'min_confidence': self.config['confidence_threshold'] / 100.0,
            'detailed_metrics': self.config['detailed_metrics'],
            'domain': self.config['material_type'],
            'spellcheck_enabled': self.config['post_processing_enabled']
        })
        
        # Rules engine for post-processing
        self.rules_engine = RulesEngine({
            'domain': self.config['material_type'],
            'system_rules_enabled': self.config['post_processing_enabled']
        })
        
        logger.info("All OCR enhancement components initialized successfully")
    
    def process_document(self, input_path: str, output_dir: str = None) -> Dict[str, Any]:
        """
        Process a document with enhanced OCR capabilities
        
        Args:
            input_path: Path to the document (image or PDF)
            output_dir: Directory to save results
            
        Returns:
            Dictionary with processing results
        """
        start_time = time.time()
        
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
        
        # Create output directory if specified
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        else:
            # Use default output directory
            output_dir = os.path.join(os.path.dirname(input_path), "ocr_results")
            os.makedirs(output_dir, exist_ok=True)
        
        # Create directories for component results
        component_dirs = {
            'specialized': os.path.join(output_dir, "specialized"),
            'layout': os.path.join(output_dir, "layout"),
            'handwriting': os.path.join(output_dir, "handwriting"),
            'forms': os.path.join(output_dir, "forms"),
            'enhanced': os.path.join(output_dir, "enhanced")
        }
        
        for dir_path in component_dirs.values():
            os.makedirs(dir_path, exist_ok=True)
        
        # Determine file type
        file_ext = os.path.splitext(input_path)[1].lower()
        is_pdf = file_ext == '.pdf'
        
        # Process based on file type
        if is_pdf:
            result = self._process_pdf(input_path, component_dirs)
        else:
            result = self._process_image(input_path, component_dirs)
        
        # Calculate processing time
        processing_time = time.time() - start_time
        result['processing_time'] = processing_time
        
        # Save final results
        result_path = os.path.join(output_dir, f"{Path(input_path).stem}_enhanced_ocr.json")
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        # Generate summary report
        self._generate_summary_report(result, output_dir, input_path)
        
        logger.info(f"Document processing completed in {processing_time:.2f} seconds")
        logger.info(f"Results saved to {output_dir}")
        
        return result
    
    def _process_pdf(self, pdf_path: str, component_dirs: Dict[str, str]) -> Dict[str, Any]:
        """
        Process a PDF document
        
        Args:
            pdf_path: Path to the PDF document
            component_dirs: Dictionary of component output directories
            
        Returns:
            Dictionary with processing results
        """
        logger.info(f"Processing PDF document: {pdf_path}")
        
        # Apply specialized OCR to handle material datasheets
        specialized_results = self.specialized_ocr.process_file(
            pdf_path, component_dirs['specialized']
        )
        
        # Extract form fields if enabled
        form_results = {}
        if self.config['enable_form_extraction']:
            form_results = self.form_extractor.process_document(
                pdf_path, component_dirs['forms']
            )
        
        # Combine results
        combined_results = {
            'document_type': 'pdf',
            'filename': os.path.basename(pdf_path),
            'path': pdf_path,
            'specialized_ocr': specialized_results,
            'form_extraction': form_results
        }
        
        # Process specialized OCR results with confidence scoring and post-processing
        if self.config['post_processing_enabled']:
            # Save specialized results to temporary file for processing
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
                json.dump(specialized_results, temp_file, ensure_ascii=False)
                temp_path = temp_file.name
            
            try:
                # Apply confidence scoring and post-processing
                enhanced_path = os.path.join(component_dirs['enhanced'], f"{Path(pdf_path).stem}_enhanced.json")
                enhanced_results = self.confidence_scorer.process_ocr_results(specialized_results)
                
                # Save enhanced results
                with open(enhanced_path, 'w', encoding='utf-8') as f:
                    json.dump(enhanced_results, f, indent=2, ensure_ascii=False)
                
                combined_results['enhanced_results'] = enhanced_results
                
            finally:
                # Clean up temporary file
                os.unlink(temp_path)
        
        return combined_results
    
    def _process_image(self, image_path: str, component_dirs: Dict[str, str]) -> Dict[str, Any]:
        """
        Process an image document
        
        Args:
            image_path: Path to the image
            component_dirs: Dictionary of component output directories
            
        Returns:
            Dictionary with processing results
        """
        logger.info(f"Processing image document: {image_path}")
        
        # Apply layout analysis to understand document structure
        layout_results = self.layout_analyzer.analyze_document(
            image_path, component_dirs['layout']
        )
        
        # Apply specialized OCR for material datasheets
        specialized_results = self.specialized_ocr.process_file(
            image_path, component_dirs['specialized']
        )
        
        # Detect handwriting if enabled
        handwriting_results = {}
        if self.config['enable_handwriting_detection']:
            handwriting_results = self.handwriting_detector.process_document(
                image_path, component_dirs['handwriting']
            )
        
        # Combine results
        combined_results = {
            'document_type': 'image',
            'filename': os.path.basename(image_path),
            'path': image_path,
            'layout_analysis': layout_results,
            'specialized_ocr': specialized_results,
            'handwriting_detection': handwriting_results
        }
        
        # Process specialized OCR results with confidence scoring and post-processing
        if self.config['post_processing_enabled']:
            # Save specialized results to temporary file for processing
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
                json.dump(specialized_results, temp_file, ensure_ascii=False)
                temp_path = temp_file.name
            
            try:
                # Apply confidence scoring and post-processing
                enhanced_path = os.path.join(component_dirs['enhanced'], f"{Path(image_path).stem}_enhanced.json")
                enhanced_results = self.confidence_scorer.process_ocr_results(specialized_results)
                
                # Save enhanced results
                with open(enhanced_path, 'w', encoding='utf-8') as f:
                    json.dump(enhanced_results, f, indent=2, ensure_ascii=False)
                
                combined_results['enhanced_results'] = enhanced_results
                
            finally:
                # Clean up temporary file
                os.unlink(temp_path)
        
        return combined_results
    
    def _generate_summary_report(self, result: Dict[str, Any], output_dir: str, input_path: str):
        """
        Generate a summary report of OCR processing
        
        Args:
            result: Processing results
            output_dir: Output directory
            input_path: Path to the input document
        """
        # Create summary structure
        summary = {
            'document': {
                'filename': os.path.basename(input_path),
                'type': result.get('document_type', 'unknown'),
                'path': input_path
            },
            'processing': {
                'time': result.get('processing_time', 0),
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                'configuration': self.config
            },
            'results': {
                'specialized_ocr': {},
                'layout_analysis': {},
                'handwriting_detection': {},
                'form_extraction': {},
                'enhanced_results': {}
            }
        }
        
        # Extract summary from specialized OCR
        if 'specialized_ocr' in result:
            specialized = result['specialized_ocr']
            summary['results']['specialized_ocr'] = {
                'text_blocks': len(specialized.get('text_blocks', [])),
                'tables': len(specialized.get('tables', [])),
                'languages_detected': specialized.get('languages_detected', []),
                'combined_text_length': len(specialized.get('full_text', ''))
            }
        
        # Extract summary from layout analysis
        if 'layout_analysis' in result:
            layout = result['layout_analysis']
            summary['results']['layout_analysis'] = {
                'tables': layout.get('element_count', {}).get('tables', 0),
                'text_blocks': layout.get('element_count', {}).get('text_blocks', 0),
                'columns': layout.get('element_count', {}).get('columns', 0)
            }
        
        # Extract summary from handwriting detection
        if 'handwriting_detection' in result:
            handwriting = result['handwriting_detection']
            summary['results']['handwriting_detection'] = {
                'handwriting_detected': handwriting.get('handwriting_detected', False),
                'regions_detected': handwriting.get('regions_detected', 0),
                'average_confidence': handwriting.get('average_confidence', 0)
            }
        
        # Extract summary from form extraction
        if 'form_extraction' in result:
            form = result['form_extraction']
            summary['results']['form_extraction'] = {
                'total_fields': form.get('total_fields', 0),
                'filled_fields': form.get('filled_fields', 0),
                'tables': len(form.get('tables', []))
            }
        
        # Extract summary from enhanced results
        if 'enhanced_results' in result:
            enhanced = result['enhanced_results']
            summary['results']['enhanced_results'] = {
                'processed_elements': len(enhanced.get('processed_elements', [])),
                'average_confidence': enhanced.get('statistics', {}).get('average_confidence', 0),
                'improvement_rate': enhanced.get('statistics', {}).get('improvement_rate', 0)
            }
        
        # Save summary report
        summary_path = os.path.join(output_dir, f"{Path(input_path).stem}_summary.json")
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        # Also save a text version for easy reading
        text_summary_path = os.path.join(output_dir, f"{Path(input_path).stem}_summary.txt")
        with open(text_summary_path, 'w', encoding='utf-8') as f:
            f.write(f"Enhanced OCR Summary Report\n")
            f.write(f"=========================\n\n")
            f.write(f"Document: {summary['document']['filename']}\n")
            f.write(f"Type: {summary['document']['type']}\n")
            f.write(f"Processed on: {summary['processing']['timestamp']}\n")
            f.write(f"Processing time: {summary['processing']['time']:.2f} seconds\n\n")
            
            f.write(f"Results Summary:\n")
            f.write(f"--------------\n")
            
            for component, metrics in summary['results'].items():
                if metrics:
                    f.write(f"\n{component.replace('_', ' ').title()}:\n")
                    for key, value in metrics.items():
                        f.write(f"  - {key.replace('_', ' ').title()}: {value}\n")
            
            f.write(f"\nDetailed results available in: {output_dir}\n")


def batch_process_documents(
    input_paths: List[str], 
    output_dir: str, 
    config: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Process multiple documents with enhanced OCR
    
    Args:
        input_paths: List of paths to documents
        output_dir: Directory to save results
        config: Configuration for OCR processing
        
    Returns:
        Dictionary with batch processing results
    """
    if not input_paths:
        return {"error": "No input files provided"}
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Create enhanced OCR processor
    processor = EnhancedOCR(config)
    
    # Process each document
    results = []
    for input_path in input_paths:
        try:
            # Create document-specific output directory
            doc_name = Path(input_path).stem
            doc_output_dir = os.path.join(output_dir, doc_name)
            os.makedirs(doc_output_dir, exist_ok=True)
            
            # Process document
            logger.info(f"Processing {input_path}")
            result = processor.process_document(input_path, doc_output_dir)
            
            # Add to results
            results.append({
                "filename": os.path.basename(input_path),
                "output_dir": doc_output_dir,
                "processing_time": result.get("processing_time", 0),
                "status": "success"
            })
            
        except Exception as e:
            logger.error(f"Error processing {input_path}: {e}")
            results.append({
                "filename": os.path.basename(input_path),
                "error": str(e),
                "status": "error"
            })
    
    # Create batch summary
    summary = {
        "total_documents": len(input_paths),
        "successful": sum(1 for r in results if r["status"] == "success"),
        "failed": sum(1 for r in results if r["status"] == "error"),
        "total_processing_time": sum(r.get("processing_time", 0) for r in results),
        "documents": results
    }
    
    # Save batch summary
    summary_path = os.path.join(output_dir, "batch_summary.json")
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    return summary


def main():
    """Main function to parse arguments and run enhanced OCR"""
    parser = argparse.ArgumentParser(description="Enhanced OCR for material datasheets")
    parser.add_argument("input_path", help="Path to the document image or PDF")
    parser.add_argument("--output-dir", help="Directory to save results")
    parser.add_argument("--language", default="eng", 
                      help="OCR language(s) (comma-separated)")
    parser.add_argument("--material-type", choices=["tile", "stone", "wood"], 
                      default="tile", help="Type of material")
    parser.add_argument("--extract-forms", action="store_true", 
                      help="Enable form field extraction")
    parser.add_argument("--extract-tables", action="store_true", 
                      help="Enable table extraction")
    parser.add_argument("--detect-handwriting", action="store_true", 
                      help="Enable handwriting detection")
    parser.add_argument("--confidence-threshold", type=int, default=60, 
                      help="Minimum confidence threshold (0-100)")
    parser.add_argument("--visualize", action="store_true", 
                      help="Generate visualizations")
    parser.add_argument("--batch-mode", action="store_true", 
                      help="Process multiple documents from a directory")
    parser.add_argument("--no-post-processing", action="store_true", 
                      help="Disable post-processing rules")
    
    args = parser.parse_args()
    
    try:
        # Set up configuration
        config = {
            'languages': args.language.split(','),
            'material_type': args.material_type,
            'enable_form_extraction': args.extract_forms,
            'enable_table_extraction': args.extract_tables,
            'enable_handwriting_detection': args.detect_handwriting,
            'confidence_threshold': args.confidence_threshold,
            'generate_visualizations': args.visualize,
            'post_processing_enabled': not args.no_post_processing
        }
        
        # Process in batch mode or single document mode
        if args.batch_mode:
            # Check if input_path is a directory
            if os.path.isdir(args.input_path):
                # Get all documents in the directory
                input_files = []
                for root, _, files in os.walk(args.input_path):
                    for file in files:
                        if file.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp')):
                            input_files.append(os.path.join(root, file))
                
                if not input_files:
                    print(f"No supported documents found in directory: {args.input_path}")
                    return 1
                
                # Process batch
                output_dir = args.output_dir or os.path.join(args.input_path, "ocr_results")
                result = batch_process_documents(input_files, output_dir, config)
                
                # Print summary
                print(json.dumps({
                    "total_documents": result["total_documents"],
                    "successful": result["successful"],
                    "failed": result["failed"],
                    "output_dir": output_dir
                }, indent=2))
            else:
                print(f"Error: {args.input_path} is not a directory")
                return 1
        else:
            # Process single document
            processor = EnhancedOCR(config)
            result = processor.process_document(args.input_path, args.output_dir)
            
            # Print summary
            print(json.dumps({
                "filename": os.path.basename(args.input_path),
                "processing_time": result.get("processing_time", 0),
                "output_dir": args.output_dir or os.path.join(os.path.dirname(args.input_path), "ocr_results")
            }, indent=2))
        
        return 0
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())