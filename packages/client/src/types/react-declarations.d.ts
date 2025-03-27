/**
 * React Type Declarations
 * 
 * This file provides proper type definitions for React components
 * and events used throughout the client application.
 */

import * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
      span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
      button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
      input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
      textarea: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>;
      form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
      img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
      h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h4: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h5: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h6: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      p: React.DetailedHTMLProps<React.HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
      a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
      ul: React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
      ol: React.DetailedHTMLProps<React.HTMLAttributes<HTMLOListElement>, HTMLOListElement>;
      li: React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>;
      label: React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
      select: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>;
      option: React.DetailedHTMLProps<React.OptionHTMLAttributes<HTMLOptionElement>, HTMLOptionElement>;
    }
  }
}

// Re-export React types to make them available throughout the application
export type ReactNode = React.ReactNode;
export type MouseEvent<T = Element> = React.MouseEvent<T>;
export type KeyboardEvent<T = Element> = React.KeyboardEvent<T>;
export type FocusEvent<T = Element> = React.FocusEvent<T>;
export type ChangeEvent<T = Element> = React.ChangeEvent<T>;
export type FormEvent<T = Element> = React.FormEvent<T>;
export type Ref<T> = React.Ref<T>;
export type RefObject<T> = React.RefObject<T>;
export type CSSProperties = React.CSSProperties;
export type ComponentType<P = any> = React.ComponentType<P>;
export type FC<P = {}> = React.FC<P>;
export type ComponentProps<T extends keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>> = 
  React.ComponentProps<T>;
export type PropsWithChildren<P = {}> = React.PropsWithChildren<P>;
export type ReactElement = React.ReactElement;
export type SyntheticEvent<T = Element> = React.SyntheticEvent<T>;