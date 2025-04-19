/**
 * React Type Declarations
 * 
 * This provides basic TypeScript declarations for React to ensure proper type checking
 * for React components in the shared package.
 */

declare module 'react' {
  // Core React types exported directly
  export type ReactNode = string | number | boolean | React.ReactElement | React.ReactNodeArray | React.ReactPortal | null | undefined;
  export type FC<P = {}> = React.FunctionComponent<P>;
  export type FunctionComponent<P = {}> = React.FunctionComponent<P>;
  export type MouseEvent = React.MouseEvent;
  export type ReactElement<P = any, T extends React.ElementType = React.ElementType> = React.ReactElement<P, T>;
  
  // React Hooks
  export function useState<S>(initialState: S | (() => S)): [S, React.Dispatch<React.SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, React.Dispatch<React.SetStateAction<S | undefined>>];
  export function useEffect(effect: React.EffectCallback, deps?: ReadonlyArray<any>): void;
  
  // Core React namespace for components, elements, and types
  namespace React {
    // Basic types
    type ElementType = string | JSXElementConstructor<any>;
    type Key = string | number;
    
    // Component types
    interface FunctionComponent<P = {}> {
      (props: P, context?: any): ReactElement<any, any> | null;
      displayName?: string;
      defaultProps?: Partial<P>;
    }
    
    // State and effects
    type Dispatch<A> = (value: A) => void;
    type SetStateAction<S> = S | ((prevState: S) => S);
    type EffectCallback = () => void | (() => void);
    
    // Element types
    interface ReactElement<P = any, T extends ElementType = ElementType> {
      type: T;
      props: P;
      key: Key | null;
    }
    type JSXElementConstructor<P> = (props: P) => ReactElement | null;
    interface ReactNodeArray extends Array<ReactNode> {}
    interface ReactPortal extends ReactElement {
      key: Key | null;
      children: ReactNode;
    }
    
    // Event types
    interface BaseSyntheticEvent<E = object, C = any, T = any> {
      nativeEvent: E;
      currentTarget: C;
      target: T;
      bubbles: boolean;
      cancelable: boolean;
      defaultPrevented: boolean;
      eventPhase: number;
      isTrusted: boolean;
      preventDefault(): void;
      isDefaultPrevented(): boolean;
      stopPropagation(): void;
      isPropagationStopped(): boolean;
      persist(): void;
      timeStamp: number;
      type: string;
    }
    
    interface SyntheticEvent<T = Element, E = Event> extends BaseSyntheticEvent<E, T, EventTarget> {}
    
    interface MouseEvent<T = Element, E = NativeMouseEvent> extends SyntheticEvent<T, E> {
      altKey: boolean;
      button: number;
      buttons: number;
      clientX: number;
      clientY: number;
      ctrlKey: boolean;
      metaKey: boolean;
      pageX: number;
      pageY: number;
      screenX: number;
      screenY: number;
      shiftKey: boolean;
    }
    
    // HTML and SVG attributes
    interface HTMLAttributes<T> {
      className?: string;
      id?: string;
      style?: CSSProperties;
      onClick?: (event: MouseEvent<T>) => void;
      [key: string]: any;
    }
    
    interface CSSProperties {
      [key: string]: string | number | undefined;
    }
    
    interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
      disabled?: boolean;
      type?: 'button' | 'submit' | 'reset';
    }
    
    interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
      src?: string;
      alt?: string;
    }
    
    interface DetailedHTMLProps<E extends HTMLAttributes<T>, T> extends E {}
    
    interface SVGProps<T> extends HTMLAttributes<T> {}
  }
  
  // Export to make TypeScript happy
  export = React;
}

// Native events for proper event handling
interface NativeMouseEvent extends MouseEvent {}

// Global JSX namespace
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass {
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

// Export types to be used without namespace
export type ReactNode = React.ReactNode;
export type FC<P = {}> = React.FunctionComponent<P>;
export type MouseEventHandler<T = Element> = (event: React.MouseEvent<T>) => void;