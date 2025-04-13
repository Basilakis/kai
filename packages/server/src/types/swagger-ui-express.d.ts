/**
 * Type definitions for swagger-ui-express
 * Provides TypeScript type support for the swagger-ui-express library
 */

declare module 'swagger-ui-express' {
  import { RequestHandler, Router } from 'express';

  export interface SwaggerOptions {
    explorer?: boolean;
    swaggerUrl?: string;
    swaggerUrls?: { url: string; name: string }[];
    customCss?: string;
    customCssUrl?: string;
    customJs?: string;
    customfavIcon?: string;
    swaggerOptions?: {
      [key: string]: any;
      validatorUrl?: string | null;
      docExpansion?: 'list' | 'full' | 'none';
      persistAuthorization?: boolean;
    };
    customSiteTitle?: string;
    customCssPath?: string;
    customJsPath?: string;
    operationsSorter?: ((a: any, b: any) => number) | 'alpha' | 'method';
    showExplorer?: boolean;
    showProcess?: boolean;
    isExplorer?: boolean;
    jsonEditor?: boolean;
    oauth?: {
      clientId?: string;
      clientSecret?: string;
      realm?: string;
      appName?: string;
      scopeSeparator?: string;
      additionalQueryStringParams?: { [key: string]: string };
      useBasicAuthenticationWithAccessCodeGrant?: boolean;
      usePkceWithAuthorizationCodeGrant?: boolean;
    };
    [key: string]: any;
  }

  export function serve(path?: string | null, options?: SwaggerOptions): RequestHandler[];
  export function setup(spec: any, options?: SwaggerOptions, route?: { [key: string]: any }): RequestHandler;
  export function serveWithOptions(options?: SwaggerOptions): RequestHandler[];
  export function generateHTML(spec: any, options?: SwaggerOptions): string;
}