/**
 * Emotion Styled Type Declarations
 * 
 * This file provides TypeScript declarations for @emotion/styled
 * which is used throughout the agent UI components.
 */

declare module '@emotion/styled' {
  import * as React from 'react';
  
  type CSSObject = { [key: string]: any };
  
  export interface StyledComponent<P = {}, T = any> extends React.ComponentClass<P & { as?: React.ElementType; theme?: any }> {
    withComponent<K extends keyof JSX.IntrinsicElements>(tag: K): StyledComponent<JSX.IntrinsicElements[K], K>;
    withComponent(component: React.ComponentType<any>): StyledComponent<any, any>;
  }
  
  export interface StyledOptions {
    label?: string;
    shouldForwardProp?(propName: string): boolean;
    target?: string;
  }
  
  export interface StyledTagFunction<T> {
    (strings: TemplateStringsArray, ...interpolations: Array<any>): StyledComponent<{}, T>;
    <P>(component: React.ComponentType<P>): StyledComponent<P, any>;
    <P>(component: StyledComponent<P, any>): StyledComponent<P, any>;
  }
  
  export interface CreateStyled {
    <T extends keyof JSX.IntrinsicElements>(tag: T, options?: StyledOptions): StyledTagFunction<T>;
    <P, T>(component: React.ComponentType<P>, options?: StyledOptions): StyledTagFunction<T>;
  }
  
  const styled: CreateStyled & {
    [K in keyof JSX.IntrinsicElements]: StyledTagFunction<K>;
  };
  
  export default styled;
}