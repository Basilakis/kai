import React, { useState, ReactNode } from 'react';
import Toast, { ToastType } from '../components/Toast';

// Create a simple toast manager object pattern instead of using context
class ToastManager {
  private static instance: ToastManager;
  private listeners: Array<(show: boolean, type: ToastType, message: string, duration: number) => void> = [];

  // Private constructor for singleton pattern
  private constructor() {}

  // Get the single instance
  public static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  // Add a listener
  public addListener(callback: (show: boolean, type: ToastType, message: string, duration: number) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Show a toast
  public showToast(type: ToastType, message: string, duration = 5000): void {
    this.listeners.forEach(listener => listener(true, type, message, duration));
  }

  // Hide toast
  public hideToast(): void {
    this.listeners.forEach(listener => listener(false, 'info', '', 0));
  }
}

// Export the manager for direct use
export const toastManager = ToastManager.getInstance();

// Simple helper functions to use throughout the app
export const showSuccessToast = (message: string, duration?: number) => 
  toastManager.showToast('success', message, duration);

export const showErrorToast = (message: string, duration?: number) => 
  toastManager.showToast('error', message, duration);

export const showInfoToast = (message: string, duration?: number) => 
  toastManager.showToast('info', message, duration);

export const showWarningToast = (message: string, duration?: number) => 
  toastManager.showToast('warning', message, duration);

export const hideToast = () => toastManager.hideToast();

interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Toast Provider Component
 * 
 * Wraps the app and manages toast state
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState({
    show: false,
    type: 'info' as ToastType,
    message: '',
    duration: 5000,
  });

  // Subscribe to toast manager
  React.useEffect(() => {
    const unsubscribe = toastManager.addListener((show, type, message, duration) => {
      setToast({ show, type, message, duration });
    });
    
    // Clean up subscription
    return unsubscribe;
  }, []);

  return (
    <>
      {children}
      <Toast
        show={toast.show}
        type={toast.type}
        message={toast.message}
        duration={toast.duration}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </>
  );
};

export default ToastProvider;