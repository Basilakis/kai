/**
 * Type declarations for zod
 */

declare module 'zod' {
  export const z: {
    string(): {
      min(length: number): any;
      email(): any;
      url(): any;
      uuid(): any;
      regex(pattern: RegExp): any;
      optional(): any;
    };
    
    number(): {
      min(min: number): any;
      max(max: number): any;
      positive(): any;
      nonnegative(): any;
      optional(): any;
    };
    
    boolean(): any;
    
    date(): any;
    
    array(schema: any): any;
    
    object(schema: Record<string, any>): {
      extend(extension: Record<string, any>): any;
    };
    
    record(keyType: any, valueType: any): any;
    
    enum(values: readonly string[]): any;
    
    literal(value: any): any;
    
    union(schemas: any[]): any;
    
    intersection(schemas: any[]): any;
    
    any(): any;
  };
  
  // Export types
  export type ZodType<T = any> = any;
  export type ZodSchema<T = any> = any;
  export type ZodObject<T = any> = any;
  export type ZodArray<T = any> = any;
  export type ZodEnum<T = any> = any;
  export type ZodUnion<T = any> = any;
  export type ZodIntersection<T = any> = any;
  export type ZodLiteral<T = any> = any;
}