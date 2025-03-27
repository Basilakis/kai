/**
 * React Type Declarations
 * 
 * This file provides type definitions for React components,
 * events, and node types used throughout the client package.
 */

// Extend the global React namespace
declare namespace React {
  // Node types
  type ReactNode = 
    | React.ReactElement
    | string
    | number
    | boolean
    | null
    | undefined
    | React.ReactNodeArray;
  
  type ReactNodeArray = Array<ReactNode>;
  
  interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: Key | null;
  }
  
  type Key = string | number;

  interface JSXElementConstructor<P> {
    (props: P): ReactElement<P, any> | null;
  }
  
  // Event types
  interface SyntheticEvent<T = Element, E = Event> {
    nativeEvent: E;
    currentTarget: T;
    target: EventTarget;
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
  
  interface MouseEvent<T = Element, E = Event> extends SyntheticEvent<T, E> {
    altKey: boolean;
    button: number;
    buttons: number;
    clientX: number;
    clientY: number;
    ctrlKey: boolean;
    getModifierState(key: string): boolean;
    metaKey: boolean;
    movementX: number;
    movementY: number;
    pageX: number;
    pageY: number;
    relatedTarget: EventTarget | null;
    screenX: number;
    screenY: number;
    shiftKey: boolean;
  }
  
  interface FocusEvent<T = Element, E = Event> extends SyntheticEvent<T, E> {
    relatedTarget: EventTarget | null;
  }
  
  interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
    altKey: boolean;
    charCode: number;
    ctrlKey: boolean;
    code: string;
    key: string;
    keyCode: number;
    locale: string;
    location: number;
    metaKey: boolean;
    repeat: boolean;
    shiftKey: boolean;
    which: number;
    getModifierState(key: string): boolean;
  }
  
  interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
    target: EventTarget & T;
  }
  
  interface FormEvent<T = Element> extends SyntheticEvent<T> {
  }
  
  interface DragEvent<T = Element> extends MouseEvent<T> {
    dataTransfer: DataTransfer;
  }
}

// Extend the global JSX namespace
declare namespace JSX {
  interface Element extends React.ReactElement {}
  
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}