/**
 * Custom type definitions for Zod library
 * These extensions ensure TypeScript recognizes all the methods we use with Zod
 */

import * as z from 'zod';

declare module 'zod' {
  interface ZodType<Output> {
    optional(): ZodOptional<this>;
  }

  interface ZodString {
    min(length: number): ZodString;
    email(): ZodString;
    url(): ZodString;
    uuid(): ZodString;
    regex(pattern: RegExp): ZodString;
    default(value: string): ZodDefault<ZodString>;
    transform<T>(transformer: (value: string) => T): ZodTransformer<ZodString, T>;
  }

  interface ZodNumber {
    int(): ZodNumber;
    min(min: number): ZodNumber;
    max(max: number): ZodNumber;
    positive(): ZodNumber;
    nonnegative(): ZodNumber;
    default(value: number): ZodDefault<ZodNumber>;
  }

  interface ZodBoolean {
    default(value: boolean): ZodDefault<ZodBoolean>;
  }

  interface ZodObject<T extends z.ZodRawShape> {
    extend<U extends z.ZodRawShape>(extension: U): ZodObject<T & U>;
    optional(): ZodOptional<ZodObject<T>>;
  }

  // Ensure the infer method is recognized
  export function infer<T extends ZodType<any, any>>(schema: T): z.infer<T>;
  
  // Ensure ZodError type is recognized
  export class ZodError<T = any> extends Error {
    issues: Array<{
      path: (string | number)[];
      message: string;
      code: string;
    }>;
    format(): Record<string, any>;
  }
}