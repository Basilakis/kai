import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { toast } from 'react-toastify';
import CreditTopupSettings from '../../../components/credit/CreditTopupSettings';
import { api } from '../../../services/api';

// Mock dependencies
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn()
  }
}));

describe('CreditTopupSettings Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock API responses
    (api.get as jest.Mock).mockImplementation((url) => {
      if (url === '/credits/topup/settings') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              setting: {
                id: 'setting-123',
                userId: 'user-123',
                isEnabled: true,
                thresholdAmount: 100,
                topupAmount: 500,
                maxMonthlySpend: 100,
                paymentMethodId: 'pm_123',
                lastTopupAt: '2023-01-01T00:00:00Z',
                monthlySpend: 50,
                monthlySpendResetAt: '2023-02-01T00:00:00Z'
              },
              creditBalance: 750
            }
          }
        });
      }
      
      if (url === '/payment/methods') {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'pm_123',
                brand: 'visa',
                last4: '4242',
                expiryMonth: 12,
                expiryYear: 2025,
                isDefault: true
              },
              {
                id: 'pm_456',
                brand: 'mastercard',
                last4: '5555',
                expiryMonth: 10,
                expiryYear: 2024,
                isDefault: false
              }
            ]
          }
        });
      }
      
      return Promise.reject(new Error('Unexpected URL'));
    });
    
    (api.post as jest.Mock).mockImplementation((url) => {
      if (url === '/credits/topup/settings') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: 'setting-123',
              userId: 'user-123',
              isEnabled: true,
              thresholdAmount: 100,
              topupAmount: 500,
              maxMonthlySpend: 100,
              paymentMethodId: 'pm_123'
            }
          }
        });
      }
      
      return Promise.reject(new Error('Unexpected URL'));
    });
  });

  it('renders the settings with existing data', async () => {
    render(<CreditTopupSettings />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/credits/topup/settings');
      expect(api.get).toHaveBeenCalledWith('/payment/methods');
    });
    
    // Check if the component renders correctly with existing data
    expect(screen.getByText('Automatic Credit Top-up')).toBeInTheDocument();
    expect(screen.getByText('750 credits')).toBeInTheDocument();
    
    // Check if the form is populated with existing settings
    const enableSwitch = screen.getByRole('checkbox', { name: /enable automatic top-up/i });
    expect(enableSwitch).toBeChecked();
    
    expect(screen.getByLabelText('Threshold Amount')).toHaveValue(100);
    expect(screen.getByLabelText('Top-up Amount')).toHaveValue(500);
    
    // Check if monthly limit is enabled and populated
    const monthlyLimitCheckbox = screen.getByRole('checkbox', { name: /set monthly spending limit/i });
    expect(monthlyLimitCheckbox).toBeChecked();
    expect(screen.getByLabelText('Monthly Spending Limit')).toHaveValue(100);
    
    // Check if last topup info is displayed
    expect(screen.getByText(/last automatic top-up/i)).toBeInTheDocument();
    expect(screen.getByText(/monthly spend so far/i)).toBeInTheDocument();
  });

  it('handles form changes correctly', async () => {
    render(<CreditTopupSettings />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/credits/topup/settings');
    });
    
    // Change threshold amount
    fireEvent.change(screen.getByLabelText('Threshold Amount'), { target: { value: '200' } });
    expect(screen.getByLabelText('Threshold Amount')).toHaveValue(200);
    
    // Change topup amount
    fireEvent.change(screen.getByLabelText('Top-up Amount'), { target: { value: '1000' } });
    expect(screen.getByLabelText('Top-up Amount')).toHaveValue(1000);
    
    // Change monthly spending limit
    fireEvent.change(screen.getByLabelText('Monthly Spending Limit'), { target: { value: '200' } });
    expect(screen.getByLabelText('Monthly Spending Limit')).toHaveValue(200);
    
    // Disable monthly limit
    fireEvent.click(screen.getByRole('checkbox', { name: /set monthly spending limit/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText('Monthly Spending Limit')).not.toBeInTheDocument();
    });
    
    // Disable auto top-up
    fireEvent.click(screen.getByRole('checkbox', { name: /enable automatic top-up/i }));
    
    // Check if form fields are disabled
    await waitFor(() => {
      expect(screen.getByLabelText('Threshold Amount')).toBeDisabled();
      expect(screen.getByLabelText('Top-up Amount')).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: /set monthly spending limit/i })).toBeDisabled();
    });
  });

  it('saves settings successfully', async () => {
    const onSavedMock = jest.fn();
    render(<CreditTopupSettings onSaved={onSavedMock} />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/credits/topup/settings');
    });
    
    // Change some settings
    fireEvent.change(screen.getByLabelText('Threshold Amount'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Top-up Amount'), { target: { value: '1000' } });
    
    // Save settings
    fireEvent.click(screen.getByText('Save Settings'));
    
    // Wait for save to complete
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/credits/topup/settings', {
        isEnabled: true,
        thresholdAmount: 200,
        topupAmount: 1000,
        maxMonthlySpend: 100,
        paymentMethodId: 'pm_123'
      });
      expect(toast.success).toHaveBeenCalledWith('Auto top-up settings saved successfully');
      expect(onSavedMock).toHaveBeenCalled();
    });
  });

  it('handles save errors', async () => {
    // Mock API error
    (api.post as jest.Mock).mockRejectedValueOnce(new Error('Failed to save settings'));
    
    render(<CreditTopupSettings />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/credits/topup/settings');
    });
    
    // Save settings
    fireEvent.click(screen.getByText('Save Settings'));
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to save settings');
      expect(screen.getByText('Failed to save settings')).toBeInTheDocument();
    });
  });

  it('validates required fields', async () => {
    render(<CreditTopupSettings />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/credits/topup/settings');
    });
    
    // Remove payment method
    fireEvent.mouseDown(screen.getByLabelText('Payment Method'));
    fireEvent.click(screen.getByText('visa •••• 4242 (expires 12/2025)'));
    
    // Try to save without payment method
    fireEvent.click(screen.getByText('Save Settings'));
    
    // No API call should be made
    expect(api.post).not.toHaveBeenCalled();
  });
});
