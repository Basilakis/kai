/**
 * React Hooks Type Declarations
 * 
 * This file provides TypeScript declarations for React hooks and event types
 * that are used in the agent components but not properly recognized by TypeScript.
 */

import React from 'react';

declare module 'react' {
  // Hooks
  export function useRef<T>(initialValue: T): React.RefObject<T>;
  export function useRef<T>(initialValue: null): React.RefObject<T | null>;
  export function useRef<T = undefined>(): React.RefObject<T | undefined>;
  
  export function useCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: ReadonlyArray<any>
  ): T;

  // Event types
  export interface KeyboardEvent<T = Element> extends React.SyntheticEvent<T> {
    altKey: boolean;
    charCode: number;
    ctrlKey: boolean;
    key: string;
    keyCode: number;
    locale: string;
    metaKey: boolean;
    repeat: boolean;
    shiftKey: boolean;
    which: number;
  }
  
  export interface MouseEvent<T = Element> extends React.SyntheticEvent<T> {
    altKey: boolean;
    button: number;
    buttons: number;
    clientX: number;
    clientY: number;
    ctrlKey: boolean;
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
}