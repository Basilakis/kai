/**
 * Styled Components Type Declarations
 * 
 * This file provides TypeScript declarations for @emotion/styled
 * used in the agent components.
 */

import '@emotion/react';
import { CSSObject } from '@emotion/react';

declare module '@emotion/styled' {
  import * as React from 'react';
  
  export interface StyledOptions {
    shouldForwardProp?: (prop: string) => boolean;
    target?: string;
    label?: string;
  }

  export interface StyledComponent<Props extends object = {}, BaseElement = HTMLElement> 
    extends React.FC<Props & React.HTMLAttributes<BaseElement>> {
    defaultProps?: Partial<Props>;
    toString: () => string;
  }

  export interface CreateStyledComponent<ComponentProps extends object = {}, SpecificComponentProps extends object = {}> {
    <AdditionalProps extends object = {}>(
      ...styles: (CSSObject | string | ((props: ComponentProps & AdditionalProps) => CSSObject | string))[]
    ): StyledComponent<ComponentProps & AdditionalProps & SpecificComponentProps>;

    /**
     * @desc
     * This function accepts a JavaScript object that targets
     * CSS selectors inside your component
     */
    withConfig: (config: StyledOptions) => CreateStyledComponent<ComponentProps, SpecificComponentProps>;
  }

  export interface CreateStyled {
    <C extends React.ComponentClass<React.ComponentProps<C>>>(
      component: C
    ): CreateStyledComponent<React.ComponentProps<C>, { ref?: React.Ref<InstanceType<C>> }>;

    <C extends React.ComponentType<React.ComponentProps<C>>>(
      component: C
    ): CreateStyledComponent<React.ComponentProps<C>>;

    <Tag extends keyof JSX.IntrinsicElements>(
      tag: Tag
    ): CreateStyledComponent<JSX.IntrinsicElements[Tag]>;
  }

  export interface StyledTagFunction<Element> {
    <Props extends object = {}>(
      ...styles: (CSSObject | string | ((props: Props) => CSSObject | string))[]
    ): StyledComponent<Props, Element>;
  }

  const styled: CreateStyled & {
    [K in keyof JSX.IntrinsicElements]: StyledTagFunction<JSX.IntrinsicElements[K]>;
  };

  export default styled;
}

declare module '@emotion/react' {
  export interface Theme {
    colors?: {
      primary?: string;
      secondary?: string;
      text?: string;
      background?: string;
      [key: string]: string | undefined;
    };
    fontSizes?: {
      small?: string;
      medium?: string;
      large?: string;
      [key: string]: string | undefined;
    };
    spacing?: {
      xs?: string;
      sm?: string;
      md?: string;
      lg?: string;
      xl?: string;
      [key: string]: string | undefined;
    };
    breakpoints?: {
      xs?: string;
      sm?: string;
      md?: string;
      lg?: string;
      xl?: string;
      [key: string]: string | undefined;
    };
    [key: string]: any;
  }
}