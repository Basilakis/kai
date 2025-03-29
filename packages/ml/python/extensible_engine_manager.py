#!/usr/bin/env python3
"""
Extensible Engine Manager

This module provides a framework for integrating additional OCR engines
and document understanding models into the neural OCR system.

Key features:
1. Pluggable architecture for third-party OCR engines
2. Adapter interfaces for standardizing model inputs/outputs
3. Engine registry for dynamic model discovery and loading
4. Resource management for multiple loaded models
5. Engine chaining and pipeline construction
"""

import os
import sys
import json
import importlib
import logging
import inspect
import pkgutil
import threading
import time
from typing import Dict, List, Any, Tuple, Optional, Union, Type, Callable
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ModelType(Enum):
    """Enumeration of model types supported by the engine manager"""
    OCR = "ocr"                        # Basic text extraction
    DOCUMENT_UNDERSTANDING = "docproc" # Document understanding
    LAYOUT = "layout"                  # Layout analysis
    TABLE = "table"                    # Table extraction
    FORM = "form"                      # Form field extraction
    CLASSIFICATION = "classify"        # Document classification
    CUSTOM = "custom"                  # Custom model type


@dataclass
class EngineMetadata:
    """Metadata for an OCR engine"""
    name: str
    version: str
    model_type: ModelType
    description: str = ""
    author: str = ""
    repository: str = ""
    license: str = ""
    requirements: List[str] = field(default_factory=list)
    supported_formats: List[str] = field(default_factory=list)
    supported_languages: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    performance_metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EngineResult:
    """Standardized result from an OCR engine"""
    engine_name: str
    success: bool
    result_type: str
    data: Any
    confidence: float = 0.0
    processing_time: float = 0.0
    error: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class OCREngineInterface(ABC):
    """Abstract base class for OCR engines"""
    
    @abstractmethod
    def initialize(self, config: Dict[str, Any] = None) -> bool:
        """
        Initialize the engine with configuration
        
        Args:
            config: Configuration dictionary
            
        Returns:
            True if initialization succeeded, False otherwise
        """
        pass
    
    @abstractmethod
    def get_metadata(self) -> EngineMetadata:
        """
        Get engine metadata
        
        Returns:
            EngineMetadata object
        """
        pass
    
    @abstractmethod
    def process_document(self, document_path: str, options: Dict[str, Any] = None) -> EngineResult:
        """
        Process a document
        
        Args:
            document_path: Path to the document
            options: Processing options
            
        Returns:
            EngineResult object
        """
        pass
    
    @abstractmethod
    def process_image(self, image_data: Any, options: Dict[str, Any] = None) -> EngineResult:
        """
        Process an image
        
        Args:
            image_data: Image data (bytes, numpy array, or file path)
            options: Processing options
            
        Returns:
            EngineResult object
        """
        pass
    
    @abstractmethod
    def supports_format(self, file_format: str) -> bool:
        """
        Check if the engine supports a file format
        
        Args:
            file_format: File format (extension)
            
        Returns:
            True if supported, False otherwise
        """
        pass
    
    def release_resources(self):
        """Release any resources held by the engine"""
        # Default implementation does nothing
        pass


class EngineManager:
    """
    Manages OCR and document understanding engines
    with dynamic loading and resource management.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the engine manager
        
        Args:
            config: Configuration dictionary
        """
        self.config = {
            'engine_discovery_paths': [],
            'builtin_engines_enabled': True,
            'third_party_engines_enabled': True,
            'engine_configs': {},
            'max_concurrent_engines': 3,
            'default_engine': None,
            'engine_fallback_chain': [],
            'cache_results': True,
            'cache_ttl': 3600,  # seconds
            'monitoring_enabled': True,
            'plugin_directory': None
        }
        
        if config:
            self.config.update(config)
        
        # Registry of available engines
        self.engines = {}
        
        # Registry of engine class types
        self.engine_classes = {}
        
        # Loaded engine instances
        self.engine_instances = {}
        
        # Resource locks
        self.resource_locks = {}
        
        # Result cache
        self.result_cache = {}
        
        # Register built-in engines
        if self.config['builtin_engines_enabled']:
            self._register_builtin_engines()
        
        # Register third-party engines
        if self.config['third_party_engines_enabled']:
            self._discover_third_party_engines()
    
    def _register_builtin_engines(self):
        """Register built-in OCR engines"""
        # Register Tesseract adapter
        from tesseract_engine import TesseractEngine
        self.register_engine_class("tesseract", TesseractEngine)
        
        # Register Nougat adapter if available
        try:
            from nougat_engine import NougatEngine
            self.register_engine_class("nougat", NougatEngine)
            logger.info("Registered Nougat engine")
        except ImportError:
            logger.info("Nougat engine not available")
        
        # Register Marker adapter if available
        try:
            from marker_engine import MarkerEngine
            self.register_engine_class("marker", MarkerEngine)
            logger.info("Registered Marker engine")
        except ImportError:
            logger.info("Marker engine not available")
        
        # Register ThePipe adapter if available
        try:
            from thepipe_engine import ThePipeEngine
            self.register_engine_class("thepipe", ThePipeEngine)
            logger.info("Registered ThePipe engine")
        except ImportError:
            logger.info("ThePipe engine not available")
            
        # Register PaddleOCR adapter if available
        try:
            from additional_engines import PaddleOCREngine
            self.register_engine_class("paddleocr", PaddleOCREngine)
            logger.info("Registered PaddleOCR engine")
        except ImportError:
            logger.info("PaddleOCR engine not available")
            
        # Register pdfdeal adapter if available
        try:
            from additional_engines import PdfDealEngine
            self.register_engine_class("pdfdeal", PdfDealEngine)
            logger.info("Registered pdfdeal engine")
        except ImportError:
            logger.info("pdfdeal engine not available")
            
        # Register surya adapter if available
        try:
            from additional_engines import SuryaEngine
            self.register_engine_class("surya", SuryaEngine)
            logger.info("Registered surya engine")
        except ImportError:
            logger.info("surya engine not available")
            
        # Register mPLUG-DocOwl adapter if available
        try:
            from additional_engines import DocOwlEngine
            self.register_engine_class("docowl", DocOwlEngine)
            logger.info("Registered mPLUG-DocOwl engine")
        except ImportError:
            logger.info("mPLUG-DocOwl engine not available")
    
    def _discover_third_party_engines(self):
        """Discover and register third-party engines"""
        # Check plugin directory
        if self.config['plugin_directory'] and os.path.isdir(self.config['plugin_directory']):
            self._load_plugins_from_directory(self.config['plugin_directory'])
        
        # Check additional discovery paths
        for path in self.config['engine_discovery_paths']:
            if os.path.isdir(path):
                self._load_plugins_from_directory(path)
    
    def _load_plugins_from_directory(self, directory: str):
        """
        Load plugins from a directory
        
        Args:
            directory: Directory to search for plugins
        """
        # Add directory to Python path if not already present
        if directory not in sys.path:
            sys.path.append(directory)
        
        # Scan for Python modules in the directory
        for _, name, is_pkg in pkgutil.iter_modules([directory]):
            if not name.endswith('_engine'):
                continue
            
            try:
                # Import the module
                module = importlib.import_module(name)
                
                # Look for engine classes
                for attr_name in dir(module):
                    if attr_name.endswith('Engine') and attr_name != 'OCREngineInterface':
                        attr = getattr(module, attr_name)
                        
                        # Check if it's a class that implements OCREngineInterface
                        if (inspect.isclass(attr) and 
                            issubclass(attr, OCREngineInterface) and 
                            attr != OCREngineInterface):
                            
                            # Create an instance to get metadata
                            engine_instance = attr()
                            metadata = engine_instance.get_metadata()
                            
                            # Register the engine class
                            self.register_engine_class(metadata.name, attr)
                            logger.info(f"Registered third-party engine: {metadata.name} ({metadata.version})")
                            
                            # Clean up instance
                            del engine_instance
            
            except Exception as e:
                logger.error(f"Error loading plugin module {name}: {e}")
    
    def register_engine_class(self, engine_name: str, engine_class: Type[OCREngineInterface]):
        """
        Register an engine class
        
        Args:
            engine_name: Name of the engine
            engine_class: OCREngineInterface implementation class
        """
        self.engine_classes[engine_name] = engine_class
        
        # Create an instance to get metadata
        try:
            temp_instance = engine_class()
            metadata = temp_instance.get_metadata()
            self.engines[engine_name] = metadata
            
            # Clean up
            temp_instance.release_resources()
            del temp_instance
            
            logger.info(f"Registered engine class: {engine_name}")
            
            # Set as default if none specified
            if not self.config['default_engine'] and metadata.model_type == ModelType.OCR:
                self.config['default_engine'] = engine_name
            
        except Exception as e:
            logger.error(f"Error getting metadata for engine {engine_name}: {e}")
    
    def register_engine_instance(self, engine_name: str, instance: OCREngineInterface):
        """
        Register a pre-configured engine instance
        
        Args:
            engine_name: Name of the engine
            instance: Configured OCREngineInterface instance
        """
        self.engine_instances[engine_name] = instance
        metadata = instance.get_metadata()
        self.engines[engine_name] = metadata
        logger.info(f"Registered engine instance: {engine_name}")
    
    def get_engine(self, engine_name: Optional[str] = None) -> OCREngineInterface:
        """
        Get or create an engine instance
        
        Args:
            engine_name: Name of the engine, or None for default
            
        Returns:
            OCREngineInterface instance
            
        Raises:
            ValueError: If the engine is not found
        """
        # Use default engine if none specified
        if not engine_name:
            engine_name = self.config['default_engine']
            if not engine_name:
                raise ValueError("No engine specified and no default engine configured")
        
        # Check if we already have an instance
        if engine_name in self.engine_instances:
            return self.engine_instances[engine_name]
        
        # Check if we have the engine class
        if engine_name in self.engine_classes:
            # Create and initialize the engine
            engine_class = self.engine_classes[engine_name]
            engine_instance = engine_class()
            
            # Apply engine-specific configuration
            engine_config = self.config['engine_configs'].get(engine_name, {})
            engine_instance.initialize(engine_config)
            
            # Store the instance
            self.engine_instances[engine_name] = engine_instance
            
            # Create resource lock
            self.resource_locks[engine_name] = threading.RLock()
            
            return engine_instance
        
        raise ValueError(f"Engine not found: {engine_name}")
    
    def process_document(self, document_path: str, engine_name: Optional[str] = None, 
                         options: Dict[str, Any] = None) -> EngineResult:
        """
        Process a document with the specified engine
        
        Args:
            document_path: Path to the document
            engine_name: Name of the engine to use, or None for default
            options: Processing options
            
        Returns:
            EngineResult object
        """
        # Check cache first if enabled
        cache_key = None
        if self.config['cache_results']:
            cache_key = f"{document_path}:{engine_name}:{json.dumps(options or {})}"
            cached_result = self._get_cached_result(cache_key)
            if cached_result:
                return cached_result
        
        try:
            # Get the engine
            engine = self.get_engine(engine_name)
            
            # Acquire resource lock
            with self.resource_locks.get(engine_name or self.config['default_engine'], threading.RLock()):
                # Process the document
                start_time = time.time()
                result = engine.process_document(document_path, options)
                processing_time = time.time() - start_time
                
                # Add processing time to result
                result.processing_time = processing_time
                
                # Cache the result if enabled
                if self.config['cache_results'] and cache_key and result.success:
                    self._cache_result(cache_key, result)
                
                return result
                
        except Exception as e:
            logger.error(f"Error processing document with engine {engine_name}: {e}")
            
            # Create error result
            return EngineResult(
                engine_name=engine_name or "unknown",
                success=False,
                result_type="error",
                data=None,
                error=str(e),
                processing_time=0.0
            )
    
    def process_with_fallback(self, document_path: str, options: Dict[str, Any] = None) -> EngineResult:
        """
        Process a document with fallback chain
        
        Args:
            document_path: Path to the document
            options: Processing options
            
        Returns:
            EngineResult from the first successful engine
        """
        # Use configured fallback chain or create default
        fallback_chain = self.config['engine_fallback_chain']
        if not fallback_chain and self.config['default_engine']:
            fallback_chain = [self.config['default_engine']]
            
            # Add other engines as fallbacks
            for engine_name in self.engines:
                if engine_name != self.config['default_engine']:
                    fallback_chain.append(engine_name)
        
        # Try each engine in the fallback chain
        for engine_name in fallback_chain:
            result = self.process_document(document_path, engine_name, options)
            
            if result.success:
                return result
            
            # Log the failure and continue with next engine
            logger.warning(f"Engine {engine_name} failed: {result.error}")
        
        # All engines failed
        return EngineResult(
            engine_name="fallback_chain",
            success=False,
            result_type="error",
            data=None,
            error="All engines in fallback chain failed",
            processing_time=0.0
        )
    
    def process_with_voting(self, document_path: str, engine_names: List[str] = None, 
                          options: Dict[str, Any] = None) -> EngineResult:
        """
        Process a document with multiple engines and combine results
        
        Args:
            document_path: Path to the document
            engine_names: List of engine names to use
            options: Processing options
            
        Returns:
            EngineResult with combined results
        """
        # Use all available engines if none specified
        if not engine_names:
            engine_names = list(self.engines.keys())
        
        # Process with each engine
        results = []
        for engine_name in engine_names:
            try:
                result = self.process_document(document_path, engine_name, options)
                results.append(result)
            except Exception as e:
                logger.error(f"Error processing with engine {engine_name}: {e}")
        
        # Check if we have any successful results
        successful_results = [r for r in results if r.success]
        if not successful_results:
            return EngineResult(
                engine_name="voting",
                success=False,
                result_type="error",
                data=None,
                error="All engines failed",
                processing_time=0.0
            )
        
        # Combine results using a voting mechanism
        combined_result = self._combine_results(successful_results)
        return combined_result
    
    def _combine_results(self, results: List[EngineResult]) -> EngineResult:
        """
        Combine results from multiple engines
        
        Args:
            results: List of EngineResult objects
            
        Returns:
            Combined EngineResult
        """
        # This is a simplified implementation
        # A real implementation would use more sophisticated techniques
        
        # Sort by confidence
        sorted_results = sorted(results, key=lambda r: r.confidence, reverse=True)
        
        # Start with the highest confidence result
        base_result = sorted_results[0]
        
        # Create combined result
        combined_result = EngineResult(
            engine_name="voting",
            success=True,
            result_type=base_result.result_type,
            data=base_result.data,  # Start with highest confidence data
            confidence=base_result.confidence,
            processing_time=sum(r.processing_time for r in results),
            metadata={
                "combined_from": [r.engine_name for r in results],
                "vote_weights": {r.engine_name: r.confidence for r in results}
            }
        )
        
        return combined_result
    
    def _get_cached_result(self, cache_key: str) -> Optional[EngineResult]:
        """
        Get a cached result if valid
        
        Args:
            cache_key: Cache key
            
        Returns:
            Cached EngineResult or None if not found or expired
        """
        if cache_key in self.result_cache:
            entry = self.result_cache[cache_key]
            
            # Check if expired
            if time.time() - entry['timestamp'] < self.config['cache_ttl']:
                return entry['result']
            
            # Remove expired entry
            del self.result_cache[cache_key]
        
        return None
    
    def _cache_result(self, cache_key: str, result: EngineResult):
        """
        Cache a result
        
        Args:
            cache_key: Cache key
            result: EngineResult to cache
        """
        self.result_cache[cache_key] = {
            'result': result,
            'timestamp': time.time()
        }
        
        # Cleanup old cache entries
        self._cleanup_cache()
    
    def _cleanup_cache(self):
        """Remove expired cache entries"""
        now = time.time()
        expired_keys = []
        
        for key, entry in self.result_cache.items():
            if now - entry['timestamp'] > self.config['cache_ttl']:
                expired_keys.append(key)
        
        for key in expired_keys:
            del self.result_cache[key]
    
    def get_available_engines(self) -> Dict[str, EngineMetadata]:
        """
        Get metadata for all available engines
        
        Returns:
            Dictionary mapping engine names to EngineMetadata
        """
        return self.engines
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about engines
        
        Returns:
            Dictionary with engine statistics
        """
        stats = {
            'engine_count': len(self.engines),
            'loaded_instance_count': len(self.engine_instances),
            'cache_size': len(self.result_cache),
            'engines': {}
        }
        
        # Add stats for each engine
        for engine_name, metadata in self.engines.items():
            engine_stats = {
                'name': metadata.name,
                'version': metadata.version,
                'model_type': metadata.model_type.value,
                'loaded': engine_name in self.engine_instances
            }
            
            # Add performance metrics if available
            if metadata.performance_metrics:
                engine_stats['performance'] = metadata.performance_metrics
            
            stats['engines'][engine_name] = engine_stats
        
        return stats
    
    def release_all_engines(self):
        """Release resources for all engine instances"""
        for engine_name, instance in self.engine_instances.items():
            try:
                instance.release_resources()
                logger.info(f"Released resources for engine {engine_name}")
            except Exception as e:
                logger.error(f"Error releasing resources for engine {engine_name}: {e}")
        
        # Clear instances
        self.engine_instances = {}


class CustomEngineLoader:
    """
    Helper class for loading custom engine implementations
    from Python modules or script files.
    """
    
    @staticmethod
    def load_from_module(module_path: str) -> List[Type[OCREngineInterface]]:
        """
        Load engine classes from a Python module
        
        Args:
            module_path: Path to the module
            
        Returns:
            List of engine classes
        """
        engines = []
        
        try:
            # Import the module
            module_name = os.path.basename(module_path)
            if module_name.endswith('.py'):
                module_name = module_name[:-3]
            
            # Add directory to path if needed
            module_dir = os.path.dirname(module_path)
            if module_dir not in sys.path:
                sys.path.append(module_dir)
            
            module = importlib.import_module(module_name)
            
            # Find engine classes
            for attr_name in dir(module):
                if attr_name.endswith('Engine'):
                    attr = getattr(module, attr_name)
                    
                    # Check if it's a class that implements OCREngineInterface
                    if (inspect.isclass(attr) and 
                        issubclass(attr, OCREngineInterface) and 
                        attr != OCREngineInterface):
                        
                        engines.append(attr)
            
            return engines
            
        except Exception as e:
            logger.error(f"Error loading engines from module {module_path}: {e}")
            return []
    
    @staticmethod
    def load_from_script(script_path: str) -> List[Type[OCREngineInterface]]:
        """
        Load engine classes from a Python script
        
        Args:
            script_path: Path to the script
            
        Returns:
            List of engine classes
        """
        # This is essentially the same as load_from_module
        return CustomEngineLoader.load_from_module(script_path)


class EngineAdapter(OCREngineInterface):
    """
    Base class for adapting third-party OCR libraries
    to the OCREngineInterface.
    """
    
    def __init__(self, engine_name: str, engine_version: str, model_type: ModelType):
        """
        Initialize the adapter
        
        Args:
            engine_name: Name of the engine
            engine_version: Version of the engine
            model_type: Type of model
        """
        self.engine_name = engine_name
        self.engine_version = engine_version
        self.model_type = model_type
        self.config = {}
        self.initialized = False
    
    def initialize(self, config: Dict[str, Any] = None) -> bool:
        """
        Initialize the engine with configuration
        
        Args:
            config: Configuration dictionary
            
        Returns:
            True if initialization succeeded, False otherwise
        """
        self.config = config or {}
        self.initialized = self._initialize_implementation()
        return self.initialized
    
    def get_metadata(self) -> EngineMetadata:
        """
        Get engine metadata
        
        Returns:
            EngineMetadata object
        """
        return EngineMetadata(
            name=self.engine_name,
            version=self.engine_version,
            model_type=self.model_type,
            description=self._get_description(),
            author=self._get_author(),
            repository=self._get_repository(),
            license=self._get_license(),
            requirements=self._get_requirements(),
            supported_formats=self._get_supported_formats(),
            supported_languages=self._get_supported_languages(),
            tags=self._get_tags(),
            performance_metrics=self._get_performance_metrics()
        )
    
    def process_document(self, document_path: str, options: Dict[str, Any] = None) -> EngineResult:
        """
        Process a document
        
        Args:
            document_path: Path to the document
            options: Processing options
            
        Returns:
            EngineResult object
        """
        if not self.initialized:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error="Engine not initialized"
            )
        
        # Validate file exists
        if not os.path.exists(document_path):
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Document not found: {document_path}"
            )
        
        # Validate file format
        file_format = os.path.splitext(document_path)[1].lower().lstrip('.')
        if not self.supports_format(file_format):
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=f"Unsupported file format: {file_format}"
            )
        
        # Process the document
        try:
            start_time = time.time()
            result = self._process_document_implementation(document_path, options or {})
            processing_time = time.time() - start_time
            
            # Add processing time and metadata
            result.processing_time = processing_time
            
            return result
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=str(e)
            )
    
    def process_image(self, image_data: Any, options: Dict[str, Any] = None) -> EngineResult:
        """
        Process an image
        
        Args:
            image_data: Image data
            options: Processing options
            
        Returns:
            EngineResult object
        """
        if not self.initialized:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error="Engine not initialized"
            )
        
        # Process the image
        try:
            start_time = time.time()
            result = self._process_image_implementation(image_data, options or {})
            processing_time = time.time() - start_time
            
            # Add processing time
            result.processing_time = processing_time
            
            return result
            
        except Exception as e:
            return EngineResult(
                engine_name=self.engine_name,
                success=False,
                result_type="error",
                data=None,
                error=str(e)
            )
    
    def supports_format(self, file_format: str) -> bool:
        """
        Check if the engine supports a file format
        
        Args:
            file_format: File format (extension)
            
        Returns:
            True if supported, False otherwise
        """
        return file_format.lower() in self._get_supported_formats()
    
    def release_resources(self):
        """Release any resources held by the engine"""
        self._release_resources_implementation()
        self.initialized = False
    
    # Protected methods to be overridden by subclasses
    
    def _initialize_implementation(self) -> bool:
        """
        Initialize the engine implementation
        
        Returns:
            True if initialization succeeded, False otherwise
        """
        # Default implementation - should be overridden
        return True
    
    def _process_document_implementation(self, document_path: str, options: Dict[str, Any]) -> EngineResult:
        """
        Process a document - implementation
        
        Args:
            document_path: Path to the document
            options: Processing options
            
        Returns:
            EngineResult object
        """
        # Default implementation - should be overridden
        return EngineResult(
            engine_name=self.engine_name,
            success=False,
            result_type="error",
            data=None,
            error="Not implemented"
        )
    
    def _process_image_implementation(self, image_data: Any, options: Dict[str, Any]) -> EngineResult:
        """
        Process an image - implementation
        
        Args:
            image_data: Image data
            options: Processing options
            
        Returns:
            EngineResult object
        """
        # Default implementation - should be overridden
        return EngineResult(
            engine_name=self.engine_name,
            success=False,
            result_type="error",
            data=None,
            error="Not implemented"
        )
    
    def _release_resources_implementation(self):
        """Release any resources held by the engine - implementation"""
        # Default implementation - should be overridden if needed
        pass
    
    def _get_description(self) -> str:
        """Get engine description"""
        return f"{self.engine_name} OCR Engine"
    
    def _get_author(self) -> str:
        """Get engine author"""
        return "Unknown"
    
    def _get_repository(self) -> str:
        """Get engine repository"""
        return ""
    
    def _get_license(self) -> str:
        """Get engine license"""
        return "Unknown"
    
    def _get_requirements(self) -> List[str]:
        """Get engine requirements"""
        return []
    
    def _get_supported_formats(self) -> List[str]:
        """Get supported file formats"""
        return ["pdf", "png", "jpg", "jpeg", "tiff", "tif", "bmp"]
    
    def _get_supported_languages(self) -> List[str]:
        """Get supported languages"""
        return ["eng"]
    
    def _get_tags(self) -> List[str]:
        """Get engine tags"""
        return [self.model_type.value, "ocr"]
    
    def _get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        return {}


class EnginePipeline:
    """
    Builds pipelines of OCR and document understanding engines
    for complex document processing flows.
    """
    
    def __init__(self, engine_manager: EngineManager):
        """
        Initialize the pipeline
        
        Args:
            engine_manager: EngineManager instance
        """
        self.engine_manager = engine_manager
        self.steps = []
        self.conditionals = []
    
    def add_step(self, engine_name: str, options: Dict[str, Any] = None, 
                 name: Optional[str] = None) -> 'EnginePipeline':
        """
        Add a processing step to the pipeline
        
        Args:
            engine_name: Name of the engine to use
            options: Processing options
            name: Optional name for the step
            
        Returns:
            Self for method chaining
        """
        step = {
            'engine_name': engine_name,
            'options': options or {},
            'name': name or f"step_{len(self.steps) + 1}"
        }
        
        self.steps.append(step)
        return self
    
    def add_conditional(self, condition: Callable[[Dict[str, Any]], bool], 
                       if_true: List[Dict[str, Any]], 
                       if_false: List[Dict[str, Any]] = None) -> 'EnginePipeline':
        """
        Add a conditional branch to the pipeline
        
        Args:
            condition: Function that takes the current state and returns a boolean
            if_true: Steps to execute if condition is True
            if_false: Steps to execute if condition is False
            
        Returns:
            Self for method chaining
        """
        conditional = {
            'condition': condition,
            'if_true': if_true,
            'if_false': if_false or []
        }
        
        self.conditionals.append(conditional)
        return self
    
    def process(self, document_path: str) -> Dict[str, Any]:
        """
        Process a document through the pipeline
        
        Args:
            document_path: Path to the document
            
        Returns:
            Dictionary with results from each step
        """
        # Initialize pipeline state
        state = {
            'document_path': document_path,
            'steps': {},
            'current_document': document_path,
            'success': True,
            'error': None
        }
        
        # Execute pipeline steps
        try:
            self._execute_steps(self.steps, state)
            return state
        except Exception as e:
            state['success'] = False
            state['error'] = str(e)
            return state
    
    def _execute_steps(self, steps: List[Dict[str, Any]], state: Dict[str, Any]):
        """
        Execute a list of pipeline steps
        
        Args:
            steps: List of step definitions
            state: Current pipeline state
        """
        for step in steps:
            step_name = step['name']
            engine_name = step['engine_name']
            options = step['options'].copy()
            
            # Check for conditionals
            if engine_name == 'conditional':
                condition_index = options.get('condition_index', 0)
                if condition_index < len(self.conditionals):
                    conditional = self.conditionals[condition_index]
                    
                    if conditional['condition'](state):
                        self._execute_steps(conditional['if_true'], state)
                    else:
                        self._execute_steps(conditional['if_false'], state)
                continue
            
            # Process document with the engine
            try:
                result = self.engine_manager.process_document(
                    state['current_document'], 
                    engine_name, 
                    options
                )
                
                # Store result in state
                state['steps'][step_name] = {
                    'engine_name': engine_name,
                    'success': result.success,
                    'result_type': result.result_type,
                    'confidence': result.confidence,
                    'processing_time': result.processing_time,
                    'error': result.error
                }
                
                # Store data if successful
                if result.success:
                    state['steps'][step_name]['data'] = result.data
                
                # Update current document if this step produced a new file
                if result.success and result.result_type == 'file' and isinstance(result.data, str):
                    state['current_document'] = result.data
                
                # Stop pipeline if step failed and it's required
                if not result.success and options.get('required', True):
                    state['success'] = False
                    state['error'] = f"Step {step_name} failed: {result.error}"
                    break
                    
            except Exception as e:
                state['steps'][step_name] = {
                    'engine_name': engine_name,
                    'success': False,
                    'error': str(e)
                }
                
                # Stop pipeline if step failed and it's required
                if options.get('required', True):
                    state['success'] = False
                    state['error'] = f"Step {step_name} failed with exception: {str(e)}"
                    break


def main():
    """Main entry point for command-line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Extensible Engine Manager")
    parser.add_argument('--list-engines', action='store_true', help='List available engines')
    parser.add_argument('--process', help='Process a document')
    parser.add_argument('--engine', help='Engine to use')
    parser.add_argument('--plugin-dir', help='Directory to load plugins from')
    
    args = parser.parse_args()
    
    # Configure engine manager
    config = {}
    if args.plugin_dir:
        config['plugin_directory'] = args.plugin_dir
    
    manager = EngineManager(config)
    
    # List engines
    if args.list_engines:
        engines = manager.get_available_engines()
        print(f"Available engines: {len(engines)}")
        
        for name, metadata in engines.items():
            print(f"  {name} (v{metadata.version}): {metadata.description}")
            print(f"    Type: {metadata.model_type.value}")
            print(f"    Formats: {', '.join(metadata.supported_formats)}")
            print(f"    Languages: {', '.join(metadata.supported_languages)}")
            print()
    
    # Process document
    if args.process:
        engine_name = args.engine
        
        print(f"Processing document: {args.process}")
        print(f"Using engine: {engine_name or 'default'}")
        
        result = manager.process_document(args.process, engine_name)
        
        print(f"Processing result:")
        print(f"  Success: {result.success}")
        print(f"  Engine: {result.engine_name}")
        print(f"  Processing time: {result.processing_time:.2f} seconds")
        
        if result.success:
            print(f"  Result type: {result.result_type}")
            print(f"  Confidence: {result.confidence:.2f}")
            
            # Print some result data depending on type
            if result.result_type == 'text':
                print(f"  Text length: {len(result.data)} characters")
                print(f"  Text sample: {result.data[:100]}...")
                
            elif result.result_type == 'elements':
                print(f"  Elements: {len(result.data)} items")
                
            elif result.result_type == 'file':
                print(f"  Output file: {result.data}")
                
        else:
            print(f"  Error: {result.error}")
    
    # Clean up
    manager.release_all_engines()


if __name__ == "__main__":
    main()