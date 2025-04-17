import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import TimeSeriesForecast from '../TimeSeriesForecast';

// Mock dependencies
jest.mock('axios');
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    LineChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="line-chart">{children}</div>
    ),
    Line: () => <div data-testid="chart-line" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />
  };
});

describe('TimeSeriesForecast Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders the form correctly', () => {
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <TimeSeriesForecast />
      </LocalizationProvider>
    );
    
    // Check form elements
    expect(screen.getByLabelText(/Event Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Resource Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Forecast Periods/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Interval/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Forecast/i })).toBeInTheDocument();
  });
  
  it('submits the form and displays forecast results', async () => {
    // Mock API response
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        data: {
          id: 'forecast-123',
          historical: [
            { date: '2023-01-01T00:00:00Z', count: 10 },
            { date: '2023-01-02T00:00:00Z', count: 15 }
          ],
          forecast: [
            { date: '2023-01-03T00:00:00Z', count: 12, is_forecast: true },
            { date: '2023-01-04T00:00:00Z', count: 14, is_forecast: true }
          ],
          parameters: {
            eventType: 'search',
            resourceType: 'material',
            startDate: '2023-01-01T00:00:00Z',
            endDate: '2023-01-02T00:00:00Z',
            forecastPeriods: 2,
            interval: 'day'
          },
          modelInfo: {
            name: 'TimeSeriesForecaster',
            version: '1.0',
            accuracy: 0.85,
            confidence: 0.9
          }
        }
      }
    });
    
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <TimeSeriesForecast />
      </LocalizationProvider>
    );
    
    // Fill out the form
    fireEvent.mouseDown(screen.getByLabelText(/Event Type/i));
    fireEvent.click(screen.getByText('Search'));
    
    fireEvent.mouseDown(screen.getByLabelText(/Resource Type/i));
    fireEvent.click(screen.getByText('Material'));
    
    fireEvent.change(screen.getByLabelText(/Forecast Periods/i), { target: { value: '7' } });
    
    fireEvent.mouseDown(screen.getByLabelText(/Interval/i));
    fireEvent.click(screen.getByText('Day'));
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Generate Forecast/i }));
    
    // Wait for API call and rendering
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/analytics/predictive/forecast', expect.any(Object));
    });
    
    // Check that results are displayed
    await waitFor(() => {
      expect(screen.getByText(/Forecast Results/i)).toBeInTheDocument();
      expect(screen.getByText(/TimeSeriesForecaster/i)).toBeInTheDocument();
      expect(screen.getByText(/Accuracy: 85.0%/i)).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });
  
  it('displays an error when the API call fails', async () => {
    // Mock API error
    (axios.post as jest.Mock).mockRejectedValue({
      response: {
        data: {
          message: 'Failed to generate forecast'
        }
      }
    });
    
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <TimeSeriesForecast />
      </LocalizationProvider>
    );
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Generate Forecast/i }));
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to generate forecast/i)).toBeInTheDocument();
    });
  });
  
  it('validates required fields', async () => {
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <TimeSeriesForecast />
      </LocalizationProvider>
    );
    
    // Clear start date
    const startDateInput = screen.getByLabelText(/Start Date/i);
    fireEvent.change(startDateInput, { target: { value: '' } });
    
    // Clear end date
    const endDateInput = screen.getByLabelText(/End Date/i);
    fireEvent.change(endDateInput, { target: { value: '' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Generate Forecast/i }));
    
    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText(/Start date and end date are required/i)).toBeInTheDocument();
    });
    
    // Verify API was not called
    expect(axios.post).not.toHaveBeenCalled();
  });
});
