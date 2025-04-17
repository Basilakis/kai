// Type definitions for Jest and testing libraries

// Try to use the actual Jest types if available, otherwise fall back to our definitions
/// <reference types="jest" />

/**
 * Jest namespace with all the required types and functions
 */
declare namespace jest {
  /**
   * Mock function interface with all required methods
   */
  interface Mock<T = any, Y extends any[] = any[]> {
    (...args: Y): T;
    mockClear(): void;
    mockReset(): void;
    mockRestore(): void;
    mockImplementation(fn: (...args: Y) => T): this;
    mockImplementationOnce(fn: (...args: Y) => T): this;
    mockReturnValue(value: T): this;
    mockReturnValueOnce(value: T): this;
    mockResolvedValue(value: T): this;
    mockResolvedValueOnce(value: T): this;
    mockRejectedValue(value: any): this;
    mockRejectedValueOnce(value: any): this;
  }

  // Jest functions
  function fn<T = any, Y extends any[] = any[]>(): Mock<T, Y>;
  function clearAllMocks(): void;
  function resetAllMocks(): void;
  function restoreAllMocks(): void;
  function spyOn<T extends object, M extends keyof T>(object: T, method: M): Mock<T[M]>;
  function mock(moduleName: string, factory?: any): void;
}

/**
 * Testing Library type definitions
 */
declare module '@testing-library/react' {
  export interface RenderResult {
    container: HTMLElement;
    getByText: (text: string | RegExp) => HTMLElement;
    getAllByText: (text: string | RegExp) => HTMLElement[];
    getByTestId: (testId: string) => HTMLElement;
    getAllByTestId: (testId: string) => HTMLElement[];
    getByLabelText: (label: string | RegExp) => HTMLElement;
    getAllByLabelText: (label: string | RegExp) => HTMLElement[];
    queryByText: (text: string | RegExp) => HTMLElement | null;
    queryAllByText: (text: string | RegExp) => HTMLElement[];
    queryByTestId: (testId: string) => HTMLElement | null;
    queryAllByTestId: (testId: string) => HTMLElement[];
    findByText: (text: string | RegExp) => Promise<HTMLElement>;
    findAllByText: (text: string | RegExp) => Promise<HTMLElement[]>;
    findByTestId: (testId: string) => Promise<HTMLElement>;
    findAllByTestId: (testId: string) => Promise<HTMLElement[]>;
    debug: (element?: HTMLElement) => void;
    rerender: (ui: React.ReactElement) => void;
    unmount: () => void;
  }
  
  export function render(ui: React.ReactElement, options?: any): RenderResult;
  
  export const fireEvent: {
    click: (element: HTMLElement) => void;
    change: (element: HTMLElement, options: any) => void;
    submit: (element: HTMLElement) => void;
  };
  
  export function waitFor<T>(callback: () => T | Promise<T>, options?: any): Promise<T>;
  export const screen: {
    getByText: (text: string | RegExp) => HTMLElement;
    getAllByText: (text: string | RegExp) => HTMLElement[];
    getByTestId: (testId: string) => HTMLElement;
    getAllByTestId: (testId: string) => HTMLElement[];
    getByLabelText: (label: string | RegExp) => HTMLElement;
    getAllByLabelText: (label: string | RegExp) => HTMLElement[];
    queryByText: (text: string | RegExp) => HTMLElement | null;
    queryAllByText: (text: string | RegExp) => HTMLElement[];
    queryByTestId: (testId: string) => HTMLElement | null;
    queryAllByTestId: (testId: string) => HTMLElement[];
    findByText: (text: string | RegExp) => Promise<HTMLElement>;
    findAllByText: (text: string | RegExp) => Promise<HTMLElement[]>;
    findByTestId: (testId: string) => Promise<HTMLElement>;
    findAllByTestId: (testId: string) => Promise<HTMLElement[]>;
    debug: (element?: HTMLElement) => void;
  };
}

/**
 * Jest DOM extensions for assertions
 */
declare module '@testing-library/jest-dom' {
  global {
    namespace jest {
      interface Matchers<R> {
        toBeInTheDocument(): R;
        toHaveAttribute(name: string, value?: string): R;
        toHaveClass(className: string): R;
        toHaveTextContent(text: string | RegExp): R;
        toBeDisabled(): R;
        toBeEnabled(): R;
        toBeEmpty(): R;
        toBeInvalid(): R;
        toBeValid(): R;
        toBeVisible(): R;
        toBeChecked(): R;
        toHaveValue(value: any): R;
        toContainElement(element: HTMLElement | null): R;
        toBeRequired(): R;
      }
    }
  }
}

/**
 * Import Jest DOM extension
 */
import '@testing-library/jest-dom/extend-expect';

/**
 * Global window interface with test mocks
 */
interface Window {
  fetch: jest.Mock<any, any>;
  console: {
    log: jest.Mock<any, any>;
    error: jest.Mock<any, any>;
    warn: jest.Mock<any, any>;
    info: jest.Mock<any, any>;
    [key: string]: any;
  };
  setTimeout: jest.Mock<any, [callback: Function, timeout?: number, ...args: any[]]>;
  [key: string]: any;
}

/**
 * Global declarations for Jest and testing
 */
declare global {
  // Jest globals
  const jest: typeof import('jest');
  
  // Test functions
  const describe: (name: string, fn: () => void) => void;
  const beforeEach: (fn: () => void) => void;
  const afterEach: (fn: () => void) => void;
  const beforeAll: (fn: () => void) => void;
  const afterAll: (fn: () => void) => void;
  const test: (name: string, fn: (done?: jest.DoneCallback) => any) => void;
  const it: typeof test;
  const expect: jest.Expect;
  
  // Extend window interface globally
  interface Window {
    fetch: jest.Mock<any, any>;
    console: {
      log: jest.Mock<any, any>;
      error: jest.Mock<any, any>;
      warn: jest.Mock<any, any>;
      info: jest.Mock<any, any>;
    };
    setTimeout: jest.Mock<any, [callback: Function, timeout?: number, ...args: any[]]>;
  }
  
  // Extend NodeJS namespace
  namespace NodeJS {
    interface Global {
      fetch: jest.Mock<any, any>;
      setTimeout: jest.Mock<any, [callback: Function, timeout?: number, ...args: any[]]>;
    }
  }
}

// Type definitions for test-types.ts
declare module '*/test-types' {
  export interface SplitRatioControlProps {
    onChange: (ratios: { train: number; validation: number; test: number }) => void;
  }
  
  export interface ModelConfigProps {
    onChange: (config: {
      architecture: string;
      variant: string;
      pretrained: boolean;
      hyperparameters: {
        batchSize: number;
        learningRate: number;
        epochs: number;
      }
    }) => void;
  }
  
  export interface AugmentationOptionsProps {
    onChange: (options: {
      enabled: boolean;
      techniques: {
        rotation: boolean;
        horizontalFlip: boolean;
        verticalFlip: boolean;
        randomCrop: boolean;
        colorJitter: boolean;
        randomErasing: boolean;
        randomNoise: boolean;
      };
      intensities: {
        rotationDegrees: number;
        cropScale: number;
        brightnessVariation: number;
        erasePercent: number;
      }
    }) => void;
  }
}