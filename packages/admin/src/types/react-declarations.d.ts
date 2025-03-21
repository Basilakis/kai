/**
 * React Type Declarations
 * 
 * This file provides TypeScript declarations for React-specific types
 * that are missing in the default TypeScript configuration.
 */

// React module augmentation
declare module 'react' {
  // FC (FunctionComponent) type
  export interface FC<P = {}> {
    (props: P & { children?: React.ReactNode }): React.ReactElement<any, any> | null;
    displayName?: string;
    defaultProps?: Partial<P>;
    propTypes?: any;
  }
  
  // FunctionComponent type (equivalent to FC)
  export interface FunctionComponent<P = {}> {
    (props: P & { children?: React.ReactNode }): React.ReactElement<any, any> | null;
    displayName?: string;
    defaultProps?: Partial<P>;
    propTypes?: any;
  }
  
  // Component element class augmentation
  export interface ClassAttributes<T> extends Attributes {
    ref?: LegacyRef<T> | undefined;
  }
  
  // Type declarations for React elements
  export namespace JSX {
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
  }
}

// React JSX Runtime
declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
  }
  export function jsx(
    type: React.ElementType,
    props: Record<string, any>,
    key?: string
  ): React.ReactElement;
  export function jsxs(
    type: React.ElementType,
    props: Record<string, any>,
    key?: string
  ): React.ReactElement;
}

// Declare heroicons module
declare module '@heroicons/react/outline' {
  import { FC, SVGProps } from 'react';
  
  export const DatabaseIcon: FC<SVGProps<SVGSVGElement>>;
  export const RefreshIcon: FC<SVGProps<SVGSVGElement>>;
  export const CheckCircleIcon: FC<SVGProps<SVGSVGElement>>;
  export const ExclamationCircleIcon: FC<SVGProps<SVGSVGElement>>;
  export const ArrowCircleRightIcon: FC<SVGProps<SVGSVGElement>>;
  export const CloudIcon: FC<SVGProps<SVGSVGElement>>;
  export const MailIcon: FC<SVGProps<SVGSVGElement>>;
  export const SaveIcon: FC<SVGProps<SVGSVGElement>>;
  export const CogIcon: FC<SVGProps<SVGSVGElement>>;
  export const LockClosedIcon: FC<SVGProps<SVGSVGElement>>;
  export const ServerIcon: FC<SVGProps<SVGSVGElement>>;
  export const ChipIcon: FC<SVGProps<SVGSVGElement>>;
}