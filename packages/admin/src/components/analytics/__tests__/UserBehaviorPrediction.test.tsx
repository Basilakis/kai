import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import UserBehaviorPrediction from '../UserBehaviorPrediction';

// Mock dependencies
jest.mock('axios');
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    PieChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="pie-chart">{children}</div>
    ),
    Pie: () => <div data-testid="pie" />,
    Cell: () => <div data-testid="cell" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />
  };
});

describe('UserBehaviorPrediction Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders the form correctly', () => {
    render(<UserBehaviorPrediction />);
    
    // Check form elements
    expect(screen.getByLabelText(/User ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prediction Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Lookback Days/i)).toBeInTheDocument();
    expect(screen.getByText(/Include User Profile Data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Predict Behavior/i })).toBeInTheDocument();
  });
  
  it('submits the form and displays prediction results', async () => {
    // Mock API response
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        data: {
          id: 'prediction-123',
          userId: 'user-123',
          predictionType: 'next_action',
          predictions: [
            {
              action: 'search',
              probability: 0.8,
              confidence: 0.75
            },
            {
              action: 'view',
              probability: 0.6,
              confidence: 0.7
            }
          ],
          userInsights: {
            activityLevel: 'high',
            interests: [
              { category: 'material', score: 0.9 },
              { category: 'catalog', score: 0.7 }
            ],
            patterns: [
              {
                pattern: 'time_of_day',
                description: 'User is most active during the morning',
                strength: 0.85
              },
              {
                pattern: 'session_frequency',
                description: 'User visits approximately 3 times per week',
                strength: 0.7
              }
            ]
          },
          modelInfo: {
            name: 'BehaviorPredictor',
            version: '1.0',
            accuracy: 0.8,
            confidence: 0.75
          }
        }
      }
    });
    
    render(<UserBehaviorPrediction />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/User ID/i), { target: { value: 'user-123' } });
    
    fireEvent.mouseDown(screen.getByLabelText(/Prediction Type/i));
    fireEvent.click(screen.getByText('Next Action'));
    
    fireEvent.change(screen.getByLabelText(/Lookback Days/i), { target: { value: '30' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Predict Behavior/i }));
    
    // Wait for API call and rendering
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/analytics/predictive/user-behavior', {
        userId: 'user-123',
        predictionType: 'next_action',
        lookbackDays: 30,
        includeUserProfile: true
      });
    });
    
    // Check that results are displayed
    await waitFor(() => {
      expect(screen.getByText(/Prediction Results/i)).toBeInTheDocument();
      expect(screen.getByText(/BehaviorPredictor/i)).toBeInTheDocument();
      expect(screen.getByText(/Accuracy: 80.0%/i)).toBeInTheDocument();
      
      // Check user insights
      expect(screen.getByText(/User Insights/i)).toBeInTheDocument();
      expect(screen.getByText(/Activity Level/i)).toBeInTheDocument();
      expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
      expect(screen.getByText(/Top Interests/i)).toBeInTheDocument();
      expect(screen.getByText(/material/i)).toBeInTheDocument();
      expect(screen.getByText(/catalog/i)).toBeInTheDocument();
      expect(screen.getByText(/Usage Patterns/i)).toBeInTheDocument();
      expect(screen.getByText(/User is most active during the morning/i)).toBeInTheDocument();
      expect(screen.getByText(/User visits approximately 3 times per week/i)).toBeInTheDocument();
      
      // Check predictions
      expect(screen.getByText(/Predicted Next Actions/i)).toBeInTheDocument();
      expect(screen.getByText(/search/i)).toBeInTheDocument();
      expect(screen.getByText(/view/i)).toBeInTheDocument();
      expect(screen.getByText(/80%/i)).toBeInTheDocument();
      expect(screen.getByText(/60%/i)).toBeInTheDocument();
      
      // Check chart
      expect(screen.getByText(/Interest Distribution/i)).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });
  });
  
  it('displays an error when the API call fails', async () => {
    // Mock API error
    (axios.post as jest.Mock).mockRejectedValue({
      response: {
        data: {
          message: 'Failed to predict user behavior'
        }
      }
    });
    
    render(<UserBehaviorPrediction />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/User ID/i), { target: { value: 'user-123' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Predict Behavior/i }));
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to predict user behavior/i)).toBeInTheDocument();
    });
  });
  
  it('validates required fields', async () => {
    render(<UserBehaviorPrediction />);
    
    // Submit the form without filling out User ID
    fireEvent.click(screen.getByRole('button', { name: /Predict Behavior/i }));
    
    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText(/User ID is required/i)).toBeInTheDocument();
    });
    
    // Verify API was not called
    expect(axios.post).not.toHaveBeenCalled();
  });
  
  it('toggles user profile inclusion', async () => {
    render(<UserBehaviorPrediction />);
    
    // Check that user profile inclusion is enabled by default
    const switchElement = screen.getByRole('checkbox');
    expect(switchElement).toBeChecked();
    
    // Toggle the switch
    fireEvent.click(switchElement);
    
    // Check that user profile inclusion is now disabled
    expect(switchElement).not.toBeChecked();
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/User ID/i), { target: { value: 'user-123' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Predict Behavior/i }));
    
    // Wait for API call
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/analytics/predictive/user-behavior', {
        userId: 'user-123',
        predictionType: 'next_action',
        lookbackDays: 30,
        includeUserProfile: false // Should be false now
      });
    });
  });
  
  it('changes prediction type', async () => {
    render(<UserBehaviorPrediction />);
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/User ID/i), { target: { value: 'user-123' } });
    
    // Change prediction type to Churn Risk
    fireEvent.mouseDown(screen.getByLabelText(/Prediction Type/i));
    fireEvent.click(screen.getByText('Churn Risk'));
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Predict Behavior/i }));
    
    // Wait for API call
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/analytics/predictive/user-behavior', {
        userId: 'user-123',
        predictionType: 'churn_risk',
        lookbackDays: 30,
        includeUserProfile: true
      });
    });
  });
});
