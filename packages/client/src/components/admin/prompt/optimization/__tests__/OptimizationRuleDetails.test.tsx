import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SnackbarProvider } from 'notistack';
import axios from 'axios';
import OptimizationRuleDetails from '../OptimizationRuleDetails';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock data
const mockRule = {
  id: 'rule-1',
  name: 'Test Rule',
  description: 'A test optimization rule',
  ruleType: 'low_success_rate',
  ruleParameters: {
    threshold: 50,
    lookbackDays: 7
  },
  isActive: true,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-02T00:00:00Z',
  lastExecutedAt: '2023-01-03T00:00:00Z'
};

const mockActions = [
  {
    id: 'action-1',
    ruleId: 'rule-1',
    actionType: 'execute_low_success_rate',
    status: 'pending',
    details: { promptId: 'prompt-1' },
    createdAt: '2023-01-03T00:00:00Z'
  },
  {
    id: 'action-2',
    ruleId: 'rule-1',
    actionType: 'execute_low_success_rate',
    status: 'completed',
    details: { promptId: 'prompt-2' },
    createdAt: '2023-01-02T00:00:00Z',
    executedAt: '2023-01-02T00:05:00Z'
  }
];

const mockPerformance = {
  executionCount: 10,
  successCount: 8,
  failureCount: 2,
  averageExecutionTime: 2.5,
  lastExecutionTime: '2023-01-03T00:00:00Z',
  actionsByStatus: {
    pending: 1,
    completed: 8,
    failed: 1
  },
  executionHistory: [
    {
      date: '2023-01-01',
      executionCount: 3,
      successCount: 2,
      failureCount: 1
    },
    {
      date: '2023-01-02',
      executionCount: 4,
      successCount: 4,
      failureCount: 0
    },
    {
      date: '2023-01-03',
      executionCount: 3,
      successCount: 2,
      failureCount: 1
    }
  ]
};

// Mock component wrapper
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <SnackbarProvider maxSnack={3}>
      {ui}
    </SnackbarProvider>
  );
};

describe('OptimizationRuleDetails', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
  });

  it('renders rule information correctly', async () => {
    // Mock API responses
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('/actions')) {
        return Promise.resolve({ data: { success: true, data: mockActions } });
      } else if (url.includes('/performance')) {
        return Promise.resolve({ data: { success: true, data: mockPerformance } });
      }
      return Promise.reject(new Error('Not found'));
    });

    renderWithProviders(<OptimizationRuleDetails rule={mockRule} />);

    // Check rule information is displayed
    expect(screen.getByText('Test Rule')).toBeInTheDocument();
    expect(screen.getByText('Low Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Wait for API calls to complete
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    // Check tabs are present
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Parameters')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('displays rule parameters correctly', async () => {
    // Mock API responses
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('/actions')) {
        return Promise.resolve({ data: { success: true, data: mockActions } });
      } else if (url.includes('/performance')) {
        return Promise.resolve({ data: { success: true, data: mockPerformance } });
      }
      return Promise.reject(new Error('Not found'));
    });

    renderWithProviders(<OptimizationRuleDetails rule={mockRule} />);

    // Wait for API calls to complete
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    // Switch to Parameters tab
    fireEvent.click(screen.getByText('Parameters'));

    // Check parameters are displayed
    expect(screen.getByText('threshold')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('lookbackDays')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('displays performance metrics correctly', async () => {
    // Mock API responses
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('/actions')) {
        return Promise.resolve({ data: { success: true, data: mockActions } });
      } else if (url.includes('/performance')) {
        return Promise.resolve({ data: { success: true, data: mockPerformance } });
      }
      return Promise.reject(new Error('Not found'));
    });

    renderWithProviders(<OptimizationRuleDetails rule={mockRule} />);

    // Wait for API calls to complete
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    // Switch to Performance tab
    fireEvent.click(screen.getByText('Performance'));

    // Check performance metrics are displayed
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
    expect(screen.getByText('Execution Count')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('80.00%')).toBeInTheDocument();
  });

  it('displays actions correctly', async () => {
    // Mock API responses
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('/actions')) {
        return Promise.resolve({ data: { success: true, data: mockActions } });
      } else if (url.includes('/performance')) {
        return Promise.resolve({ data: { success: true, data: mockPerformance } });
      }
      return Promise.reject(new Error('Not found'));
    });

    renderWithProviders(<OptimizationRuleDetails rule={mockRule} />);

    // Wait for API calls to complete
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    // Switch to Actions tab
    fireEvent.click(screen.getByText('Actions'));

    // Check actions are displayed
    expect(screen.getByText('Action ID')).toBeInTheDocument();
    expect(screen.getByText('action-1')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('action-2')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('executes an action when the Execute button is clicked', async () => {
    // Mock API responses
    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('/actions')) {
        return Promise.resolve({ data: { success: true, data: mockActions } });
      } else if (url.includes('/performance')) {
        return Promise.resolve({ data: { success: true, data: mockPerformance } });
      }
      return Promise.reject(new Error('Not found'));
    });

    mockedAxios.post.mockResolvedValue({
      data: { success: true, data: { message: 'Action executed successfully' } }
    });

    const onRefreshMock = jest.fn();
    renderWithProviders(<OptimizationRuleDetails rule={mockRule} onRefresh={onRefreshMock} />);

    // Wait for API calls to complete
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    // Switch to Actions tab
    fireEvent.click(screen.getByText('Actions'));

    // Click the Execute button
    const executeButton = screen.getAllByText('Execute')[0];
    fireEvent.click(executeButton);

    // Wait for the action to be executed
    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/admin/prompt-optimization/actions/action-1/execute');
      expect(onRefreshMock).toHaveBeenCalled();
    });
  });

  it('handles API errors gracefully', async () => {
    // Mock API error responses
    mockedAxios.get.mockRejectedValue(new Error('API error'));

    renderWithProviders(<OptimizationRuleDetails rule={mockRule} />);

    // Wait for API calls to attempt
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    // Should still render the component without crashing
    expect(screen.getByText('Test Rule')).toBeInTheDocument();
  });
});
