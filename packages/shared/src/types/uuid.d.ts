declare module 'uuid' {
  /**
   * Generate a v4 UUID
   */
  export function v4(): string;

  /**
   * Generate a v1 UUID
   */
  export function v1(): string;

  /**
   * Generate a v3 UUID
   */
  export function v3(name: string | number[], namespace: string | number[]): string;

  /**
   * Generate a v5 UUID
   */
  export function v5(name: string | number[], namespace: string | number[]): string;

  /**
   * Parse a UUID string
   */
  export function parse(uuid: string): number[];

  /**
   * Convert array to UUID string
   */
  export function unparse(arr: number[]): string;

  /**
   * Validate a UUID string
   */
  export function validate(uuid: string): boolean;

  /**
   * Version of the UUID
   */
  export function version(uuid: string): number;
}