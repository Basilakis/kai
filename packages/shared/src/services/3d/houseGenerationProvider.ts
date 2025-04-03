import { logger } from '../../utils/logger';
import { BaseThreeDProvider } from './baseProvider';
import {
  ProcessingResult,
  HouseGenerationConfig,
  HouseGenerationResult,
  HouseGenerationProvider as IHouseGenerationProvider,
  ModelEndpoints,
  Scene3D
} from './types';

/**
 * Provider for house generation and refinement
 */
export class HouseGenerationProvider extends BaseThreeDProvider implements IHouseGenerationProvider {
  constructor(modelEndpoints: ModelEndpoints) {
    super(modelEndpoints);
  }

  /**
   * Process image through house generation pipeline
   */
  async processImage(imageBuffer: Buffer, options: {
    detectObjects?: boolean;
    estimateDepth?: boolean;
    segmentScene?: boolean;
  }): Promise<ProcessingResult> {
    try {
      // Create form data with image and options
      const formData = new FormData();
      formData.append('image', new Blob([imageBuffer]));
      formData.append('options', JSON.stringify(options));

      // Send to ML service
      const response = await fetch(
        `${this.apiBase}/3d/process-house-image`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to process image: ${response.statusText}`);
      }

      return {
        success: true,
        data: await response.json()
      };
    } catch (error) {
      logger.error('Error processing image:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process text input for house generation
   */
  async processText(text: string, options: {
    style?: string;
    constraints?: any;
  }): Promise<ProcessingResult> {
    try {
      const result = await this.generateHouse(text, options.constraints);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('Error processing text:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate house from description
   */
  async generateHouse(description: string, config: HouseGenerationConfig): Promise<HouseGenerationResult> {
    try {
      // Generate house outline using ControlNet
      const outlineResponse = await fetch(
        `${this.modelEndpoints.controlNet}/generate-outline`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, style: config.style })
        }
      );

      if (!outlineResponse.ok) {
        throw new Error(`Failed to generate house outline: ${outlineResponse.statusText}`);
      }

      const outline = await outlineResponse.json();

      // Generate house shell using Shap-E
      const shellResponse = await fetch(
        `${this.modelEndpoints.shapE}/generate-house`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outline: outline.refined,
            description,
            config: {
              roomCount: config.roomCount,
              floorCount: config.floorCount,
              constraints: config.constraints
            }
          })
        }
      );

      if (!shellResponse.ok) {
        throw new Error(`Failed to generate house shell: ${shellResponse.statusText}`);
      }

      const shell = await shellResponse.json();

      // Generate detailed scene with GET3D
      const sceneResponse = await fetch(
        `${this.modelEndpoints.get3d}/generate-house-scene`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shell: shell.model,
            description,
            style: config.style
          })
        }
      );

      if (!sceneResponse.ok) {
        throw new Error(`Failed to generate detailed scene: ${sceneResponse.statusText}`);
      }

      const detailedScene = await sceneResponse.json();

      // Generate textures using Text2Material
      const textureResponse = await fetch(
        `${this.modelEndpoints.text2material}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exterior: config.texturePreferences?.exteriorStyle,
            interior: config.texturePreferences?.interiorStyle,
            materials: config.texturePreferences?.materialTypes
          })
        }
      );

      if (!textureResponse.ok) {
        throw new Error(`Failed to generate textures: ${textureResponse.statusText}`);
      }

      const textures = await textureResponse.json();

      // Validate visual-text matching with CLIP
      const clipResponse = await fetch(
        `${this.modelEndpoints.clip}/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description,
            images: {
              outline: outline.refined,
              shell: shell.preview,
              scene: detailedScene.preview
            }
          })
        }
      );

      if (!clipResponse.ok) {
        throw new Error(`Failed to validate with CLIP: ${clipResponse.statusText}`);
      }

      const clipValidation = await clipResponse.json();

      // If CLIP score is low, try to refine the results
      if (clipValidation.score < 0.7) {
        return this.refineResult({
          outline,
          shell,
          detailedScene,
          furniture: detailedScene.furniture,
          textures
        }, 'Improve visual-text alignment');
      }

      return {
        outline,
        shell,
        detailedScene,
        furniture: detailedScene.furniture,
        textures
      };
    } catch (error) {
      logger.error('Error generating house:', { error });
      throw error;
    }
  }

  /**
   * Refine generation result based on feedback
   */
  async refineResult(result: HouseGenerationResult, feedback: string, options?: any): Promise<HouseGenerationResult> {
    try {
      const response = await fetch(
        `${this.modelEndpoints.get3d}/refine`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            result,
            feedback,
            options
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to refine result: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      logger.error('Error refining result:', { error });
      throw error;
    }
  }
}