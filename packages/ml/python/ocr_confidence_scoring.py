#!/usr/bin/env python3
"""
OCR Confidence Scoring and Post-Processing Rules Engine

This module provides advanced capabilities for evaluating OCR quality and improving results:
1. Confidence scoring for extracted text with detailed metrics
2. Rule-based post-processing for domain-specific corrections
3. Statistical analysis of OCR quality
4. Customizable rules engine for different material types
5. Feedback integration for continuous improvement

Usage:
    python ocr_confidence_scoring.py <input_file> [options]

Arguments:
    input_file    Path to the OCR result file (JSON)
    
Options:
    --output-file       Path to save enhanced OCR results
    --rules-file        JSON file containing post-processing rules
    --domain            Domain for specialized rules (tile, stone, wood)
    --min-confidence    Minimum confidence threshold (0-100)
    --detailed-metrics  Generate detailed confidence metrics
"""

import os
import sys
import json
import re
import argparse
import numpy as np
from typing import Dict, List, Any, Tuple, Optional, Union
import logging
from pathlib import Path
import difflib
import enchant
from collections import Counter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Language dictionaries for spell checking
SUPPORTED_LANGUAGES = {
    'eng': 'en_US',
    'fra': 'fr_FR',
    'deu': 'de_DE',
    'spa': 'es_ES',
    'ita': 'it_IT',
    'por': 'pt_PT',
    'nld': 'nl_NL',
    'rus': 'ru_RU',
    'pol': 'pl_PL',
    'swe': 'sv_SE',
    'dan': 'da_DK',
    'ces': 'cs_CZ',
    'hun': 'hu_HU',
    'ron': 'ro_RO',
    'fin': 'fi_FI',
    'ell': 'el_GR',
    'tur': 'tr_TR',
    'jpn': 'ja_JP',
    'kor': 'ko_KR',
    'chi_sim': 'zh_CN',
    'chi_tra': 'zh_TW',
    'ara': 'ar',
    'hin': 'hi_IN',
    'vie': 'vi_VN',
    'ukr': 'uk_UA',
    'heb': 'he_IL'
}

# Initialize dictionaries
lang_dicts = {}
try:
    # Initialize English as default
    lang_dicts['eng'] = enchant.Dict("en_US")
    
    # Try to load other languages if available
    for lang_code, enchant_code in SUPPORTED_LANGUAGES.items():
        try:
            if lang_code != 'eng':  # Already loaded English
                lang_dicts[lang_code] = enchant.Dict(enchant_code)
        except Exception:
            logger.debug(f"Dictionary for {lang_code} ({enchant_code}) not available")
            
except ImportError:
    # Create a simple spell checker if pyenchant is not available
    logger.warning("PyEnchant not available. Using simplified spell checking.")
    lang_dicts = None


class OCRConfidenceScorer:
    """Class for evaluating OCR quality and improving results"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the OCR confidence scorer
        
        Args:
            config: Configuration dictionary with settings
        """
        self.config = {
            'min_confidence': 0.6,
            'detailed_metrics': True,
            'spellcheck_enabled': True,
            'domain': 'general',
            'language': 'eng',  # Default language is English
            'multi_language_support': True,  # Enable multi-language support
            'language_detection': True,  # Auto-detect language from content
            'visualization_enabled': True,  # Enable confidence visualization
            'rule_weights': {
                'char_confidence': 0.3,
                'word_recognition': 0.2,
                'context_consistency': 0.15,
                'language_model': 0.2,
                'domain_specific': 0.15
            },
            'common_substitutions': {
                '0': 'O',
                'O': '0',
                '1': 'l',
                'l': '1',
                '5': 'S',
                'S': '5',
                '8': 'B',
                'B': '8',
                'rn': 'm',
                'cl': 'd',
                'vv': 'w',
                'I1': 'H'
            },
            'character_classes': {
                'numeric': r'[0-9]',
                'lowercase': r'[a-z]',
                'uppercase': r'[A-Z]',
                'punctuation': r'[.,;:!?]',
                'symbols': r'[\/\-+*&%$#@]'
            }
        }
        
        if config:
            self.config.update(config)
        
        # Load domain-specific dictionaries and rules
        self.domain_dict = self._load_domain_dictionary(self.config['domain'])
        self.rules = self._load_post_processing_rules(self.config['domain'])
    
    def _load_domain_dictionary(self, domain: str) -> Dict[str, float]:
        """
        Load domain-specific dictionary with term weights
        
        Args:
            domain: Domain type (tile, stone, wood, etc.)
            
        Returns:
            Dictionary of domain-specific terms with weights
        """
        # Default empty dictionary
        domain_dict = {}
        
        # Define common domain-specific terms for materials
        if domain == 'tile':
            domain_dict = {
                # Dimensions and measurements
                'mm': 1.0, 'cm': 1.0, 'inches': 0.9, 'in': 0.9, 'x': 0.9, 
                # Material types
                'porcelain': 1.0, 'ceramic': 1.0, 'glazed': 0.9, 'unglazed': 0.9,
                'terracotta': 0.9, 'mosaic': 0.9, 'subway': 0.8,
                # Technical properties
                'pei': 1.0, 'r9': 1.0, 'r10': 1.0, 'r11': 1.0, 'r12': 1.0,
                'frost': 0.9, 'resistant': 0.9, 'slip': 0.9, 'water': 0.9, 
                'absorption': 0.9, 'mohs': 0.9, 'rating': 0.8, 'class': 0.8,
                # Finishes
                'matte': 1.0, 'matt': 1.0, 'polished': 1.0, 'glossy': 1.0, 
                'textured': 1.0, 'structured': 0.9, 'lappato': 1.0, 'satin': 0.9,
                'honed': 0.9, 'natural': 0.8
            }
        elif domain == 'stone':
            domain_dict = {
                # Stone types
                'marble': 1.0, 'granite': 1.0, 'limestone': 1.0, 'travertine': 1.0,
                'slate': 1.0, 'quartzite': 1.0, 'sandstone': 1.0, 'soapstone': 1.0,
                'onyx': 1.0, 'basalt': 0.9,
                # Technical properties
                'density': 0.9, 'absorption': 0.9, 'porosity': 0.9, 'flexural': 0.9,
                'strength': 0.9, 'hardness': 0.9, 'mohs': 1.0, 'thermal': 0.9,
                # Finishes
                'polished': 1.0, 'honed': 1.0, 'flamed': 1.0, 'brushed': 1.0,
                'tumbled': 1.0, 'antiqued': 0.9, 'leathered': 1.0, 'bush-hammered': 1.0
            }
        elif domain == 'wood':
            domain_dict = {
                # Wood types
                'oak': 1.0, 'maple': 1.0, 'walnut': 1.0, 'pine': 1.0, 'cherry': 1.0,
                'hickory': 1.0, 'birch': 1.0, 'ash': 1.0, 'mahogany': 1.0, 'teak': 1.0,
                'bamboo': 1.0, 'engineered': 1.0, 'solid': 1.0, 'laminate': 1.0,
                # Technical properties
                'hardness': 0.9, 'janka': 1.0, 'moisture': 0.9, 'content': 0.8,
                'construction': 0.9, 'grain': 0.9, 'grade': 0.9,
                # Finishes
                'unfinished': 1.0, 'prefinished': 1.0, 'oiled': 1.0, 'stained': 1.0,
                'hand-scraped': 1.0, 'wire-brushed': 1.0, 'distressed': 1.0
            }
        
        return domain_dict
    
    def _load_post_processing_rules(self, domain: str) -> List[Dict[str, Any]]:
        """
        Load post-processing rules for a specific domain
        
        Args:
            domain: Domain type (tile, stone, wood, etc.)
            
        Returns:
            List of post-processing rules
        """
        # Common rules for all domains
        common_rules = [
            # Remove excessive whitespace
            {
                'pattern': r'\s+',
                'replacement': ' ',
                'description': 'Normalize whitespace',
                'priority': 1
            },
            # Fix common dimension format issues
            {
                'pattern': r'(\d+)\s*[xX×]\s*(\d+)',
                'replacement': r'\1×\2',
                'description': 'Normalize dimension format',
                'priority': 2
            },
            # Fix common OCR errors for units
            {
                'pattern': r'(\d+)(\s*)(rnm|mrn)',
                'replacement': r'\1\2mm',
                'description': 'Fix mm unit',
                'priority': 2
            },
            {
                'pattern': r'(\d+)(\s*)(crn)',
                'replacement': r'\1\2cm',
                'description': 'Fix cm unit',
                'priority': 2
            },
            # Fix punctuation spacing
            {
                'pattern': r'\s+([.,;:!?])',
                'replacement': r'\1',
                'description': 'Fix punctuation spacing',
                'priority': 1
            }
        ]
        
        # Domain-specific rules
        domain_rules = []
        
        if domain == 'tile':
            domain_rules = [
                # Fix PEI ratings
                {
                    'pattern': r'PE\s*[l1I|]\s*[l1I|]',
                    'replacement': 'PEI II',
                    'description': 'Fix PEI II format',
                    'priority': 3
                },
                {
                    'pattern': r'PE\s*[l1I|]\s*[l1I|]\s*[l1I|]',
                    'replacement': 'PEI III',
                    'description': 'Fix PEI III format',
                    'priority': 3
                },
                # Fix slip resistance ratings
                {
                    'pattern': r'[B8]\s*[l1I|][O0]?',
                    'replacement': 'R10',
                    'description': 'Fix R10 rating',
                    'priority': 3
                },
                {
                    'pattern': r'[B8]\s*[l1I|][l1I|]',
                    'replacement': 'R11',
                    'description': 'Fix R11 rating',
                    'priority': 3
                },
                {
                    'pattern': r'[B8]\s*9',
                    'replacement': 'R9',
                    'description': 'Fix R9 rating',
                    'priority': 3
                }
            ]
        elif domain == 'stone':
            domain_rules = [
                # Fix hardness scales
                {
                    'pattern': r'rnohs',
                    'replacement': 'mohs',
                    'description': 'Fix Mohs hardness scale',
                    'priority': 3
                },
                {
                    'pattern': r'([l1I|])\s*-\s*[l1I|][O0]',
                    'replacement': 'I-10',
                    'description': 'Fix I-10 scale',
                    'priority': 3
                }
            ]
        elif domain == 'wood':
            domain_rules = [
                # Fix Janka hardness scale
                {
                    'pattern': r'[jJ]anka\s*:?\s*(\d+)',
                    'replacement': r'Janka: \1',
                    'description': 'Fix Janka hardness format',
                    'priority': 3
                },
                # Fix wood grade formats
                {
                    'pattern': r'[gG]rade\s*:?\s*([ABC])[/&+]([ABC])',
                    'replacement': r'Grade: \1/\2',
                    'description': 'Fix wood grade format',
                    'priority': 3
                }
            ]
        
        # Combine rules and sort by priority
        all_rules = common_rules + domain_rules
        all_rules.sort(key=lambda r: r['priority'], reverse=True)
        
        return all_rules
    
    def process_ocr_results(self, ocr_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process OCR results to improve quality and provide confidence metrics
        
        Args:
            ocr_data: Dictionary containing OCR results
            
        Returns:
            Enhanced OCR results with confidence metrics
        """
        if not ocr_data:
            return {"error": "No OCR data provided"}
        
        # Extract text elements from OCR data
        text_elements = self._extract_text_elements(ocr_data)
        
        # Process each text element
        processed_elements = []
        
        for element in text_elements:
            # Calculate detailed confidence metrics
            confidence_metrics = self._calculate_confidence_metrics(element)
            
            # Apply post-processing rules
            processed_text = self._apply_post_processing_rules(element['text'])
            
            # Update element
            processed_element = {
                'text': processed_text,
                'original_text': element.get('text', ''),
                'confidence': confidence_metrics['overall_confidence'],
                'metrics': confidence_metrics,
                'page': element.get('page', 1),
                'bbox': element.get('bbox', None),
                'type': element.get('type', 'text')
            }
            
            processed_elements.append(processed_element)
        
        # Calculate document-level statistics
        doc_stats = self._calculate_document_statistics(processed_elements)
        
        # Create processed result
        result = {
            'processed_elements': processed_elements,
            'statistics': doc_stats,
            'processing_config': self.config,
            'rules_applied': [rule['description'] for rule in self.rules]
        }
        
        # Copy over document metadata if available
        if 'metadata' in ocr_data:
            result['metadata'] = ocr_data['metadata']
        
        return result
    
    def _extract_text_elements(self, ocr_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract text elements from OCR data
        
        Args:
            ocr_data: Dictionary containing OCR results
            
        Returns:
            List of text elements
        """
        text_elements = []
        
        # Handle different OCR result formats
        
        # Format 1: List of regions with text
        if 'regions' in ocr_data:
            for region in ocr_data['regions']:
                if 'text' in region:
                    text_elements.append(region)
        
        # Format 2: List of text blocks
        elif 'text_blocks' in ocr_data:
            text_elements.extend(ocr_data['text_blocks'])
        
        # Format 3: Plain text with confidence
        elif 'text' in ocr_data and 'confidence' in ocr_data:
            text_elements.append(ocr_data)
        
        # Format 4: Text by page
        elif 'pages' in ocr_data:
            for page in ocr_data['pages']:
                if 'text_blocks' in page:
                    for block in page['text_blocks']:
                        block['page'] = page.get('page_number', 1)
                        text_elements.append(block)
        
        # If still no text elements, try to find any text fields
        if not text_elements:
            for key, value in ocr_data.items():
                if isinstance(value, str) and len(value) > 5:
                    text_elements.append({
                        'text': value,
                        'confidence': 0.8,  # Default confidence
                        'type': 'text'
                    })
                elif isinstance(value, dict) and 'text' in value:
                    text_elements.append(value)
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict) and 'text' in item:
                            text_elements.append(item)
        
        return text_elements
    
    def _calculate_confidence_metrics(self, element: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate detailed confidence metrics for a text element with multi-language support
        
        Args:
            element: Text element dictionary
            
        Returns:
            Dictionary with confidence metrics
        """
        text = element.get('text', '')
        base_confidence = element.get('confidence', 0.8)
        language = element.get('language', self.config['language'])
        
        # Skip empty text
        if not text:
            return {
                'overall_confidence': 0.0,
                'character_confidence': 0.0,
                'word_recognition_confidence': 0.0,
                'context_consistency': 0.0,
                'language_model_confidence': 0.0,
                'domain_specific_confidence': 0.0,
                'detected_language': None
            }
        
        # Detect language if enabled
        detected_language = None
        if self.config['multi_language_support'] and self.config['language_detection']:
            detected_language = self._detect_language(text)
            if detected_language:
                language = detected_language
        
        # 1. Character-level confidence (if available in element)
        char_confidence = base_confidence
        if 'char_confidences' in element:
            char_confidence = sum(element['char_confidences']) / len(element['char_confidences'])
        
        # 2. Word recognition confidence with multi-language support
        words = text.split()
        word_confidence = 0.0
        
        if self.config['spellcheck_enabled'] and words:
            correct_words = 0
            
            # Get appropriate dictionary
            spell_dict = lang_dicts.get(language) if lang_dicts else None
            
            for word in words:
                # Skip numbers and short words
                if word.isdigit() or len(word) <= 2:
                    correct_words += 1
                    continue
                
                # Check if word is in appropriate dictionary
                if spell_dict and spell_dict.check(word):
                    correct_words += 1
                # Try English as fallback
                elif language != 'eng' and 'eng' in lang_dicts and lang_dicts['eng'].check(word):
                    correct_words += 1
                # Check if word is in domain dictionary
                elif word.lower() in self.domain_dict:
                    correct_words += 1
            
            word_confidence = correct_words / len(words)
        else:
            word_confidence = base_confidence
        
        # 3. Context consistency confidence (adjusted for language characteristics)
        context_confidence = self._calculate_context_consistency(text, language)
        
        # 4. Language model confidence (adjusted for detected language)
        lang_confidence = self._calculate_language_model_confidence(text, language)
        
        # 5. Domain-specific confidence
        domain_confidence = self._calculate_domain_confidence(text)
        
        # Calculate overall confidence using weighted average
        weights = self.config['rule_weights']
        overall_confidence = (
            weights['char_confidence'] * char_confidence +
            weights['word_recognition'] * word_confidence +
            weights['context_consistency'] * context_confidence +
            weights['language_model'] * lang_confidence +
            weights['domain_specific'] * domain_confidence
        )
        
        # Cap confidence at 1.0
        overall_confidence = min(1.0, overall_confidence)
        
        # Create detailed confidence metrics
        confidence_metrics = {
            'overall_confidence': overall_confidence,
            'character_confidence': char_confidence,
            'word_recognition_confidence': word_confidence,
            'context_consistency': context_confidence,
            'language_model_confidence': lang_confidence,
            'domain_specific_confidence': domain_confidence,
            'detected_language': language,
            'language_name': SUPPORTED_LANGUAGES.get(language, 'Unknown'),
            'confidence_level': self._get_confidence_level(overall_confidence),
            'reliability': self._calculate_reliability_score(
                char_confidence, word_confidence, context_confidence,
                lang_confidence, domain_confidence, language
            )
        }
        
        return confidence_metrics
    
    def _detect_language(self, text: str) -> Optional[str]:
        """
        Detect the language of a text
        
        Args:
            text: Text to analyze
            
        Returns:
            Language code or None if detection failed
        """
        # Skip if text is too short
        if len(text) < 20:
            return None
            
        try:
            import langdetect
            
            # Detect language
            lang_code = langdetect.detect(text)
            
            # Map detected language to supported languages
            for tesseract_code, enchant_code in SUPPORTED_LANGUAGES.items():
                if enchant_code.lower().startswith(lang_code):
                    return tesseract_code
                    
            return None
            
        except Exception:
            logger.debug("Language detection failed")
            return None
    
    def _calculate_context_consistency(self, text: str, language: str = 'eng') -> float:
        """
        Calculate context consistency confidence
        
        Args:
            text: Text to analyze
            
        Returns:
            Context consistency confidence score
        """
        # If text is too short, return medium confidence
        if len(text) < 10:
            return 0.7
        
        # Split into words
        words = text.split()
        
        # Check character class consistency within words
        class_consistency = 0.0
        if words:
            consistent_words = 0
            
            for word in words:
                # Skip short words
                if len(word) <= 2:
                    consistent_words += 1
                    continue
                
                # Check character classes in word
                classes = set()
                for char in word:
                    for class_name, pattern in self.config['character_classes'].items():
                        if re.match(pattern, char):
                            classes.add(class_name)
                
                # Words with 1-2 character classes are more likely to be correct
                if len(classes) <= 2:
                    consistent_words += 1
            
            class_consistency = consistent_words / len(words)
        
        # Check for unusual character sequences
        unusual_patterns = [
            r'[a-z][A-Z]',  # lowercase followed by uppercase
            r'[A-Za-z][0-9][A-Za-z]',  # letter-digit-letter
            r'[.,;:]{2,}'  # consecutive punctuation
        ]
        
        pattern_confidence = 1.0
        for pattern in unusual_patterns:
            matches = re.findall(pattern, text)
            if matches:
                pattern_confidence *= 0.9  # Reduce confidence for each pattern found
        
        # Combine metrics
        return (class_consistency * 0.7 + pattern_confidence * 0.3)
    
    def _get_confidence_level(self, confidence: float) -> str:
        """
        Get a human-readable confidence level from a confidence score
        
        Args:
            confidence: Confidence score (0-1)
            
        Returns:
            Confidence level string
        """
        if confidence >= 0.9:
            return "Very High"
        elif confidence >= 0.8:
            return "High"
        elif confidence >= 0.7:
            return "Good"
        elif confidence >= 0.6:
            return "Moderate"
        elif confidence >= 0.4:
            return "Low"
        else:
            return "Very Low"
    
    def _calculate_reliability_score(self, char_conf: float, word_conf: float, 
                                    context_conf: float, lang_conf: float, 
                                    domain_conf: float, language: str) -> Dict[str, Any]:
        """
        Calculate comprehensive reliability metrics for OCR results
        
        Args:
            char_conf: Character-level confidence
            word_conf: Word recognition confidence
            context_conf: Context consistency confidence
            lang_conf: Language model confidence
            domain_conf: Domain-specific confidence
            language: Detected language code
            
        Returns:
            Dictionary with reliability metrics
        """
        # Calculate combined reliability score
        reliability_score = (char_conf * 0.25 + word_conf * 0.30 + 
                           context_conf * 0.15 + lang_conf * 0.15 + domain_conf * 0.15)
        
        # Adjust for non-Latin languages which may have different character recognition challenges
        non_latin_languages = ['ara', 'heb', 'jpn', 'kor', 'chi_sim', 'chi_tra', 'hin']
        if language in non_latin_languages:
            # Reduce weight of word recognition for non-Latin languages 
            # due to different word boundaries and script complexity
            adjusted_score = (char_conf * 0.35 + word_conf * 0.15 + 
                            context_conf * 0.20 + lang_conf * 0.15 + domain_conf * 0.15)
            reliability_score = (reliability_score + adjusted_score) / 2
        
        # Generate per-factor reliability ratings
        factor_ratings = {
            "character_recognition": self._get_confidence_level(char_conf),
            "word_recognition": self._get_confidence_level(word_conf),
            "context_consistency": self._get_confidence_level(context_conf),
            "language_model": self._get_confidence_level(lang_conf),
            "domain_specific": self._get_confidence_level(domain_conf)
        }
        
        # Generate overall reliability
        overall_reliability = {
            "score": reliability_score,
            "level": self._get_confidence_level(reliability_score),
            "factor_ratings": factor_ratings,
            "language_specific_adjustments": language not in non_latin_languages
        }
        
        return overall_reliability
    
    def _calculate_language_model_confidence(self, text: str, language: str = 'eng') -> float:
        """
        Calculate language model confidence with multi-language support
        
        Args:
            text: Text to analyze
            language: Language code
            
        Returns:
            Language model confidence score
        """
        # Skip if text is too short
        if len(text) < 10:
            return 0.7
        
        # Handle different language families differently
        latin_script = ['eng', 'fra', 'deu', 'spa', 'ita', 'por', 'nld', 'dan', 'swe', 'fin', 'ces', 'hun', 'pol', 'ron']
        cyrillic_script = ['rus', 'ukr']
        asian_script = ['jpn', 'kor', 'chi_sim', 'chi_tra']
        rtl_script = ['ara', 'heb']
        
        # Split into words for languages with clear word boundaries
        if language in latin_script or language in cyrillic_script:
            words = text.lower().split()
            
            # Skip if too few words
            if len(words) < 3:
                return 0.7
            
            # Common bigrams by language family
            common_bigrams = []
            
            if language in latin_script:
                # English and other Latin-script languages
                if language == 'eng':
                    common_bigrams = [
                        "of the", "in the", "to the", "on the", "for the",
                        "with the", "at the", "from the", "by the", "as the",
                        "is a", "is the", "for a", "with a", "on a",
                        "to be", "can be", "will be", "has been", "have been"
                    ]
                elif language in ['fra', 'ita', 'por', 'spa']:
                    # Romance languages
                    common_bigrams = [
                        "de la", "dans le", "pour le", "sur le", "avec le",
                        "est un", "est une", "de los", "en el", "con la",
                        "della", "nella", "sono", "para", "como"
                    ]
                elif language in ['deu', 'nld']:
                    # Germanic languages
                    common_bigrams = [
                        "in der", "auf der", "mit dem", "von dem", "ist ein",
                        "ist eine", "kann sein", "wird sein", "hat ein"
                    ]
                else:
                    # Default Latin script bigrams as fallback
                    common_bigrams = [
                        "in the", "of the", "on the", "with the", "for the",
                        "is a", "is the", "to be", "can be", "will be"
                    ]
                    
            elif language in cyrillic_script:
                # Russian and Ukrainian
                common_bigrams = [
                    "в", "на", "с", "для", "из", "по", "от", "к", "о"
                ]
            
            # Count bigrams in text
            bigram_count = 0
            for i in range(len(words) - 1):
                bigram = f"{words[i]} {words[i+1]}"
                if bigram in common_bigrams:
                    bigram_count += 1
                # Also check if either word is in bigram list (for languages like Russian)
                elif words[i] in common_bigrams or words[i+1] in common_bigrams:
                    bigram_count += 0.5
            
            # Calculate bigram ratio
            max_possible_bigrams = len(words) - 1
            bigram_ratio = bigram_count / max_possible_bigrams if max_possible_bigrams > 0 else 0
            
            # Text with more common bigrams is more likely to be correct
            return 0.6 + (bigram_ratio * 0.4)  # Base confidence of 0.6, up to 0.4 additional
            
        # For character-based languages without clear word boundaries
        elif language in asian_script:
            # Count common characters instead of bigrams for Asian languages
            # Simplified implementation - a real system would use language-specific models
            
            # Common character patterns
            if language == 'chi_sim' or language == 'chi_tra':
                # Common Chinese characters that often appear in formal documents
                common_chars = "的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价严首底液官德调随病苏失尔死讲配女黄推显谈罪神艺呢席含企望密批营项防举球英氧势告李台落木帮轮破亚师围注远字材排供河态封另施减树溶怎止案言士均武固叶鱼波视仅费紧爱左章早朝害续轻服试食充兵源判护司足某练差致板田降黑犯负击范继兴似余坚曲输修的故城夫够送笑船占右财吃富春职觉汉画功巴跟虽杂飞检吸助升阳互初创抗考投坏策古径换未跑留钢曾端责站简述钱副尽帝射草冲承独令限阿宣环双请超微让控州良轴找否纪益依优顶础载倒房突坐粉敌略客袁冷胜绝析块剂测丝协重诉念陈仍罗盐友洋错苦夜刑移频逐靠混母短皮终聚汽村云哪既距卫停烈央察烧迅行境若印洲刻括激孔搞甚室待核校散侵句征味护壳志扬忽股探"`马午。，：；？！"""
                
                # Count common characters and calculate density
                common_count = sum(1 for char in text if char in common_chars)
                char_density = common_count / max(1, len(text))
                
                # Return confidence based on character density
                return 0.5 + (char_density * 0.5) 
                
            elif language == 'jpn':
                # Common Japanese characters
                common_chars = "のはをにたがでしいるもあるからなとでこめくをにまざはよれつそじちかけふぬむゆゐせえてねへめれすうゅうりおきゃょっあいうえおパピプペポカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワガギグゲゴザジズゼゾダヂヅデドバビブベボァィゥェォャュョッ「」。、・"
                
                # Count common characters and calculate density
                common_count = sum(1 for char in text if char in common_chars)
                char_density = common_count / max(1, len(text))
                
                # Return confidence based on character density
                return 0.5 + (char_density * 0.5) 
                
            elif language == 'kor':
                # For Korean, check for Hangul character distribution
                hangul_chars = [chr(c) for c in range(0xAC00, 0xD7A4)]
                
                # Count Hangul characters and calculate density
                hangul_count = sum(1 for char in text if char in hangul_chars)
                char_density = hangul_count / max(1, len(text))
                
                # Return confidence based on character density
                return 0.5 + (char_density * 0.5)
                
        # For right-to-left languages
        elif language in rtl_script:
            # Check for appropriate character sets
            if language == 'ara':
                # Arabic characters
                arabic_chars = "ابتثجحخدذرزسشصضطظعغفقكلمنهويءآأؤإئةَُِّْٰىًٌٍ٠١٢٣٤٥٦٧٨٩"
                
                # Count Arabic characters and calculate density
                arabic_count = sum(1 for char in text if char in arabic_chars)
                char_density = arabic_count / max(1, len(text))
                
                # Return confidence based on character density  
                return 0.5 + (char_density * 0.5)
                
            elif language == 'heb':
                # Hebrew characters
                hebrew_chars = "אבגדהוזחטיכךלמםנןסעפףצץקרשת"
                
                # Count Hebrew characters and calculate density
                hebrew_count = sum(1 for char in text if char in hebrew_chars)
                char_density = hebrew_count / max(1, len(text))
                
                # Return confidence based on character density
                return 0.5 + (char_density * 0.5)
        
        # Default fallback for unsupported languages
        return 0.65
    
    def _calculate_domain_confidence(self, text: str) -> float:
        """
        Calculate domain-specific confidence
        
        Args:
            text: Text to analyze
            
        Returns:
            Domain-specific confidence score
        """
        # If no domain dictionary, use medium confidence
        if not self.domain_dict:
            return 0.7
        
        # Split into words
        words = text.lower().split()
        
        # Skip if too few words
        if not words:
            return 0.7
        
        # Count domain-specific terms
        domain_term_count = 0
        domain_term_weight = 0.0
        
        for word in words:
            if word in self.domain_dict:
                domain_term_count += 1
                domain_term_weight += self.domain_dict[word]
        
        # Calculate domain term ratio
        domain_ratio = domain_term_count / len(words)
        
        # Calculate weighted confidence
        term_weight_avg = domain_term_weight / len(words) if domain_term_count > 0 else 0
        
        # Text with more domain-specific terms is more likely to be correct in context
        return 0.6 + (domain_ratio * 0.2) + (term_weight_avg * 0.2)
    
    def _apply_post_processing_rules(self, text: str) -> str:
        """
        Apply post-processing rules to improve text
        
        Args:
            text: Text to process
            
        Returns:
            Processed text
        """
        if not text:
            return ""
        
        processed_text = text
        
        # Apply each rule in order
        for rule in self.rules:
            pattern = rule['pattern']
            replacement = rule['replacement']
            
            # Apply the rule
            processed_text = re.sub(pattern, replacement, processed_text)
        
        # Apply spell checking corrections for domain-specific terms
        if self.config['spellcheck_enabled']:
            words = processed_text.split()
            corrected_words = []
            
            for word in words:
                # Skip short words, numbers, and punctuation
                if len(word) <= 2 or word.isdigit() or re.match(r'^[.,;:!?]+$', word):
                    corrected_words.append(word)
                    continue
                
                # Check if word is in domain dictionary
                if word.lower() in self.domain_dict:
                    corrected_words.append(word)
                    continue
                
                # Simple spell check
                if english_dict and not english_dict.check(word):
                    # Get suggestions
                    suggestions = english_dict.suggest(word)
                    
                    # Use closest suggestion if available
                    if suggestions:
                        # Check for close match
                        match = difflib.get_close_matches(word, suggestions, n=1, cutoff=0.8)
                        if match:
                            corrected_words.append(match[0])
                            continue
                
                corrected_words.append(word)
            
            processed_text = ' '.join(corrected_words)
        
        # Check for known material property patterns
        processed_text = self._fix_material_properties(processed_text)
        
        return processed_text
    
    def _fix_material_properties(self, text: str) -> str:
        """
        Apply corrections to common material property patterns
        
        Args:
            text: Text to process
            
        Returns:
            Processed text
        """
        # Format depends on domain
        domain = self.config['domain']
        
        if domain == 'tile':
            # Fix dimension patterns
            text = re.sub(r'(\d+)\s*[xX×]\s*(\d+)(\s*)(mm|cm)?', r'\1×\2\3\4', text)
            
            # Fix PEI ratings
            text = re.sub(r'PEI\s+([I1-5]+)', r'PEI \1', text)
            
            # Fix slip resistance ratings
            text = re.sub(r'(?i)slip\s+resistance\s*:?\s*R?(\d+)', r'Slip Resistance: R\1', text)
            
        elif domain == 'stone':
            # Fix density values
            text = re.sub(r'(?i)density\s*:?\s*(\d+\.?\d*)', r'Density: \1', text)
            
            # Fix absorption values
            text = re.sub(r'(?i)absorption\s*:?\s*(\d+\.?\d*)', r'Absorption: \1', text)
            
        elif domain == 'wood':
            # Fix moisture content values
            text = re.sub(r'(?i)moisture\s*:?\s*(\d+\.?\d*)%?', r'Moisture: \1%', text)
            
            # Fix plank dimensions
            text = re.sub(r'(\d+)\s*[xX×]\s*(\d+)\s*[xX×]\s*(\d+)(\s*)(mm|cm)?', r'\1×\2×\3\4\5', text)
        
        return text
    
    def _calculate_document_statistics(self, elements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate document-level statistics
        
        Args:
            elements: List of processed text elements
            
        Returns:
            Dictionary with document statistics
        """
        if not elements:
            return {
                'element_count': 0,
                'average_confidence': 0,
                'confidence_distribution': {},
                'word_count': 0,
                'character_count': 0
            }
        
        # Calculate basic statistics
        confidences = [e['confidence'] for e in elements]
        avg_confidence = sum(confidences) / len(confidences)
        
        # Count words and characters
        total_words = 0
        total_chars = 0
        
        for element in elements:
            text = element['text']
            words = text.split()
            total_words += len(words)
            total_chars += len(text)
        
        # Create confidence distribution
        confidence_ranges = {
            'high (>0.9)': 0,
            'medium (0.7-0.9)': 0,
            'low (0.5-0.7)': 0,
            'very low (<0.5)': 0
        }
        
        for conf in confidences:
            if conf > 0.9:
                confidence_ranges['high (>0.9)'] += 1
            elif conf > 0.7:
                confidence_ranges['medium (0.7-0.9)'] += 1
            elif conf > 0.5:
                confidence_ranges['low (0.5-0.7)'] += 1
            else:
                confidence_ranges['very low (<0.5)'] += 1
        
        # Convert to percentages
        for key in confidence_ranges:
            confidence_ranges[key] = confidence_ranges[key] / len(elements)
        
        # Calculate improvement statistics
        changed_elements = [e for e in elements if e['text'] != e['original_text']]
        improvement_rate = len(changed_elements) / len(elements)
        
        return {
            'element_count': len(elements),
            'average_confidence': avg_confidence,
            'confidence_distribution': confidence_ranges,
            'word_count': total_words,
            'character_count': total_chars,
            'improvement_rate': improvement_rate,
            'elements_improved': len(changed_elements)
        }
    
    def save_results(self, results: Dict[str, Any], output_path: str):
        """
        Save processed results to a file
        
        Args:
            results: Processing results
            output_path: Path to save results
        """
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Save as JSON
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Results saved to {output_path}")


class RulesEngine:
    """Class implementing a rules engine for OCR post-processing"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        Initialize the rules engine
        
        Args:
            config: Configuration dictionary with settings
        """
        self.config = {
            'domain': 'general',
            'rules_file': None,
            'user_rules_enabled': True,
            'system_rules_enabled': True,
            'case_sensitive': False,
            'max_iterations': 3
        }
        
        if config:
            self.config.update(config)
        
        # Load rules
        self.rules = []
        
        # System rules
        if self.config['system_rules_enabled']:
            self.rules.extend(self._load_system_rules())
        
        # User rules from file
        if self.config['user_rules_enabled'] and self.config['rules_file']:
            self.rules.extend(self._load_user_rules(self.config['rules_file']))
    
    def _load_system_rules(self) -> List[Dict[str, Any]]:
        """
        Load system-defined rules
        
        Returns:
            List of rules
        """
        # Start with common rules
        common_rules = [
            {
                'id': 'whitespace_normalize',
                'pattern': r'\s+',
                'replacement': ' ',
                'description': 'Normalize whitespace',
                'enabled': True,
                'priority': 1
            },
            {
                'id': 'trailing_whitespace',
                'pattern': r'^\s+|\s+$',
                'replacement': '',
                'description': 'Remove trailing whitespace',
                'enabled': True,
                'priority': 1
            },
            {
                'id': 'punctuation_spacing',
                'pattern': r'\s+([.,;:!?])',
                'replacement': r'\1',
                'description': 'Fix punctuation spacing',
                'enabled': True,
                'priority': 1
            }
        ]
        
        # Add domain-specific rules
        domain_rules = []
        
        domain = self.config['domain']
        if domain == 'tile':
            domain_rules = [
                {
                    'id': 'tile_dimension_format',
                    'pattern': r'(\d+)\s*[xX×]\s*(\d+)',
                    'replacement': r'\1×\2',
                    'description': 'Normalize tile dimension format',
                    'enabled': True,
                    'priority': 2
                },
                {
                    'id': 'tile_measure_units',
                    'pattern': r'(\d+)(\s*)(rnm|mrn)',
                    'replacement': r'\1\2mm',
                    'description': 'Fix mm unit for tiles',
                    'enabled': True,
                    'priority': 2
                }
            ]
        elif domain == 'stone':
            domain_rules = [
                {
                    'id': 'stone_density_format',
                    'pattern': r'([Dd]ensity)\s*:?\s*(\d+\.?\d*)',
                    'replacement': r'Density: \2',
                    'description': 'Normalize stone density format',
                    'enabled': True,
                    'priority': 2
                }
            ]
        elif domain == 'wood':
            domain_rules = [
                {
                    'id': 'wood_dimension_format',
                    'pattern': r'(\d+)\s*[xX×]\s*(\d+)\s*[xX×]\s*(\d+)',
                    'replacement': r'\1×\2×\3',
                    'description': 'Normalize wood dimension format',
                    'enabled': True,
                    'priority': 2
                }
            ]
        
        # Combine and sort by priority
        all_rules = common_rules + domain_rules
        all_rules.sort(key=lambda r: r['priority'], reverse=True)
        
        return all_rules
    
    def _load_user_rules(self, rules_file: str) -> List[Dict[str, Any]]:
        """
        Load user-defined rules from a file
        
        Args:
            rules_file: Path to the rules file
            
        Returns:
            List of rules
        """
        if not os.path.exists(rules_file):
            logger.warning(f"Rules file not found: {rules_file}")
            return []
        
        try:
            with open(rules_file, 'r', encoding='utf-8') as f:
                user_rules = json.load(f)
            
            # Validate rules
            valid_rules = []
            for rule in user_rules:
                if 'pattern' in rule and 'replacement' in rule:
                    # Add defaults if missing
                    if 'id' not in rule:
                        rule['id'] = f"user_rule_{len(valid_rules)}"
                    if 'description' not in rule:
                        rule['description'] = f"User rule {rule['id']}"
                    if 'enabled' not in rule:
                        rule['enabled'] = True
                    if 'priority' not in rule:
                        rule['priority'] = 5  # Higher priority than system rules
                    
                    valid_rules.append(rule)
            
            return valid_rules
            
        except Exception as e:
            logger.error(f"Error loading rules file: {e}")
            return []
    
    def process_text(self, text: str) -> Dict[str, Any]:
        """
        Process text using rules
        
        Args:
            text: Text to process
            
        Returns:
            Dictionary with processed text and applied rules
        """
        if not text:
            return {
                'processed_text': '',
                'original_text': '',
                'applied_rules': [],
                'changes': 0
            }
        
        original_text = text
        processed_text = text
        applied_rules = []
        iteration = 0
        
        while iteration < self.config['max_iterations']:
            text_before = processed_text
            
            # Apply enabled rules
            for rule in self.rules:
                if not rule['enabled']:
                    continue
                
                pattern = rule['pattern']
                replacement = rule['replacement']
                flags = 0 if self.config['case_sensitive'] else re.IGNORECASE
                
                # Apply the rule
                new_text = re.sub(pattern, replacement, processed_text, flags=flags)
                
                # If text changed, record the rule
                if new_text != processed_text:
                    if rule['id'] not in applied_rules:
                        applied_rules.append(rule['id'])
                    
                    processed_text = new_text
            
            # If no changes in this iteration, stop
            if processed_text == text_before:
                break
            
            iteration += 1
        
        # Compute number of changes
        changes = sum(1 for a, b in zip(original_text, processed_text) if a != b)
        
        return {
            'processed_text': processed_text,
            'original_text': original_text,
            'applied_rules': applied_rules,
            'changes': changes
        }


def process_file(input_path: str, output_path: str = None, config: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Process an OCR result file
    
    Args:
        input_path: Path to the OCR result file
        output_path: Path to save enhanced results
        config: Configuration dictionary
        
    Returns:
        Dictionary with processing results
    """
    # Load OCR data
    with open(input_path, 'r', encoding='utf-8') as f:
        ocr_data = json.load(f)
    
    # Create confidence scorer
    scorer = OCRConfidenceScorer(config)
    
    # Process OCR results
    result = scorer.process_ocr_results(ocr_data)
    
    # Save results if output path is specified
    if output_path:
        scorer.save_results(result, output_path)
    
    return result


def main():
    """Main function to parse arguments and run confidence scoring"""
    parser = argparse.ArgumentParser(description="OCR confidence scoring and post-processing")
    parser.add_argument("input_file", help="Path to the OCR result file (JSON)")
    parser.add_argument("--output-file", help="Path to save enhanced OCR results")
    parser.add_argument("--rules-file", help="JSON file containing post-processing rules")
    parser.add_argument("--domain", choices=["general", "tile", "stone", "wood"], 
                      default="general", help="Domain for specialized rules")
    parser.add_argument("--min-confidence", type=float, default=0.6, 
                      help="Minimum confidence threshold (0-1)")
    parser.add_argument("--detailed-metrics", action="store_true", 
                      help="Generate detailed confidence metrics")
    parser.add_argument("--no-spellcheck", action="store_true", 
                      help="Disable spellcheck correction")
    
    args = parser.parse_args()
    
    try:
        # Set up configuration
        config = {
            'min_confidence': args.min_confidence,
            'detailed_metrics': args.detailed_metrics,
            'domain': args.domain,
            'spellcheck_enabled': not args.no_spellcheck,
            'rules_file': args.rules_file
        }
        
        # Set output path if not specified
        output_path = args.output_file
        if not output_path:
            base_path = os.path.splitext(args.input_file)[0]
            output_path = f"{base_path}_enhanced.json"
        
        # Process file
        result = process_file(args.input_file, output_path, config)
        
        # Print summary
        stats = result.get('statistics', {})
        print(json.dumps({
            "processed_elements": stats.get('element_count', 0),
            "average_confidence": stats.get('average_confidence', 0),
            "elements_improved": stats.get('elements_improved', 0),
            "improvement_rate": stats.get('improvement_rate', 0),
            "output_file": output_path
        }, indent=2))
        
        return 0
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())