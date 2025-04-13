/**
 * Type declarations for Gatsby
 *
 * This file provides TypeScript type definitions for Gatsby components
 * and APIs that are used in the client application.
 */

declare module 'gatsby' {
  import React from 'react'

  export interface GatsbyLinkProps {
    to: string
    activeClassName?: string
    className?: string
    children?: React.ReactNode
    [key: string]: any
  }

  export const Link: React.FC<GatsbyLinkProps>

  /**
   * Navigate to a new page
   */
  export function navigate(
    to: string,
    options?: {
      state?: object;
      replace?: boolean;
    }
  ): void;

  /**
   * Get current location
   */
  export function useLocation(): {
    pathname: string;
    search: string;
    hash: string;
    state: any;
  };

  /**
   * Get static query data
   */
  export function useStaticQuery<TData = any>(query: any): TData;
}