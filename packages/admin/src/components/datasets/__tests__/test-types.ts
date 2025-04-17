/**
 * Type definitions for components used in DatasetDetails tests
 */

// Split Ratio Control Props interface
export interface SplitRatioControlProps {
  initialRatio?: {
    train: number;
    validation: number;
    test: number;
  };
  onChange: (ratios: {
    train: number;
    validation: number;
    test: number;
  }) => void;
}

// Model Selection Control Props interface
export interface ModelConfigProps {
  initialConfig?: {
    architecture: string;
    variant: string;
    pretrained: boolean;
    hyperparameters: {
      batchSize: number;
      learningRate: number;
      epochs: number;
    };
  };
  onChange: (config: {
    architecture: string;
    variant: string;
    pretrained: boolean;
    hyperparameters: {
      batchSize: number;
      learningRate: number;
      epochs: number;
    };
  }) => void;
}

// Data Augmentation Options Props interface
export interface AugmentationOptionsProps {
  initialOptions?: {
    enabled: boolean;
    techniques: {
      rotation: boolean;
      horizontalFlip: boolean;
      verticalFlip: boolean;
      randomCrop: boolean;
      colorJitter: boolean;
      randomErasing: boolean;
      randomNoise: boolean;
    };
    intensities: {
      rotationDegrees: number;
      cropScale: number;
      brightnessVariation: number;
      erasePercent: number;
    };
  };
  onChange: (options: {
    enabled: boolean;
    techniques: {
      rotation: boolean;
      horizontalFlip: boolean;
      verticalFlip: boolean;
      randomCrop: boolean;
      colorJitter: boolean;
      randomErasing: boolean;
      randomNoise: boolean;
    };
    intensities: {
      rotationDegrees: number;
      cropScale: number;
      brightnessVariation: number;
      erasePercent: number;
    };
  }) => void;
}