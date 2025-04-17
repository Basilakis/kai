import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { toast } from 'react-toastify';
import TwoFactorSetup from '../../../components/auth/TwoFactorSetup';
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

jest.mock('qrcode.react', () => ({
  __esModule: true,
  default: () => <div data-testid="qr-code">QR Code</div>
}));

describe('TwoFactorSetup Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock API responses
    (api.get as jest.Mock).mockImplementation((url) => {
      if (url === '/auth/2fa/methods') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              methods: ['totp', 'sms', 'email']
            }
          }
        });
      }
      
      if (url === '/auth/2fa/backup-codes') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              codes: ['code1', 'code2', 'code3', 'code4', 'code5']
            }
          }
        });
      }
      
      return Promise.reject(new Error('Unexpected URL'));
    });
    
    (api.post as jest.Mock).mockImplementation((url) => {
      if (url === '/auth/2fa/setup/totp') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              secret: 'test-secret',
              qrCodeUrl: 'otpauth://totp/test@example.com?secret=test-secret&issuer=KAI'
            }
          }
        });
      }
      
      if (url === '/auth/2fa/verify') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              isValid: true
            }
          }
        });
      }
      
      if (url === '/auth/2fa/enable') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              isEnabled: true
            }
          }
        });
      }
      
      return Promise.reject(new Error('Unexpected URL'));
    });
  });

  it('renders the initial setup screen', async () => {
    render(<TwoFactorSetup />);
    
    // Wait for methods to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/2fa/methods');
    });
    
    // Check if the component renders correctly
    expect(screen.getByText('Set Up Two-Factor Authentication')).toBeInTheDocument();
    expect(screen.getByText('Two-factor authentication adds an extra layer of security to your account.')).toBeInTheDocument();
    expect(screen.getByText('Authentication Method')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('allows selecting different authentication methods', async () => {
    render(<TwoFactorSetup />);
    
    // Wait for methods to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/2fa/methods');
    });
    
    // Select SMS method
    fireEvent.mouseDown(screen.getByLabelText('Authentication Method'));
    fireEvent.click(screen.getByText('SMS'));
    
    // Check if phone number field appears
    expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
    
    // Select Email method
    fireEvent.mouseDown(screen.getByLabelText('Authentication Method'));
    fireEvent.click(screen.getByText('Email'));
    
    // Check if email field appears
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  });

  it('handles TOTP setup flow', async () => {
    const onCompleteMock = jest.fn();
    render(<TwoFactorSetup onComplete={onCompleteMock} />);
    
    // Wait for methods to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/2fa/methods');
    });
    
    // Start TOTP setup
    fireEvent.click(screen.getByText('Continue'));
    
    // Wait for TOTP setup to complete
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/2fa/setup/totp');
      expect(screen.getByText('Scan this QR code with your authenticator app:')).toBeInTheDocument();
      expect(screen.getByTestId('qr-code')).toBeInTheDocument();
    });
    
    // Enter verification code
    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    
    // Verify and enable
    fireEvent.click(screen.getByText('Verify & Enable'));
    
    // Wait for verification and enabling to complete
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/2fa/verify', { 
        method: 'totp', 
        code: '123456'
      });
      expect(api.post).toHaveBeenCalledWith('/auth/2fa/enable', { method: 'totp' });
      expect(api.get).toHaveBeenCalledWith('/auth/2fa/backup-codes');
    });
    
    // Check if backup codes are displayed
    expect(screen.getByText('Two-factor authentication enabled successfully!')).toBeInTheDocument();
    expect(screen.getByText('Backup Codes (save these somewhere safe):')).toBeInTheDocument();
    expect(screen.getByText('code1')).toBeInTheDocument();
    
    // Complete setup
    fireEvent.click(screen.getByText('Done'));
    expect(onCompleteMock).toHaveBeenCalled();
  });

  it('handles errors during setup', async () => {
    // Mock API error
    (api.post as jest.Mock).mockRejectedValueOnce(new Error('Failed to set up TOTP'));
    
    render(<TwoFactorSetup />);
    
    // Wait for methods to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/2fa/methods');
    });
    
    // Start TOTP setup
    fireEvent.click(screen.getByText('Continue'));
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to set up TOTP authentication');
      expect(screen.getByText('Failed to set up TOTP authentication')).toBeInTheDocument();
    });
  });

  it('handles errors during verification', async () => {
    // Mock API success for setup but failure for verification
    (api.post as jest.Mock).mockImplementation((url) => {
      if (url === '/auth/2fa/setup/totp') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              secret: 'test-secret',
              qrCodeUrl: 'otpauth://totp/test@example.com?secret=test-secret&issuer=KAI'
            }
          }
        });
      }
      
      if (url === '/auth/2fa/verify') {
        return Promise.reject(new Error('Invalid verification code'));
      }
      
      return Promise.reject(new Error('Unexpected URL'));
    });
    
    render(<TwoFactorSetup />);
    
    // Wait for methods to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/2fa/methods');
    });
    
    // Start TOTP setup
    fireEvent.click(screen.getByText('Continue'));
    
    // Wait for TOTP setup to complete
    await waitFor(() => {
      expect(screen.getByText('Scan this QR code with your authenticator app:')).toBeInTheDocument();
    });
    
    // Enter verification code
    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    
    // Verify and enable
    fireEvent.click(screen.getByText('Verify & Enable'));
    
    // Wait for verification error
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to verify code');
      expect(screen.getByText('Invalid verification code')).toBeInTheDocument();
    });
  });
});
