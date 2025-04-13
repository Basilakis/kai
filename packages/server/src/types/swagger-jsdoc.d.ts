/**
 * Type definitions for swagger-jsdoc
 * Provides TypeScript type support for the swagger-jsdoc library
 */

declare module 'swagger-jsdoc' {
  export interface Options {
    definition: {
      openapi?: string;
      info: {
        title: string;
        version: string;
        description?: string;
        termsOfService?: string;
        contact?: {
          name?: string;
          url?: string;
          email?: string;
        };
        license?: {
          name: string;
          url?: string;
        };
      };
      servers?: Array<{
        url: string;
        description?: string;
        variables?: Record<string, {
          enum?: string[];
          default: string;
          description?: string;
        }>;
      }>;
      components?: {
        schemas?: Record<string, any>;
        responses?: Record<string, any>;
        parameters?: Record<string, any>;
        securitySchemes?: Record<string, any>;
        requestBodies?: Record<string, any>;
        headers?: Record<string, any>;
        examples?: Record<string, any>;
        links?: Record<string, any>;
        callbacks?: Record<string, any>;
      };
      security?: Array<Record<string, string[]>>;
      tags?: Array<{
        name: string;
        description?: string;
        externalDocs?: {
          description?: string;
          url: string;
        };
      }>;
      externalDocs?: {
        description?: string;
        url: string;
      };
      paths?: Record<string, Record<string, any>>;
    };
    apis: string[] | string;
    swaggerDefinition?: any; // Legacy support
    withCredentials?: boolean;
  }

  export default function swaggerJsdoc(options: Options): any;
}