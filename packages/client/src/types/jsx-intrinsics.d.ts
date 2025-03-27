/**
 * JSX Intrinsic Elements Type Declarations
 * 
 * This file provides TypeScript declarations for JSX intrinsic elements
 * that are used in styled components and may be missing from the standard
 * React typings.
 */

import * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Standard HTML elements that might be missing or need enhancement
      input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
      
      // Styled components construct signatures
      // This ensures that styled components can be used as JSX elements
      [elemName: string]: any;
    }
  }
}

// Extend the styled components to include all HTML elements
declare module '@emotion/styled' {
  interface StyledTags {
    // Basic HTML elements
    div: React.FC<React.HTMLAttributes<HTMLDivElement>>;
    span: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
    
    // Text and headings
    p: React.FC<React.HTMLAttributes<HTMLParagraphElement>>;
    h1: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    h2: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    h3: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    h4: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    h5: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    h6: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    
    // Form elements
    input: React.FC<React.InputHTMLAttributes<HTMLInputElement>>;
    button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>>;
    form: React.FC<React.FormHTMLAttributes<HTMLFormElement>>;
    
    // List elements
    ul: React.FC<React.HTMLAttributes<HTMLUListElement>>;
    ol: React.FC<React.HTMLAttributes<HTMLOListElement>>;
    li: React.FC<React.HTMLAttributes<HTMLLIElement>>;
    
    // Media elements
    img: React.FC<React.ImgHTMLAttributes<HTMLImageElement>>;
    
    // Structural elements
    header: React.FC<React.HTMLAttributes<HTMLElement>>;
    footer: React.FC<React.HTMLAttributes<HTMLElement>>;
    main: React.FC<React.HTMLAttributes<HTMLElement>>;
    section: React.FC<React.HTMLAttributes<HTMLElement>>;
    article: React.FC<React.HTMLAttributes<HTMLElement>>;
    nav: React.FC<React.HTMLAttributes<HTMLElement>>;
  }
}