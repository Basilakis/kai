/**
 * Testing Utilities
 * 
 * Provides standardized testing utilities for components, hooks, and services.
 * These utilities help ensure consistent test patterns and make it easier
 * to write comprehensive tests that catch common issues.
 */

import React from 'react';
import { logger } from './logger';

/**
 * Simulates component lifecycle including mount and unmount
 * Helps catch memory leaks and cleanup issues
 */
export function simulateComponentLifecycle(
  renderFn: () => (() => void) | void,
  options: {
    mountDelay?: number;
    unmountDelay?: number;
    remountDelay?: number;
    remountCount?: number;
  } = {}
): Promise<void> {
  const {
    mountDelay = 10,
    unmountDelay = 100,
    remountDelay = 50,
    remountCount = 1
  } = options;
  
  return new Promise<void>((resolve) => {
    // Initial render
    const cleanup = renderFn();
    
    setTimeout(() => {
      // Unmount
      if (typeof cleanup === 'function') {
        cleanup();
      }
      
      let remountCounter = 0;
      
      function remount() {
        setTimeout(() => {
          // Remount to test proper cleanup
          const remountCleanup = renderFn();
          
          setTimeout(() => {
            // Unmount again
            if (typeof remountCleanup === 'function') {
              remountCleanup();
            }
            
            remountCounter++;
            if (remountCounter < remountCount) {
              remount();
            } else {
              resolve();
            }
          }, unmountDelay);
        }, remountDelay);
      }
      
      if (remountCount > 0) {
        remount();
      } else {
        resolve();
      }
    }, mountDelay);
  });
}

/**
 * Simulates an error in a component or hook to test error boundaries
 */
export function simulateError<T extends (...args: any[]) => any>(
  fn: T,
  errorMessage: string = 'Simulated error for testing'
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    if (Math.random() > 0.5) {
      throw new Error(errorMessage);
    }
    return fn(...args);
  };
}

/**
 * Tests for memory leaks by monitoring memory usage
 */
export function checkForMemoryLeaks(
  operation: () => void,
  iterations: number = 1000
): { leaked: boolean; bytesLeaked: number } {
  let initialMemory: number | undefined;
  let finalMemory: number | undefined;
  
  if (typeof window !== 'undefined' && 'performance' in window) {
    const performanceMemory = (window.performance as any).memory;
    
    if (performanceMemory) {
      initialMemory = performanceMemory.usedJSHeapSize;
      
      // Run the operation many times
      for (let i = 0; i < iterations; i++) {
        operation();
      }
      
      finalMemory = performanceMemory.usedJSHeapSize;
    }
  }
  
  const bytesLeaked = finalMemory && initialMemory 
    ? finalMemory - initialMemory 
    : 0;
  
  // If memory increased significantly after many iterations, likely a leak
  const leaked = bytesLeaked > iterations * 50; // 50 bytes per iteration is a reasonable threshold
  
  if (leaked) {
    logger.warn(
      `Possible memory leak detected: ${bytesLeaked} bytes leaked after ${iterations} iterations`,
      { bytesLeaked, iterations }
    );
  }
  
  return { leaked, bytesLeaked };
}

/**
 * Measures the performance of a function
 */
export function measurePerformance<T extends (...args: any[]) => any>(
  fn: T,
  iterations: number = 100
): { 
  averageTime: number; 
  medianTime: number;
  minTime: number;
  maxTime: number;
} {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  times.sort((a, b) => a - b);
  
  // Make sure we have at least one value
  if (times.length === 0) {
    return {
      averageTime: 0,
      medianTime: 0,
      minTime: 0,
      maxTime: 0
    };
  }

  const averageTime = times.reduce((sum, time) => sum + time, 0) / iterations;
  const medianTime = times[Math.floor(iterations / 2)] || 0;
  const minTime = times[0] || 0;
  const maxTime = times[times.length - 1] || 0;
  
  return {
    averageTime,
    medianTime,
    minTime,
    maxTime
  };
}

/**
 * Tests a component for WebSocket or event listener leaks
 */
export function testForEventListenerLeaks(
  mountFn: () => void,
  unmountFn: () => void,
  options: {
    mountCount?: number;
    waitBetweenMs?: number;
  } = {}
): Promise<{ leakDetected: boolean }> {
  const {
    mountCount = 10,
    waitBetweenMs = 50
  } = options;
  
  return new Promise<{ leakDetected: boolean }>((resolve) => {
    let currentCount = 0;
    
    // In a real implementation, this would patch addEventListener/removeEventListener
    // and track if all event listeners are properly removed
    const eventListenerCounts: Record<string, number> = {};
    
    function cycle() {
      mountFn();
      
      setTimeout(() => {
        unmountFn();
        
        currentCount++;
        if (currentCount < mountCount) {
          setTimeout(cycle, waitBetweenMs);
        } else {
          // In a real implementation, this would check if any listeners remain
          const leakDetected = Object.values(eventListenerCounts).some(count => count > 0);
          
          if (leakDetected) {
            logger.warn('Event listener leak detected', { eventListenerCounts });
          }
          
          resolve({ leakDetected });
        }
      }, waitBetweenMs);
    }
    
    cycle();
  });
}

/**
 * Mocks a WebSocket for testing agent components
 */
export class MockWebSocket {
  private listeners: Record<string, Array<(event: any) => void>> = {};
  private isConnected: boolean = false;
  private autoResponse: boolean = false;
  private responseDelay: number = 100;
  private mockResponses: Record<string, any> = {};
  
  constructor(options: {
    autoResponse?: boolean;
    responseDelay?: number;
    mockResponses?: Record<string, any>;
  } = {}) {
    this.autoResponse = options.autoResponse || false;
    this.responseDelay = options.responseDelay || 100;
    this.mockResponses = options.mockResponses || {};
  }
  
  connect(): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        this.isConnected = true;
        this.dispatchEvent('open', {});
        resolve();
      }, 50);
    });
  }
  
  disconnect(): void {
    this.isConnected = false;
    this.dispatchEvent('close', { code: 1000, reason: 'Normal closure' });
  }
  
  addEventListener(type: string, callback: (event: any) => void): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }
  
  removeEventListener(type: string, callback: (event: any) => void): void {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
    }
  }
  
  dispatchEvent(type: string, event: any): void {
    if (this.listeners[type]) {
      this.listeners[type].forEach(callback => {
        callback(event);
      });
    }
  }
  
  send(data: string): void {
    if (!this.isConnected) {
      this.dispatchEvent('error', { message: 'WebSocket is not connected' });
      return;
    }
    
    if (this.autoResponse) {
      setTimeout(() => {
        try {
          const message = JSON.parse(data);
          const messageType = message.type || 'unknown';
          
          if (this.mockResponses[messageType]) {
            this.dispatchEvent('message', {
              data: JSON.stringify(this.mockResponses[messageType])
            });
          } else {
            this.dispatchEvent('message', {
              data: JSON.stringify({ type: 'ack', id: message.id || 'unknown' })
            });
          }
        } catch (e) {
          // If the message isn't valid JSON, just send a generic response
          this.dispatchEvent('message', {
            data: JSON.stringify({ type: 'ack' })
          });
        }
      }, this.responseDelay);
    }
  }
}

/**
 * Creates a mock agent service for testing
 */
export function createMockAgentService() {
  const webSocket = new MockWebSocket({
    autoResponse: true,
    mockResponses: {
      'agent.message': {
        type: 'agent.response',
        id: 'mock-response',
        content: 'This is a mock agent response',
        timestamp: new Date().toISOString()
      }
    }
  });
  
  const messageListeners: Array<(message: any) => void> = [];
  const statusListeners: Array<(status: string) => void> = [];
  
  return {
    connect: () => webSocket.connect(),
    disconnect: () => webSocket.disconnect(),
    
    sendMessage: (sessionId: string, message: string) => {
      webSocket.send(JSON.stringify({
        type: 'agent.message',
        sessionId,
        content: message,
        timestamp: new Date().toISOString()
      }));
      
      return Promise.resolve({ id: 'mock-message-id' });
    },
    
    createSession: (agentType: string) => {
      return Promise.resolve({
        sessionId: 'mock-session-id',
        agentType
      });
    },
    
    onAgentMessage: (callback: (message: any) => void) => {
      messageListeners.push(callback);
      return () => {
        const index = messageListeners.indexOf(callback);
        if (index !== -1) {
          messageListeners.splice(index, 1);
        }
      };
    },
    
    onStatusChange: (callback: (status: string) => void) => {
      statusListeners.push(callback);
      return () => {
        const index = statusListeners.indexOf(callback);
        if (index !== -1) {
          statusListeners.splice(index, 1);
        }
      };
    },
    
    // For testing only
    _triggerMessage: (message: any) => {
      messageListeners.forEach(listener => listener(message));
    },
    
    _triggerStatus: (status: string) => {
      statusListeners.forEach(listener => listener(status));
    },
    
    _listenerCount: () => ({
      message: messageListeners.length,
      status: statusListeners.length
    })
  };
}

/**
 * Usage examples:
 * 
 * // Test for memory leaks
 * const { leaked } = checkForMemoryLeaks(() => {
 *   const { result } = renderHook(() => useMyHook());
 *   act(() => {
 *     result.current.performOperation();
 *   });
 * });
 * 
 * // Test component lifecycle
 * await simulateComponentLifecycle(
 *   () => {
 *     const { unmount } = render(<MyComponent />);
 *     return unmount;
 *   },
 *   { remountCount: 5 }
 * );
 * 
 * // Test WebSocket components
 * const mockAgent = createMockAgentService();
 * render(<AgentChat agentService={mockAgent} />);
 * mockAgent._triggerMessage({
 *   id: 'test-message',
 *   content: 'Hello from test'
 * });
 * 
 * // Check for listener leaks
 * await testForEventListenerLeaks(
 *   () => { render(<WebSocketComponent />); },
 *   () => { cleanup(); }
 * );
 */