/**
 * Hugging Face Provider Service
 * 
 * This service extends the Hugging Face integration beyond dataset management
 * to provide comprehensive ML capabilities including:
 * 
 * - Model inference (text generation, classification, etc.)
 * - Embedding generation
 * - Text processing (summarization, translation, etc.)
 * - Image analysis and generation
 * - Fine-tuning management
 * 
 * It works alongside other AI providers (OpenAI, Anthropic) in a provider-agnostic system.
 */

import { HfInference } from '@huggingface/inference';
import { logger } from '../../utils/logger';
import { huggingFaceClient } from './huggingFaceClient';

// Types for embedding generation
export interface EmbeddingOptions {
  model?: string;
  truncate?: boolean;
  normalize?: boolean;
  encoderType?: 'text' | 'image' | 'multimodal';
}

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
  processingTime: number;
}

// Types for text generation
export interface TextGenerationOptions {
  model?: string;
  maxLength?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  repetitionPenalty?: number;
  doSample?: boolean;
  seed?: number;
  useCache?: boolean;
  waitForModel?: boolean;
}

export interface TextGenerationResult {
  text: string;
  model: string;
  finishReason: string;
  processingTime: number;
}

// Types for text classification
export interface ClassificationOptions {
  model?: string;
  candidateLabels?: string[];
  multiLabel?: boolean;
}

export interface ClassificationResult {
  labels: string[];
  scores: number[];
  model: string;
  processingTime: number;
}

// Types for image analysis
export interface ImageAnalysisOptions {
  model?: string;
  task?: 'object-detection' | 'image-classification' | 'image-segmentation';
}

// Configuration for the HuggingFaceProvider
export interface HuggingFaceProviderConfig {
  apiKey?: string;
  defaultTextModel?: string;
  defaultEmbeddingModel?: string;
  defaultImageModel?: string;
  defaultModelTimeout?: number;
  useFastModels?: boolean;
}

/**
 * Hugging Face Provider Service
 * 
 * Provides a comprehensive interface to Hugging Face ML services that works
 * alongside other AI service providers (OpenAI, Anthropic) in the platform.
 */
export class HuggingFaceProvider {
  private static instance: HuggingFaceProvider;
  private config: HuggingFaceProviderConfig;
  private inference: HfInference | null = null;
  private initialized: boolean = false;

  // Default model configurations
  private DEFAULT_TEXT_MODEL = 'google/flan-t5-xxl';
  private DEFAULT_EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
  private DEFAULT_IMAGE_MODEL = 'google/vit-base-patch16-224';
  private DEFAULT_TIMEOUT = 30000; // 30 seconds

  private constructor() {
    this.config = {
      apiKey: process.env.HF_API_KEY,
      defaultTextModel: process.env.HF_DEFAULT_TEXT_MODEL || this.DEFAULT_TEXT_MODEL,
      defaultEmbeddingModel: process.env.HF_DEFAULT_EMBEDDING_MODEL || this.DEFAULT_EMBEDDING_MODEL,
      defaultImageModel: process.env.HF_DEFAULT_IMAGE_MODEL || this.DEFAULT_IMAGE_MODEL,
      defaultModelTimeout: process.env.HF_MODEL_TIMEOUT ? parseInt(process.env.HF_MODEL_TIMEOUT) : this.DEFAULT_TIMEOUT,
      useFastModels: process.env.HF_USE_FAST_MODELS === 'true'
    };
    
    this.init();
  }

  /**
   * Get the singleton instance
   * @returns The HuggingFaceProvider instance
   */
  public static getInstance(): HuggingFaceProvider {
    if (!HuggingFaceProvider.instance) {
      HuggingFaceProvider.instance = new HuggingFaceProvider();
    }
    return HuggingFaceProvider.instance;
  }

  /**
   * Initialize the provider with configuration
   * @param config Optional configuration overrides
   */
  public init(config?: Partial<HuggingFaceProviderConfig>): void {
    if (config) {
      this.config = {
        ...this.config,
        ...config
      };
    }

    try {
      // Use the HuggingFaceClient's inference instance or create a new one
      if (huggingFaceClient.isInitialized()) {
        this.inference = huggingFaceClient.getInferenceClient();
        this.initialized = true;
        logger.info('HuggingFaceProvider initialized using existing huggingFaceClient');
      } else if (this.config.apiKey) {
        this.inference = new HfInference(this.config.apiKey);
        this.initialized = true;
        logger.info('HuggingFaceProvider initialized with new inference client');
      } else {
        logger.warn('HuggingFaceProvider initialization failed: No API key provided');
      }
    } catch (err) {
      logger.error(`HuggingFaceProvider initialization error: ${err}`);
    }
  }

  /**
   * Check if the provider is initialized
   * @returns True if initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.inference !== null;
  }

  /**
   * Generate text using a Hugging Face model
   * @param prompt The input prompt
   * @param options Generation options
   * @returns Generated text and metadata
   */
  public async generateText(prompt: string, options: TextGenerationOptions = {}): Promise<TextGenerationResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      const model = options.model || this.config.defaultTextModel;
      
      const params = {
        inputs: prompt,
        parameters: {
          max_new_tokens: options.maxLength,
          temperature: options.temperature,
          top_k: options.topK,
          top_p: options.topP,
          repetition_penalty: options.repetitionPenalty,
          do_sample: options.doSample,
          seed: options.seed
        },
        options: {
          use_cache: options.useCache,
          wait_for_model: options.waitForModel
        }
      };
      
      // Remove undefined parameters
      Object.keys(params.parameters).forEach(key => {
        const k = key as keyof typeof params.parameters;
        if (params.parameters[k] === undefined) {
          delete params.parameters[k];
        }
      });
      
      // Generate text using the Hugging Face inference API
      if (!this.inference) {
        throw new Error('Inference client is not initialized');
      }
      
      const result = await this.inference.textGeneration({
        ...params,
        model: model || this.DEFAULT_TEXT_MODEL,
        timeout: this.config.defaultModelTimeout
      });
      
      const processingTime = Date.now() - startTime;
      
      return {
        text: result.generated_text,
        model: model || this.DEFAULT_TEXT_MODEL,
        finishReason: 'stop', // HF doesn't provide this info directly
        processingTime
      };
    } catch (err) {
      logger.error(`Text generation failed: ${err}`);
      throw new Error(`Text generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Generate embeddings for text or images
   * @param input Text string or image buffer
   * @param options Embedding options
   * @returns Vector embedding and metadata
   */
  public async generateEmbedding(
    input: string | Buffer,
    options: EmbeddingOptions = {}
  ): Promise<EmbeddingResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      const encoderType = options.encoderType || 'text';
      const model = options.model || 
        (encoderType === 'text' ? this.config.defaultEmbeddingModel : this.config.defaultImageModel);
      
      let embedding: number[] = [];
      
      // Handle different types of inputs
      if (!this.inference) {
        throw new Error('Inference client is not initialized');
      }
      
      if (encoderType === 'text' && typeof input === 'string') {
        const result = await this.inference.featureExtraction({
          inputs: input,
          model: model || this.DEFAULT_EMBEDDING_MODEL,
          options: {
            truncate: options.truncate,
            normalize: options.normalize
          }
        });
        
        // The result can be a 2D array or 1D array depending on the model
        if (Array.isArray(result[0])) {
          embedding = result[0] as number[];
        } else {
          embedding = result as number[];
        }
      } else if (encoderType === 'image' && Buffer.isBuffer(input)) {
        // For image embeddings (this API might vary by model)
        const result = await this.inference.featureExtraction({
          inputs: { image: input as Buffer },
          model: model || this.DEFAULT_IMAGE_MODEL
        });
        
        if (Array.isArray(result[0])) {
          embedding = result[0] as number[];
        } else {
          embedding = result as number[];
        }
      } else {
        throw new Error(`Unsupported input type for ${encoderType} embedding`);
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        embedding,
        dimensions: embedding.length,
        model: model || (encoderType === 'text' ? this.DEFAULT_EMBEDDING_MODEL : this.DEFAULT_IMAGE_MODEL),
        processingTime
      };
    } catch (err) {
      logger.error(`Embedding generation failed: ${err}`);
      throw new Error(`Embedding generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Classify text into categories
   * @param text Text to classify
   * @param options Classification options
   * @returns Classification results with labels and scores
   */
  public async classifyText(
    text: string,
    options: ClassificationOptions = {}
  ): Promise<ClassificationResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      const model = options.model || 'facebook/bart-large-mnli';
      
      if (!this.inference) {
        throw new Error('Inference client is not initialized');
      }
      
      // For zero-shot classification
      const result = await this.inference.zeroShotClassification({
        inputs: text,
        parameters: {
          candidate_labels: options.candidateLabels || [],
          multi_label: options.multiLabel
        },
        model: model
      });
      
      const processingTime = Date.now() - startTime;
      
      return {
        labels: result.labels,
        scores: result.scores,
        model,
        processingTime
      };
    } catch (err) {
      logger.error(`Text classification failed: ${err}`);
      throw new Error(`Text classification failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Analyze an image for object detection, classification, or segmentation
   * @param imageBuffer Image data buffer
   * @param options Analysis options
   * @returns Analysis results
   */
  public async analyzeImage(imageBuffer: Buffer, options: ImageAnalysisOptions = {}): Promise<any> {
    this.ensureInitialized();
    
    try {
      const task = options.task || 'image-classification';
      const model = options.model || this.getDefaultModelForTask(task);
      
      let result;
      
      if (!this.inference) {
        throw new Error('Inference client is not initialized');
      }
      
      switch (task) {
        case 'object-detection':
          result = await this.inference.objectDetection({
            data: imageBuffer,
            model: model
          });
          break;
        
        case 'image-classification':
          result = await this.inference.imageClassification({
            data: imageBuffer,
            model: model
          });
          break;
        
        case 'image-segmentation':
          result = await this.inference.imageSegmentation({
            data: imageBuffer,
            model: model
          });
          break;
          
        default:
          throw new Error(`Unsupported image analysis task: ${task}`);
      }
      
      return {
        ...result,
        model,
        task
      };
    } catch (err) {
      logger.error(`Image analysis failed: ${err}`);
      throw new Error(`Image analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Summarize a text passage
   * @param text Text to summarize
   * @param options Summarization options
   * @returns Summarized text
   */
  public async summarizeText(
    text: string,
    options: { model?: string; maxLength?: number; minLength?: number } = {}
  ): Promise<{ summary: string; model: string }> {
    this.ensureInitialized();
    
    try {
      const model = options.model || 'facebook/bart-large-cnn';
      
      if (!this.inference) {
        throw new Error('Inference client is not initialized');
      }
      
      const result = await this.inference.summarization({
        inputs: text,
        parameters: {
          max_length: options.maxLength,
          min_length: options.minLength
        },
        model: model
      });
      
      return {
        summary: result.summary_text,
        model
      };
    } catch (err) {
      logger.error(`Text summarization failed: ${err}`);
      throw new Error(`Text summarization failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Translate text from one language to another
   * @param text Text to translate
   * @param options Translation options
   * @returns Translated text
   */
  public async translateText(
    text: string,
    options: { model?: string; sourceLang?: string; targetLang: string } = { targetLang: 'en' }
  ): Promise<{ translatedText: string; model: string }> {
    this.ensureInitialized();
    
    try {
      // Select appropriate model based on language pair or use provided model
      const model = options.model || this.getTranslationModel(options.sourceLang, options.targetLang);
      
      if (!this.inference) {
        throw new Error('Inference client is not initialized');
      }
      
      const result = await this.inference.translation({
        inputs: text,
        model: model
      });
      
      return {
        translatedText: result.translation_text,
        model
      };
    } catch (err) {
      logger.error(`Text translation failed: ${err}`);
      throw new Error(`Text translation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get a default model for the specified task
   * @param task The task type
   * @returns Model ID
   * @private
   */
  private getDefaultModelForTask(task: string): string {
    switch (task) {
      case 'object-detection':
        return 'facebook/detr-resnet-50';
      case 'image-classification':
        return 'google/vit-base-patch16-224';
      case 'image-segmentation':
        return 'facebook/mask2former-swin-large-cityscapes-semantic';
      default:
        return this.config.defaultImageModel || this.DEFAULT_IMAGE_MODEL;
    }
  }

  /**
   * Get an appropriate translation model based on language pair
   * @param sourceLang Source language code
   * @param targetLang Target language code
   * @returns Model ID
   * @private
   */
  private getTranslationModel(sourceLang: string | undefined, targetLang: string): string {
    // Default to Helsinki-NLP models which are good general-purpose translation models
    if (sourceLang && targetLang) {
      return `Helsinki-NLP/opus-mt-${sourceLang}-${targetLang}`;
    } else if (targetLang) {
      return `Helsinki-NLP/opus-mt-en-${targetLang}`;
    } else {
      // Fallback to a multilingual model
      return 'facebook/mbart-large-50-many-to-many-mmt';
    }
  }

  /**
   * Ensure the provider is initialized before making requests
   * @private
   */
  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error('HuggingFaceProvider is not initialized');
    }
  }
}

// Export singleton instance
export const huggingFaceProvider = HuggingFaceProvider.getInstance();
export default huggingFaceProvider;