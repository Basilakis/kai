#!/usr/bin/env python3
"""
Cross-Modal Attention

This module implements cross-modal attention mechanisms for integrating
visual and textual information in the RAG system.

Key features:
1. Visual context enrichment for text queries
2. Cross-modal attention for better integration of visual and textual information
3. Multi-modal embedding generation
4. Visual feature extraction and integration
"""

import asyncio
import base64
import json
import logging
import os
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

# Set up logging
logger = logging.getLogger(__name__)

class CrossModalAttention:
    """
    Implements cross-modal attention mechanisms for visual-textual integration.
    """
    
    def __init__(
        self,
        config: Dict[str, Any],
        vision_model=None,
        text_model=None,
        llm_client=None
    ):
        """
        Initialize the cross-modal attention module.
        
        Args:
            config: Configuration for the module
            vision_model: Vision model for image processing
            text_model: Text model for text processing
            llm_client: LLM client for generation tasks
        """
        self.config = config
        self.vision_model = vision_model
        self.text_model = text_model
        self.llm_client = llm_client
        
        # Set default configuration values
        self.config.setdefault("visual_feature_dim", 512)
        self.config.setdefault("text_feature_dim", 768)
        self.config.setdefault("joint_feature_dim", 1024)
        self.config.setdefault("attention_heads", 8)
        self.config.setdefault("vision_model_name", "clip")
        self.config.setdefault("text_model_name", "bert")
    
    async def process_multi_modal_query(
        self,
        text_query: Optional[str] = None,
        image_data: Optional[Union[str, bytes]] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a multi-modal query with text and/or image.
        
        Args:
            text_query: Text query
            image_data: Image data (base64 string or bytes)
            options: Additional options for processing
            
        Returns:
            Processed query with enriched context
        """
        options = options or {}
        
        try:
            # Check if we have both text and image
            has_text = text_query is not None and len(text_query.strip()) > 0
            has_image = image_data is not None
            
            if not has_text and not has_image:
                return {"error": "No text query or image provided"}
            
            # Process based on available inputs
            if has_text and has_image:
                # Process multi-modal query
                return await self._process_text_and_image(text_query, image_data, options)
            elif has_text:
                # Process text-only query
                return await self._process_text_only(text_query, options)
            else:
                # Process image-only query
                return await self._process_image_only(image_data, options)
                
        except Exception as e:
            logger.error(f"Error in cross-modal processing: {str(e)}")
            return {"error": str(e)}
    
    async def _process_text_and_image(
        self,
        text_query: str,
        image_data: Union[str, bytes],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a query with both text and image.
        
        Args:
            text_query: Text query
            image_data: Image data
            options: Additional options
            
        Returns:
            Processed query with cross-modal attention
        """
        # Extract visual features
        visual_features = await self._extract_visual_features(image_data)
        
        # Extract text features
        text_features = await self._extract_text_features(text_query)
        
        # Apply cross-modal attention
        joint_features = self._apply_cross_modal_attention(text_features, visual_features)
        
        # Generate enhanced query
        enhanced_query = await self._generate_enhanced_query(text_query, image_data, joint_features)
        
        # Extract visual context
        visual_context = await self._extract_visual_context(image_data)
        
        return {
            "original_text_query": text_query,
            "enhanced_query": enhanced_query,
            "visual_context": visual_context,
            "joint_features": joint_features.tolist() if isinstance(joint_features, np.ndarray) else joint_features,
            "multi_modal": True
        }
    
    async def _process_text_only(
        self,
        text_query: str,
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process a text-only query.
        
        Args:
            text_query: Text query
            options: Additional options
            
        Returns:
            Processed query
        """
        # Extract text features
        text_features = await self._extract_text_features(text_query)
        
        return {
            "original_text_query": text_query,
            "enhanced_query": text_query,
            "text_features": text_features.tolist() if isinstance(text_features, np.ndarray) else text_features,
            "multi_modal": False
        }
    
    async def _process_image_only(
        self,
        image_data: Union[str, bytes],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process an image-only query.
        
        Args:
            image_data: Image data
            options: Additional options
            
        Returns:
            Processed query with generated text description
        """
        # Extract visual features
        visual_features = await self._extract_visual_features(image_data)
        
        # Extract visual context
        visual_context = await self._extract_visual_context(image_data)
        
        # Generate text query from image
        generated_query = await self._generate_query_from_image(image_data, visual_context)
        
        return {
            "generated_text_query": generated_query,
            "visual_context": visual_context,
            "visual_features": visual_features.tolist() if isinstance(visual_features, np.ndarray) else visual_features,
            "multi_modal": True
        }
    
    async def _extract_visual_features(
        self,
        image_data: Union[str, bytes]
    ) -> np.ndarray:
        """
        Extract features from an image.
        
        Args:
            image_data: Image data
            
        Returns:
            Visual features
        """
        if not self.vision_model:
            # Return dummy features if no vision model
            return np.zeros(self.config["visual_feature_dim"])
        
        try:
            # Ensure image_data is bytes
            if isinstance(image_data, str):
                # Assume base64 string
                image_bytes = base64.b64decode(image_data.split(",")[-1] if "," in image_data else image_data)
            else:
                image_bytes = image_data
            
            # Extract features using vision model
            features = await self.vision_model.extract_features(image_bytes)
            
            return features
            
        except Exception as e:
            logger.error(f"Error extracting visual features: {str(e)}")
            return np.zeros(self.config["visual_feature_dim"])
    
    async def _extract_text_features(self, text: str) -> np.ndarray:
        """
        Extract features from text.
        
        Args:
            text: Input text
            
        Returns:
            Text features
        """
        if not self.text_model:
            # Return dummy features if no text model
            return np.zeros(self.config["text_feature_dim"])
        
        try:
            # Extract features using text model
            features = await self.text_model.extract_features(text)
            
            return features
            
        except Exception as e:
            logger.error(f"Error extracting text features: {str(e)}")
            return np.zeros(self.config["text_feature_dim"])
    
    def _apply_cross_modal_attention(
        self,
        text_features: np.ndarray,
        visual_features: np.ndarray
    ) -> np.ndarray:
        """
        Apply cross-modal attention between text and visual features.
        
        Args:
            text_features: Text features
            visual_features: Visual features
            
        Returns:
            Joint features after cross-modal attention
        """
        try:
            # Simple concatenation as fallback
            if len(text_features.shape) == 1 and len(visual_features.shape) == 1:
                # Resize if needed
                text_feat_resized = text_features[:self.config["text_feature_dim"]]
                visual_feat_resized = visual_features[:self.config["visual_feature_dim"]]
                
                # Pad if needed
                if len(text_feat_resized) < self.config["text_feature_dim"]:
                    text_feat_resized = np.pad(
                        text_feat_resized,
                        (0, self.config["text_feature_dim"] - len(text_feat_resized))
                    )
                
                if len(visual_feat_resized) < self.config["visual_feature_dim"]:
                    visual_feat_resized = np.pad(
                        visual_feat_resized,
                        (0, self.config["visual_feature_dim"] - len(visual_feat_resized))
                    )
                
                # Concatenate
                joint_features = np.concatenate([text_feat_resized, visual_feat_resized])
                
                # Resize to joint dimension
                if len(joint_features) > self.config["joint_feature_dim"]:
                    joint_features = joint_features[:self.config["joint_feature_dim"]]
                elif len(joint_features) < self.config["joint_feature_dim"]:
                    joint_features = np.pad(
                        joint_features,
                        (0, self.config["joint_feature_dim"] - len(joint_features))
                    )
                
                return joint_features
            
            # More complex attention mechanism would be implemented here
            # This is a simplified version
            
            return np.zeros(self.config["joint_feature_dim"])
            
        except Exception as e:
            logger.error(f"Error applying cross-modal attention: {str(e)}")
            return np.zeros(self.config["joint_feature_dim"])
    
    async def _extract_visual_context(
        self,
        image_data: Union[str, bytes]
    ) -> Dict[str, Any]:
        """
        Extract context information from an image.
        
        Args:
            image_data: Image data
            
        Returns:
            Visual context information
        """
        if not self.vision_model or not self.llm_client:
            return {"error": "No vision model or LLM client available"}
        
        try:
            # Ensure image_data is bytes
            if isinstance(image_data, str):
                # Assume base64 string
                image_bytes = base64.b64decode(image_data.split(",")[-1] if "," in image_data else image_data)
            else:
                image_bytes = image_data
            
            # Get image description
            description = await self._generate_image_description(image_bytes)
            
            # Get material detection
            materials = await self._detect_materials(image_bytes)
            
            # Get color analysis
            colors = await self._analyze_colors(image_bytes)
            
            # Get texture analysis
            textures = await self._analyze_textures(image_bytes)
            
            return {
                "description": description,
                "materials": materials,
                "colors": colors,
                "textures": textures
            }
            
        except Exception as e:
            logger.error(f"Error extracting visual context: {str(e)}")
            return {"error": str(e)}
    
    async def _generate_image_description(self, image_bytes: bytes) -> str:
        """
        Generate a description of an image.
        
        Args:
            image_bytes: Image data
            
        Returns:
            Image description
        """
        if not self.llm_client:
            return ""
        
        try:
            # Convert image to base64
            base64_image = base64.b64encode(image_bytes).decode("utf-8")
            
            # Call vision-capable LLM
            response = await self.llm_client.chat.completions.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert in materials and interior design. Describe the materials visible in this image, focusing on textures, colors, and material types."
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Describe the materials in this image in detail."},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                        ]
                    }
                ],
                max_tokens=300
            )
            
            description = response.choices[0].message.content
            return description
            
        except Exception as e:
            logger.error(f"Error generating image description: {str(e)}")
            return ""
    
    async def _detect_materials(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Detect materials in an image.
        
        Args:
            image_bytes: Image data
            
        Returns:
            List of detected materials
        """
        if not self.vision_model:
            return []
        
        try:
            # Call material detection
            materials = await self.vision_model.detect_materials(image_bytes)
            return materials
            
        except Exception as e:
            logger.error(f"Error detecting materials: {str(e)}")
            return []
    
    async def _analyze_colors(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Analyze colors in an image.
        
        Args:
            image_bytes: Image data
            
        Returns:
            List of color information
        """
        if not self.vision_model:
            return []
        
        try:
            # Call color analysis
            colors = await self.vision_model.analyze_colors(image_bytes)
            return colors
            
        except Exception as e:
            logger.error(f"Error analyzing colors: {str(e)}")
            return []
    
    async def _analyze_textures(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Analyze textures in an image.
        
        Args:
            image_bytes: Image data
            
        Returns:
            List of texture information
        """
        if not self.vision_model:
            return []
        
        try:
            # Call texture analysis
            textures = await self.vision_model.analyze_textures(image_bytes)
            return textures
            
        except Exception as e:
            logger.error(f"Error analyzing textures: {str(e)}")
            return []
    
    async def _generate_enhanced_query(
        self,
        text_query: str,
        image_data: Union[str, bytes],
        joint_features: np.ndarray
    ) -> str:
        """
        Generate an enhanced query using text, image, and joint features.
        
        Args:
            text_query: Original text query
            image_data: Image data
            joint_features: Joint features from cross-modal attention
            
        Returns:
            Enhanced query
        """
        if not self.llm_client:
            return text_query
        
        try:
            # Extract visual context
            visual_context = await self._extract_visual_context(image_data)
            
            # Create prompt for query enhancement
            system_prompt = """
You are an expert in materials and interior design. Your task is to enhance a user's query about materials
by incorporating visual information from an image they've provided.

Create an enhanced, detailed query that combines the user's original text query with the visual information.
Focus on material types, textures, colors, and patterns visible in the image.
The enhanced query should be specific and detailed, but still natural and concise.
"""
            
            user_prompt = f"""
Original Query: {text_query}

Visual Information:
- Description: {visual_context.get('description', 'No description available')}
- Detected Materials: {', '.join([m.get('name', '') for m in visual_context.get('materials', [])])}
- Colors: {', '.join([c.get('name', '') for c in visual_context.get('colors', [])])}
- Textures: {', '.join([t.get('name', '') for t in visual_context.get('textures', [])])}

Create an enhanced query that combines the original query with this visual information.
"""
            
            # Call the LLM
            response = await self.llm_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=200
            )
            
            enhanced_query = response.choices[0].message.content
            
            # Clean up the response
            enhanced_query = enhanced_query.strip().strip('"')
            
            return enhanced_query
            
        except Exception as e:
            logger.error(f"Error generating enhanced query: {str(e)}")
            return text_query
    
    async def _generate_query_from_image(
        self,
        image_data: Union[str, bytes],
        visual_context: Dict[str, Any]
    ) -> str:
        """
        Generate a text query from an image.
        
        Args:
            image_data: Image data
            visual_context: Visual context information
            
        Returns:
            Generated text query
        """
        if not self.llm_client:
            return "What materials are in this image?"
        
        try:
            # Create prompt for query generation
            system_prompt = """
You are an expert in materials and interior design. Your task is to generate a detailed query about materials
based on an image the user has provided.

Create a natural, specific query that focuses on the materials visible in the image.
The query should be something a user might ask when looking for information about these materials.
"""
            
            user_prompt = f"""
Visual Information:
- Description: {visual_context.get('description', 'No description available')}
- Detected Materials: {', '.join([m.get('name', '') for m in visual_context.get('materials', [])])}
- Colors: {', '.join([c.get('name', '') for c in visual_context.get('colors', [])])}
- Textures: {', '.join([t.get('name', '') for t in visual_context.get('textures', [])])}

Generate a natural query that a user might ask about the materials in this image.
"""
            
            # Call the LLM
            response = await self.llm_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.5,
                max_tokens=100
            )
            
            generated_query = response.choices[0].message.content
            
            # Clean up the response
            generated_query = generated_query.strip().strip('"')
            
            return generated_query
            
        except Exception as e:
            logger.error(f"Error generating query from image: {str(e)}")
            return "What materials are in this image?"


# Factory function to create a cross-modal attention module
def create_cross_modal_attention(
    config: Dict[str, Any],
    vision_model=None,
    text_model=None,
    llm_client=None
) -> CrossModalAttention:
    """
    Create a CrossModalAttention module with specified configuration and dependencies.
    
    Args:
        config: Configuration for the module
        vision_model: Vision model for image processing
        text_model: Text model for text processing
        llm_client: LLM client for generation tasks
        
    Returns:
        Configured CrossModalAttention module
    """
    return CrossModalAttention(
        config=config,
        vision_model=vision_model,
        text_model=text_model,
        llm_client=llm_client
    )
