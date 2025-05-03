/**
 * Type declarations for Node.js util module
 */
declare module 'util' {
  /**
   * Promisify a callback-based function
   * @param original The callback-based function to promisify
   */
  export function promisify<T extends (...args: any[]) => any>(
    original: T
  ): (...args: Parameters<T>) => Promise<any>;

  /**
   * Returns a string representation of an object
   * @param object The object to inspect
   * @param options Options for formatting the output
   */
  export function inspect(
    object: any,
    options?: {
      showHidden?: boolean;
      depth?: number | null;
      colors?: boolean;
      customInspect?: boolean;
      showProxy?: boolean;
      maxArrayLength?: number | null;
      breakLength?: number;
      compact?: boolean | number;
      sorted?: boolean | ((a: string, b: string) => number);
      getters?: boolean | 'get' | 'set';
    }
  ): string;

  /**
   * Check if the given object is a Promise
   * @param object The object to check
   */
  export function isPromise(object: any): boolean;

  /**
   * Check if the given object is a RegExp
   * @param object The object to check
   */
  export function isRegExp(object: any): object is RegExp;

  /**
   * Check if the given object is a Date
   * @param object The object to check
   */
  export function isDate(object: any): object is Date;

  /**
   * Check if the given object is an Error
   * @param object The object to check
   */
  export function isError(object: any): object is Error;
}
