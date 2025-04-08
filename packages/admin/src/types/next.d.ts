/**
 * Next.js Type Declarations
 * 
 * Provides type declarations for Next.js components and utilities
 * used in the admin panel.
 */

// Define Next.js Link component
declare module 'next/link' {
  import React from 'react';

  export interface LinkProps {
    href: string;
    as?: string;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
    locale?: string | false;
    children: React.ReactNode;
    [key: string]: any;
  }

  const Link: React.FC<LinkProps>;
  export default Link;
}

// Define Next.js Router
declare module 'next/router' {
  export interface RouterProps {
    pathname: string;
    query: { [key: string]: string | string[] };
    asPath: string;
    isFallback: boolean;
    basePath: string;
    locale: string;
    locales: string[];
    defaultLocale: string;
    domainLocales: { domain: string, defaultLocale: string, locales: string[] }[];
    isReady: boolean;
    isPreview: boolean;
  }

  export function useRouter(): RouterProps;
}