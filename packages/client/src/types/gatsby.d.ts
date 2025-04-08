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
}