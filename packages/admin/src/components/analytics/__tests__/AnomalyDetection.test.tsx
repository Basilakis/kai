import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import AnomalyDetection from '../AnomalyDetection';

// Mock dependencies
jest.mock('axios');
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    ScatterChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="scatter-chart">{children}</div>
    ),
    Scatter: () => <div data-testid="scatter" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    ZAxis: () => <div data-testid="z-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
    ReferenceLine: () => <div data-testid="reference-line" />
  };
});

describe('AnomalyDetection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders the form correctly', () => {
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AnomalyDetection />
      </LocalizationProvider>
    );
    
    // Check form elements
    expect(screen.getByLabelText(/Event Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Resource Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Interval/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Threshold/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Detect Anomalies/i })).toBeInTheDocument();
  });
  
  it('submits the form and displays anomaly results', async () => {
    // Mock API response
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        data: {
          id: 'anomaly-123',
          timeSeries: [
            { date: '2023-01-01T00:00:00Z', count: 10 },
            { date: '2023-01-02T00:00:00Z', count: 15 },
            { date: '2023-01-03T00:00:00Z', count: 50 }
          ],
          anomalies: [
            { 
              date: '2023-01-03T00:00:00Z', 
              count: 50, 
              mean: 15, 
              stdDev: 5, 
              zScore: 7, 
              severity: 'high' 
            }
          ],
          statistics: {
            mean: 15,
            stdDev: 5,
            threshold: 2
          },
          parameters: {
            eventType: 'search',
            resourceType: 'material',
            startDate: '2023-01-01T00:00:00Z',
            endDate: '2023-01-03T00:00:00Z',
            interval: 'day'
          }
        }
      }
    });
    
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AnomalyDetection />
      </LocalizationProvider>
    );
    
    // Fill out the form
    fireEvent.mouseDown(screen.getByLabelText(/Event Type/i));
    fireEvent.click(screen.getByText('Search'));
    
    fireEvent.mouseDown(screen.getByLabelText(/Resource Type/i));
    fireEvent.click(screen.getByText('Material'));
    
    fireEvent.change(screen.getByLabelText(/Threshold/i), { target: { value: '2.5' } });
    
    fireEvent.mouseDown(screen.getByLabelText(/Interval/i));
    fireEvent.click(screen.getByText('Day'));
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Detect Anomalies/i }));
    
    // Wait for API call and rendering
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/analytics/predictive/anomalies', expect.any(Object));
    });
    
    // Check that results are displayed
    await waitFor(() => {
      expect(screen.getByText(/Anomaly Detection Results/i)).toBeInTheDocument();
      expect(screen.getByText(/Mean: 15.00/i)).toBeInTheDocument();
      expect(screen.getByText(/Standard Deviation: 5.00/i)).toBeInTheDocument();
      expect(screen.getByText(/Threshold: 2.0/i)).toBeInTheDocument();
      expect(screen.getByTestId('scatter-chart')).toBeInTheDocument();
      expect(screen.getByText(/Detected Anomalies/i)).toBeInTheDocument();
      expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
    });
  });
  
  it('displays an error when the API call fails', async () => {
    // Mock API error
    (axios.post as jest.Mock).mockRejectedValue({
      response: {
        data: {
          message: 'Failed to detect anomalies'
        }
      }
    });
    
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AnomalyDetection />
      </LocalizationProvider>
    );
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Detect Anomalies/i }));
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to detect anomalies/i)).toBeInTheDocument();
    });
  });
  
  it('validates required fields', async () => {
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AnomalyDetection />
      </LocalizationProvider>
    );
    
    // Clear start date
    const startDateInput = screen.getByLabelText(/Start Date/i);
    fireEvent.change(startDateInput, { target: { value: '' } });
    
    // Clear end date
    const endDateInput = screen.getByLabelText(/End Date/i);
    fireEvent.change(endDateInput, { target: { value: '' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Detect Anomalies/i }));
    
    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText(/Start date and end date are required/i)).toBeInTheDocument();
    });
    
    // Verify API was not called
    expect(axios.post).not.toHaveBeenCalled();
  });
  
  it('displays a message when no anomalies are detected', async () => {
    // Mock API response with no anomalies
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        data: {
          id: 'anomaly-123',
          timeSeries: [
            { date: '2023-01-01T00:00:00Z', count: 10 },
            { date: '2023-01-02T00:00:00Z', count: 15 },
            { date: '2023-01-03T00:00:00Z', count: 12 }
          ],
          anomalies: [], // No anomalies
          statistics: {
            mean: 12.33,
            stdDev: 2.05,
            threshold: 2
          },
          parameters: {
            eventType: 'search',
            resourceType: 'material',
            startDate: '2023-01-01T00:00:00Z',
            endDate: '2023-01-03T00:00:00Z',
            interval: 'day'
          }
        }
      }
    });
    
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <AnomalyDetection />
      </LocalizationProvider>
    );
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Detect Anomalies/i }));
    
    // Wait for API call and rendering
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
    });
    
    // Check that "no anomalies" message is displayed
    await waitFor(() => {
      expect(screen.getByText(/No anomalies detected with the current threshold/i)).toBeInTheDocument();
    });
  });
});
