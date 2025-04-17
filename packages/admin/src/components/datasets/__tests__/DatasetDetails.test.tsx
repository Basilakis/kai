import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DatasetDetails from '../DatasetDetails';
// Import types for our component props
import type { SplitRatioControlProps, ModelConfigProps, AugmentationOptionsProps } from './test-types';
// Import Jest type definitions
import '../../../types/jest-setup';

// Use the Window interface defined in jest-setup.d.ts

// Use window instead of global
const windowRef = (typeof window !== 'undefined') ? window : {} as Window;
// Initialize fetch separately to avoid overwriting
windowRef.fetch = jest.fn();
// Initialize console methods without property overwriting issues
if (!windowRef.console) {
  windowRef.console = {} as Window['console'];
}
windowRef.console.log = jest.fn();
windowRef.console.error = jest.fn();

// Mock components used by DatasetDetails
jest.mock('../../charts/BarChart', () => ({
  __esModule: true,
  default: () => <div data-testid="bar-chart">Bar Chart</div>
}));

jest.mock('../SplitRatioControl', () => ({
  __esModule: true,
  default: ({ onChange }: SplitRatioControlProps) => (
    <div data-testid="split-ratio-control">
      <button onClick={() => onChange({ train: 60, validation: 20, test: 20 })}>
        Change Split Ratio
      </button>
    </div>
  )
}));

jest.mock('../ModelSelectionControl', () => ({
  __esModule: true,
  default: ({ onChange }: ModelConfigProps) => (
    <div data-testid="model-selection-control">
      <button onClick={() => onChange({
        architecture: 'resnet',
        variant: 'B1',
        pretrained: true,
        hyperparameters: { batchSize: 16, learningRate: 0.01, epochs: 10 }
      })}>
        Change Model
      </button>
    </div>
  )
}));

jest.mock('../DataAugmentationOptions', () => ({
  __esModule: true,
  default: ({ onChange }: AugmentationOptionsProps) => (
    <div data-testid="data-augmentation-options">
      <button onClick={() => onChange({
        enabled: true,
        techniques: {
          rotation: true,
          horizontalFlip: true,
          verticalFlip: false,
          randomCrop: true,
          colorJitter: true,
          randomErasing: false,
          randomNoise: false
        },
        intensities: {
          rotationDegrees: 45,
          cropScale: 90,
          brightnessVariation: 30,
          erasePercent: 10
        }
      })}>
        Change Augmentation
      </button>
    </div>
  )
}));

jest.mock('../../training/DatasetTrainingProgress', () => ({
  __esModule: true,
  default: () => <div data-testid="training-progress">Training Progress</div>
}));


// Mock dataset for testing
const mockDataset = {
  id: 'dataset-123',
  name: 'Test Dataset',
  description: 'Test Description',
  source: 'Test Source',
  status: 'ready',
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-02T00:00:00.000Z',
  classCount: 3,
  imageCount: 100,
  statistics: {
    totalImages: 100,
    totalClasses: 3,
    averageImagesPerClass: 33.33,
    datasetSizeFormatted: '10.5 MB',
    classDistribution: [
      { name: 'Class A', count: 30 },
      { name: 'Class B', count: 40 },
      { name: 'Class C', count: 30 }
    ],
    imageQualityMetrics: {
      averageResolution: '1024x768',
      formatDistribution: [
        { format: 'JPEG', percentage: 80 },
        { format: 'PNG', percentage: 20 }
      ]
    }
  }
};

describe('DatasetDetails Component', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (windowRef.fetch as jest.Mock<any, any>).mockReset();
  });

  test('renders dataset information correctly', () => {
    render(<DatasetDetails dataset={mockDataset} />);
    
    // Test basic information display
    expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Test Source')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // classCount
    expect(screen.getByText('100')).toBeInTheDocument(); // imageCount
  });

  test('allows switching between tabs', () => {
    render(<DatasetDetails dataset={mockDataset} />);
    
    // Default tab should be Overview
    expect(screen.getByText('Dataset Details')).toBeInTheDocument();
    
    // Switch to Classes & Images tab
    fireEvent.click(screen.getByText('Classes & Images'));
    expect(screen.getByText('Classes')).toBeInTheDocument();
    
    // Switch to Training Configuration tab
    fireEvent.click(screen.getByText('Training Configuration'));
    expect(screen.getByText('Model Selection')).toBeInTheDocument();
  });

  test('saves configuration correctly', async () => {
    // Mock successful API response
    (windowRef.fetch as jest.Mock<any, any>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });
    
    // Store the original implementation of setTimeout
    const originalSetTimeout = setTimeout;
    
    // Mock setTimeout to execute immediately
    windowRef.setTimeout = jest.fn((callback: Function) => {
      callback();
      return 0 as any;
    });
    
    render(<DatasetDetails dataset={mockDataset} />);
    
    // Go to training configuration tab
    fireEvent.click(screen.getByText('Training Configuration'));
    
    // Click the Save Configuration button
    fireEvent.click(screen.getByText('Save Configuration'));
    
    await waitFor(() => {
      // Check if fetch was called with correct parameters
      expect(windowRef.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/admin/datasets/${mockDataset.id}/configuration`),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.any(String)
        })
      );
      
      // Verify success message appeared
      expect(screen.getByText('Configuration saved successfully!')).toBeInTheDocument();
    });
    
    // Restore original setTimeout with proper typing
    // Store type of original function to help TypeScript understand the assignment
    const originalFn: typeof setTimeout = originalSetTimeout;
    window.setTimeout = originalFn;
  });

  test('shows error message when saving configuration fails', async () => {
    // Mock failed API response
    (windowRef.fetch as jest.Mock<any, any>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Server error'
    });
    
    render(<DatasetDetails dataset={mockDataset} />);
    
    // Go to training configuration tab
    fireEvent.click(screen.getByText('Training Configuration'));
    
    // Click the Save Configuration button
    fireEvent.click(screen.getByText('Save Configuration'));
    
    await waitFor(() => {
      // Check for error message
      expect(screen.getByText(/Failed to save configuration/)).toBeInTheDocument();
    });
  });
  
  test('updates training configuration when model selection changes', () => {
    render(<DatasetDetails dataset={mockDataset} />);
    
    // Go to training configuration tab
    fireEvent.click(screen.getByText('Training Configuration'));
    
    // Click the Change Model button in the mocked ModelSelectionControl
    fireEvent.click(screen.getByText('Change Model'));
    
    // Verify that handleModelSelectionChange was called by checking console.log
    expect(windowRef.console.log).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      modelArchitecture: 'resnet',
      hyperparameters: expect.any(Object)
    }));
  });
  
  test('updates training configuration when split ratio changes', () => {
    render(<DatasetDetails dataset={mockDataset} />);
    
    // Go to training configuration tab
    fireEvent.click(screen.getByText('Training Configuration'));
    
    // Click the Change Split Ratio button in the mocked SplitRatioControl
    fireEvent.click(screen.getByText('Change Split Ratio'));
    
    // Verify that configuration was updated with new split ratio
    expect(windowRef.console.log).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      splitRatios: { train: 60, validation: 20, test: 20 }
    }));
  });
});