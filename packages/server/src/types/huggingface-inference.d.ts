/**
 * Type declarations for Hugging Face Inference API
 * 
 * This file extends the @huggingface/inference types to include
 * all methods we need for our HuggingFaceProvider implementation.
 */

import '@huggingface/inference';

declare module '@huggingface/inference' {
  interface HfInference {
    // Text generation
    textGeneration(params: {
      inputs: string;
      parameters?: {
        max_new_tokens?: number;
        temperature?: number;
        top_k?: number;
        top_p?: number;
        repetition_penalty?: number;
        do_sample?: boolean;
        seed?: number;
      };
      options?: {
        use_cache?: boolean;
        wait_for_model?: boolean;
      };
      model: string;
      timeout?: number;
    }): Promise<{
      generated_text: string;
    }>;

    // Feature extraction (embeddings)
    featureExtraction(params: {
      inputs: string | { image: Buffer };
      model: string;
      options?: {
        truncate?: boolean;
        normalize?: boolean;
      };
    }): Promise<number[] | number[][]>;

    // Zero-shot classification
    zeroShotClassification(params: {
      inputs: string;
      parameters: {
        candidate_labels: string[];
        multi_label?: boolean;
      };
      model: string;
    }): Promise<{
      labels: string[];
      scores: number[];
      sequence: string;
    }>;

    // Object detection
    objectDetection(params: {
      data: Buffer;
      model: string;
    }): Promise<{
      score: number;
      label: string;
      box: { xmin: number; ymin: number; xmax: number; ymax: number };
    }[]>;

    // Image classification
    imageClassification(params: {
      data: Buffer;
      model: string;
    }): Promise<{
      score: number;
      label: string;
    }[]>;

    // Image segmentation
    imageSegmentation(params: {
      data: Buffer;
      model: string;
    }): Promise<{
      score: number;
      label: string;
      mask: string; // Base64 encoded mask
    }[]>;

    // Summarization
    summarization(params: {
      inputs: string;
      parameters?: {
        max_length?: number;
        min_length?: number;
      };
      model: string;
    }): Promise<{
      summary_text: string;
    }>;

    // Translation
    translation(params: {
      inputs: string;
      model: string;
    }): Promise<{
      translation_text: string;
    }>;
  }
}