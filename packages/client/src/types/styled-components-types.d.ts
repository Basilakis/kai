/**
 * Styled Components Type Declarations
 * 
 * This file provides TypeScript declarations for styled components that
 * resolve the JSX element type errors with construct or call signatures.
 */

import * as React from 'react';
import '@emotion/styled';

declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      className?: string;
      active?: boolean;
      primary?: boolean;
      secondary?: boolean;
      small?: boolean;
      sender?: string;
      agentType?: string;
      [propName: string]: any;
    }
  }
}

declare module '@emotion/styled' {
  export interface StyledComponent<Props = {}, Element = any> 
    extends React.ForwardRefExoticComponent<
      Props & React.RefAttributes<Element>
    > {}

  // Add specific styled component definitions
  export interface CreateStyled {
    div: React.FC<React.HTMLAttributes<HTMLDivElement>>;
    span: React.FC<React.HTMLAttributes<HTMLSpanElement>>;
    input: React.FC<React.InputHTMLAttributes<HTMLInputElement>>;
    button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>>;
    img: React.FC<React.ImgHTMLAttributes<HTMLImageElement>>;
    h1: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    h2: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    h3: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    h4: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    h5: React.FC<React.HTMLAttributes<HTMLHeadingElement>>;
    p: React.FC<React.HTMLAttributes<HTMLParagraphElement>>;
    ul: React.FC<React.HTMLAttributes<HTMLUListElement>>;
    li: React.FC<React.HTMLAttributes<HTMLLIElement>>;
    header: React.FC<React.HTMLAttributes<HTMLElement>>;
    nav: React.FC<React.HTMLAttributes<HTMLElement>>;
  }

  // Define template literal function for props
  interface StyledPropsFunction<Props> {
    (props: Props): string | number;
  }
  
  // Define template literal usage
  interface StyledTemplateFunction {
    <T extends keyof JSX.IntrinsicElements>(
      strings: TemplateStringsArray,
      ...values: Array<StyledPropsFunction<any> | string | number>
    ): StyledComponent<JSX.IntrinsicElements[T], T>;
  }

  // Define generic StyledTagFunction for all HTML elements
  export interface StyledTagFunction<T extends keyof JSX.IntrinsicElements> {
    (strings: TemplateStringsArray, ...values: Array<StyledPropsFunction<any> | string | number>): StyledComponent<JSX.IntrinsicElements[T], T>;
    <P extends object>(component: React.ComponentType<P>): StyledComponent<P, React.ComponentType<P>>;
  }
}