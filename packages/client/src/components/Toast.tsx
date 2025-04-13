import React, { useState, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  type: ToastType;
  message: string;
  duration?: number;
  onClose?: () => void;
  show: boolean;
}

/**
 * Toast Notification Component
 * 
 * Displays a toast notification message that automatically disappears after a duration
 * Used for providing feedback about authentication actions and other system events
 */
const Toast: React.FC<ToastProps> = ({ 
  type, 
  message, 
  duration = 5000, 
  onClose, 
  show 
}) => {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
    
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!isVisible) return null;

  const getToastStyles = (): string => {
    const baseStyles = "fixed top-4 right-4 z-50 flex items-center p-4 mb-4 max-w-xs rounded-lg shadow";
    
    switch (type) {
      case 'success':
        return `${baseStyles} text-green-800 bg-green-50 dark:bg-gray-800 dark:text-green-400`;
      case 'error':
        return `${baseStyles} text-red-800 bg-red-50 dark:bg-gray-800 dark:text-red-400`;
      case 'warning':
        return `${baseStyles} text-yellow-800 bg-yellow-50 dark:bg-gray-800 dark:text-yellow-300`;
      case 'info':
      default:
        return `${baseStyles} text-blue-800 bg-blue-50 dark:bg-gray-800 dark:text-blue-400`;
    }
  };

  const getIconStyles = (): string => {
    const baseStyles = "inline w-5 h-5 mr-3";
    
    switch (type) {
      case 'success':
        return `${baseStyles} text-green-500 dark:text-green-400`;
      case 'error':
        return `${baseStyles} text-red-500 dark:text-red-400`;
      case 'warning':
        return `${baseStyles} text-yellow-500 dark:text-yellow-300`;
      case 'info':
      default:
        return `${baseStyles} text-blue-500 dark:text-blue-400`;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className={getIconStyles()} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
          </svg>
        );
      case 'error':
        return (
          <svg className={getIconStyles()} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
          </svg>
        );
      case 'warning':
        return (
          <svg className={getIconStyles()} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className={getIconStyles()} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
          </svg>
        );
    }
  };

  return (
    <div 
      className={`${getToastStyles()} animate-fade-in-down`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center">
        {getIcon()}
        <div className="text-sm font-normal">{message}</div>
      </div>
      <button
        type="button"
        className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700"
        aria-label="Close"
        onClick={() => {
          setIsVisible(false);
          if (onClose) onClose();
        }}
      >
        <span className="sr-only">Close</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
        </svg>
      </button>
    </div>
  );
};

export default Toast;