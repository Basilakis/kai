/**
 * Type declarations for Zod library.
 * This file extends the existing Zod typings to add support for
 * methods that are not properly recognized by TypeScript.
 */

import 'zod';

declare module 'zod' {
  // Add missing method definitions
  
  // Extend ZodObject with missing methods
  interface ZodObject<T extends ZodRawShape, UnknownKeys, Catchall> {
    optional(): any;
    extend(extension: Record<string, any>): any;
    parse(data: any): any;
  }
  
  // Extend ZodType with optional method
  interface ZodType<Output, Def extends ZodTypeDef> {
    optional(): any;
  }
  
  // Extend ZodString with missing methods
  interface ZodString {
    min(length: number): any;
    email(): any;
    url(): any;
    uuid(): any;
    regex(pattern: RegExp): any;
    optional(): any;
  }
  
  // Extend ZodNumber with missing methods
  interface ZodNumber {
    min(min: number): any;
    max(max: number): any;
    positive(): any;
    nonnegative(): any;
    optional(): any;
  }
  
  // Extend other Zod types
  interface ZodBoolean {
    optional(): any;
  }
  
  interface ZodDate {
    optional(): any;
  }
  
  interface ZodArray<T extends ZodTypeAny> {
    optional(): any;
  }
  
  interface ZodEnum<T extends [string, ...string[]]> {
    optional(): any;
  }
  
  interface ZodLiteral<T> {
    optional(): any;
  }
  
  interface ZodRecord {
    optional(): any;
  }
}