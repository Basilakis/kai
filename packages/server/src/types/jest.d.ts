// Type definitions for Jest
// This is a simplified version of @types/jest that provides just enough 
// type declarations to remove linting errors in our tests

declare global {
  namespace jest {
    function fn<T extends (...args: any[]) => any>(implementation?: T): jest.MockInstance<ReturnType<T>, Parameters<T>>;
    function clearAllMocks(): void;
    function mock(moduleName: string, factory?: () => any, options?: {virtual?: boolean}): jest.Mocked<any>;
    
    interface MockInstance<T, Y extends any[]> {
      mockImplementation(fn: (...args: Y) => T): this;
      mockReturnValue(value: T): this;
      mockResolvedValue(value: T): this;
      mockRejectedValue(value: any): this;
    }
    
    type Mocked<T> = {
      [P in keyof T]: T[P] extends (...args: any[]) => any
        ? MockInstance<ReturnType<T[P]>, Parameters<T[P]>>
        : T[P] extends object
        ? Mocked<T[P]>
        : T[P];
    } & T;
  }
  
  function describe(name: string, fn: () => void): void;
  function beforeEach(fn: () => void): void;
  function it(name: string, fn: () => void | Promise<void>): void;
  function expect<T>(actual: T): {
    toBe(expected: any): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeInstanceOf(expected: any): void;
    toEqual(expected: any): void;
    toBeGreaterThan(expected: number): void;
    toHaveLength(expected: number): void;
    toContain(expected: any): void;
    not: any;
  };
}

export {};