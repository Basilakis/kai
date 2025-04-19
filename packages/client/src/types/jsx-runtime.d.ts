/**
 * JSX Runtime Type Declarations
 * 
 * This file provides proper type definitions for JSX elements
 * to fix issues with React component props typing.
 */

import * as React from 'react';

declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    
    interface ElementClass extends React.Component<any> {
      render(): React.ReactNode;
    }
    
    interface ElementAttributesProperty {
      props: {};
    }
    
    interface ElementChildrenAttribute {
      children: {};
    }
    
    interface IntrinsicAttributes extends React.Attributes {}
    
    interface IntrinsicClassAttributes<T> extends React.ClassAttributes<T> {}
    
    interface IntrinsicElements {
      div: React.HTMLAttributes<HTMLDivElement>;
      span: React.HTMLAttributes<HTMLSpanElement>;
      button: React.ButtonHTMLAttributes<HTMLButtonElement>;
      input: React.InputHTMLAttributes<HTMLInputElement>;
      textarea: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
      form: React.FormHTMLAttributes<HTMLFormElement>;
      img: React.ImgHTMLAttributes<HTMLImageElement>;
      h1: React.HTMLAttributes<HTMLHeadingElement>;
      h2: React.HTMLAttributes<HTMLHeadingElement>;
      h3: React.HTMLAttributes<HTMLHeadingElement>;
      h4: React.HTMLAttributes<HTMLHeadingElement>;
      h5: React.HTMLAttributes<HTMLHeadingElement>;
      h6: React.HTMLAttributes<HTMLHeadingElement>;
      p: React.HTMLAttributes<HTMLParagraphElement>;
      a: React.AnchorHTMLAttributes<HTMLAnchorElement>;
      ul: React.HTMLAttributes<HTMLUListElement>;
      ol: React.HTMLAttributes<HTMLOListElement>;
      li: React.LiHTMLAttributes<HTMLLIElement>;
      label: React.LabelHTMLAttributes<HTMLLabelElement>;
      select: React.SelectHTMLAttributes<HTMLSelectElement>;
      option: React.OptionHTMLAttributes<HTMLOptionElement>;
      optgroup: React.OptgroupHTMLAttributes<HTMLOptGroupElement>;
      fieldset: React.FieldsetHTMLAttributes<HTMLFieldSetElement>;
      legend: React.HTMLAttributes<HTMLLegendElement>;
      table: React.TableHTMLAttributes<HTMLTableElement>;
      thead: React.HTMLAttributes<HTMLTableSectionElement>;
      tbody: React.HTMLAttributes<HTMLTableSectionElement>;
      tfoot: React.HTMLAttributes<HTMLTableSectionElement>;
      tr: React.HTMLAttributes<HTMLTableRowElement>;
      th: React.ThHTMLAttributes<HTMLTableHeaderCellElement>;
      td: React.TdHTMLAttributes<HTMLTableDataCellElement>;
      colgroup: React.ColgroupHTMLAttributes<HTMLTableColElement>;
      col: React.ColHTMLAttributes<HTMLTableColElement>;
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
export type PropsWithChildren<P = {}> = React.PropsWithChildren<P>;
export type ReactElement = React.ReactElement;
export type SyntheticEvent<T = Element> = React.SyntheticEvent<T>;
