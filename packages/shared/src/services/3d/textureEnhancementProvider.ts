import { BaseThreeDProvider } from './baseProvider';
import { ModelEndpoints, ProcessingResult, TextureEnhancementOptions, TextToTextureOptions, TextureResult } from './types'; // Import new types
import { logger } from '../../utils/logger';
// Assuming runMlScript is accessible or moved/re-exported to shared utils if needed
// For now, assume it's available via a relative path (adjust if necessary)
// import { runMlScript } from '../../../../server/src/utils/mlScriptRunner'; 
// ^^^ This relative path is bad practice, indicates need for refactoring runMlScript location or using HTTP service pattern

// Interfaces moved to types.ts

// Placeholder for runMlScript if not accessible directly
// TODO: Replace placeholder with actual runMlScript import/call from a shared location or use HTTP service pattern
async function runMlScriptPlaceholder<T>(options: { scriptPath: string; args: string[] }): Promise<T> {
    logger.warn('Using placeholder runMlScript. Refactor needed.');
    // Mock implementation
    if (options.scriptPath.includes('text2texture')) {
        if (options.args.includes('--mode enhance')) {
             return { outputPath: 'mock_enhanced_path.png' } as T;
        } else if (options.args.includes('--mode text')) {
             return { outputPath: 'mock_generated_path.png' } as T;
        }
    }
    throw new Error('Placeholder runMlScript called with unexpected options');
}


export class TextureEnhancementProvider extends BaseThreeDProvider {
  constructor(modelEndpoints: ModelEndpoints) {
    // Assuming 'text2texture' endpoint exists in ModelEndpoints
    super(modelEndpoints); // Corrected: BaseThreeDProvider constructor takes only one argument
  }

  // Implement abstract methods from BaseThreeDProvider (can be minimal if not used)
  async processImage(buffer: Buffer, options?: any): Promise<ProcessingResult> {
     logger.warn('TextureEnhancementProvider.processImage called but not fully implemented for generic image processing.');
     // Could potentially call enhanceTexture here if options indicate enhancement
     if (options?.mode === 'enhance') {
         // Need a way to save buffer to temp file to pass path to enhanceTexture
         throw new Error('processImage enhancement path not implemented. Use enhanceTexture directly.');
     }
     return { success: false, error: 'Generic image processing not supported by TextureEnhancementProvider' };
  }

  async processText(text: string, options?: any): Promise<ProcessingResult> {
     logger.warn('TextureEnhancementProvider.processText called but not fully implemented for generic text processing.');
     // Could potentially call generateTextureFromText here
     if (options?.mode === 'text') {
         return this.generateTextureFromText(text, options);
     }
     return { success: false, error: 'Generic text processing not supported by TextureEnhancementProvider' };
  }

  /**
   * Enhances a texture image.
   * @param imagePath - Path to the input image file.
   * @param options - Enhancement options.
   * @returns Promise resolving with the path to the enhanced texture.
   */
  async enhanceTexture(imagePath: string, options: TextureEnhancementOptions = {}): Promise<TextureResult> {
    const { quality = 'medium', scale = 4 } = options;
    
    const scriptArgs = [
      '--mode', 'enhance',
      '--image_path', imagePath,
      '--quality', quality,
      '--scale', scale.toString(),
      '--output_format', 'json'
    ];

    try {
      // TODO: Replace placeholder with actual runMlScript import/call
      const result = await runMlScriptPlaceholder<TextureResult>({
        scriptPath: 'packages.ml.python.text2texture_service',
        args: scriptArgs
      });
      
      if (result.error) {
          // Handle if result.error is Error object or string
          const errorMessage = typeof result.error === 'string' ? result.error : (result.error?.message || 'Unknown error during texture enhancement');
          throw new Error(errorMessage); 
      }
      
      // Explicitly map properties instead of spreading
      return { success: true, outputPath: result.outputPath }; 
    } catch (error) {
      // Wrap error in object for logger context
      logger.error('Error enhancing texture:', { error }); 
      // Return type matches TextureResult (outputPath is optional)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }; 
    }
  }

  /**
   * Generates a texture from a text prompt.
   * @param prompt - Text description for the texture.
   * @param options - Generation options.
   * @returns Promise resolving with the path to the generated texture.
   */
  async generateTextureFromText(prompt: string, options: TextToTextureOptions = {}): Promise<TextureResult> {
    const { style = 'photorealistic', size = 1024 } = options;

    const scriptArgs = [
      '--mode', 'text',
      '--prompt', prompt,
      '--style', style,
      '--size', size.toString(),
      '--output_format', 'json'
    ];

    try {
      // TODO: Replace placeholder with actual runMlScript import/call
      const result = await runMlScriptPlaceholder<TextureResult>({
        scriptPath: 'packages.ml.python.text2texture_service',
        args: scriptArgs
      });

      if (result.error) {
           // Handle if result.error is Error object or string
           const errorMessage = typeof result.error === 'string' ? result.error : (result.error?.message || 'Unknown error during text-to-texture generation');
          throw new Error(errorMessage);
      }

      // Explicitly map properties instead of spreading
      return { success: true, outputPath: result.outputPath };
    } catch (error) {
       // Wrap error in object for logger context
      logger.error('Error generating texture from text:', { error });
       // Return type matches TextureResult (outputPath is optional)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}