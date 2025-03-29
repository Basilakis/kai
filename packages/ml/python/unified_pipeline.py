import numpy as np
from typing import Dict, Any, Optional, List, Union
from .nerf_integration import NeRFPipeline
from .text_to_3d import TextTo3DPipeline
from .scene_understanding import UnifiedSceneAnalyzer

class UnifiedVisualizationPipeline:
    """Complete pipeline for 3D visualization combining all models"""
    
    def __init__(self, knowledge_base_url: str):
        self.nerf_pipeline = NeRFPipeline()
        self.text_pipeline = TextTo3DPipeline()
        self.scene_analyzer = UnifiedSceneAnalyzer(knowledge_base_url)
        
    async def process_input(self,
                          input_data: Union[np.ndarray, str, List[np.ndarray]],
                          input_type: str,
                          options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process input through appropriate pipeline"""
        options = options or {}
        
        if input_type == 'image':
            return await self.process_image_input(input_data, options)
        elif input_type == 'text':
            return await self.process_text_input(input_data, options)
        else:
            raise ValueError(f"Unsupported input type: {input_type}")
    
    async def process_image_input(self,
                                image: Union[np.ndarray, List[np.ndarray]],
                                options: Dict[str, Any]) -> Dict[str, Any]:
        """Process image input through NeRF and scene understanding pipeline"""
        # Process through scene understanding first
        scene_analysis = await self.scene_analyzer.analyze_scene_with_materials(
            image[0] if isinstance(image, list) else image,
            analyze_materials=True
        )
        
        # Process through NeRF pipeline
        if isinstance(image, list):
            nerf_result = await self.nerf_pipeline.process_multiple_images(image)
        else:
            nerf_result = await self.nerf_pipeline.process_single_image(image)
        
        return {
            'scene_analysis': scene_analysis,
            'reconstruction': nerf_result,
            'materials': scene_analysis.get('materials', [])
        }
    
    async def process_text_input(self,
                               prompt: str,
                               options: Dict[str, Any]) -> Dict[str, Any]:
        """Process text input through text-to-3D pipeline"""
        style_params = options.get('style_params')
        furniture_prompts = options.get('furniture_prompts')
        
        # Generate 3D scene from text
        scene_result = await self.text_pipeline.generate_from_text(
            prompt,
            style_params,
            furniture_prompts
        )
        
        return {
            'base_structure': scene_result['base_structure'],
            'detailed_scene': scene_result['detailed_scene'],
            'final_scene': scene_result['final_scene']
        }
    
    async def refine_result(self,
                           result: Dict[str, Any],
                           feedback: str,
                           options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Refine generated results based on feedback"""
        options = options or {}
        
        if 'final_scene' in result:  # Text-based result
            refined = await self.text_pipeline.refine_scene(
                result['final_scene'],
                feedback,
                options.get('style_updates')
            )
        else:  # Image-based result
            # Implement refinement logic for image-based results
            refined = result  # Placeholder
            
        return refined
    
    async def search_materials(self,
                             material_spec: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Search for materials in knowledge base"""
        return await self.scene_analyzer.material_recognizer.search_similar_materials(
            material_spec
        )

class VisualizationAgent:
    """Agent interface for 3D visualization system"""
    
    def __init__(self, knowledge_base_url: str):
        self.pipeline = UnifiedVisualizationPipeline(knowledge_base_url)
        
    async def process_request(self,
                            input_data: Union[np.ndarray, str, List[np.ndarray]],
                            input_type: str,
                            options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process visualization request"""
        try:
            # Process input through pipeline
            result = await self.pipeline.process_input(input_data, input_type, options)
            
            # Search for relevant materials
            if 'materials' in result:
                for material in result['materials']:
                    similar_materials = await self.pipeline.search_materials(material)
                    material['similar_materials'] = similar_materials
            
            return {
                'status': 'success',
                'result': result
            }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    async def refine_result(self,
                           result: Dict[str, Any],
                           feedback: str,
                           options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Refine visualization results"""
        try:
            refined_result = await self.pipeline.refine_result(result, feedback, options)
            return {
                'status': 'success',
                'result': refined_result
            }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }