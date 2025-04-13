// React extensions for missing type declarations
import React from 'react';

declare module 'react' {
  // Re-export React types that are missing
  export type ReactNode = React.ReactNode;
  export type RefObject<T> = React.RefObject<T>;
  export type MutableRefObject<T> = React.MutableRefObject<T>;
  export type Ref<T> = React.Ref<T>;
  export type ForwardedRef<T> = React.ForwardedRef<T>;

  // Re-export React hooks
  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useRef<T>(initialValue: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;

  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: ReadonlyArray<any>): T;

  // Re-export event types
  export interface SyntheticEvent<T = Element, E = Event> extends React.BaseSyntheticEvent<E, EventTarget & T, EventTarget> {}

  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
    altKey: boolean;
    charCode: number;
    ctrlKey: boolean;
    key: string;
    keyCode: number;
    locale: string;
    location: number;
    metaKey: boolean;
    repeat: boolean;
    shiftKey: boolean;
    which: number;
    getModifierState(key: string): boolean;
    preventDefault(): void;
  }
}
