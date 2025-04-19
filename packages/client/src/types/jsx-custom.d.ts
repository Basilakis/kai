/**
 * Custom JSX Type Declarations for 3D Components
 *
 * This file provides enhanced JSX element type declarations to fix TypeScript errors
 * in various 3D components related to HTML element properties and THREE.js modules.
 */

import * as React from 'react';

// Add declaration for TransformControls module to fix import issues
declare module 'three/examples/jsm/controls/TransformControls' {
  import * as THREE from 'three';
  
  export class TransformControls extends THREE.Object3D {
    constructor(camera: THREE.Camera, domElement?: HTMLElement);
    
    camera: THREE.Camera;
    object: THREE.Object3D | null;
    enabled: boolean;
    axis: string | null;
    mode: string;
    dragging: boolean;
    
    attach(object: THREE.Object3D): this;
    detach(): this;
    getMode(): string;
    setMode(mode: string): void;
    setSpace(space: string): void;
    setSize(size: number): void;
    
    addEventListener(type: string, listener: (event: any) => void): void;
    removeEventListener(type: string, listener: (event: any) => void): void;
    dispatchEvent(event: { type: string; [key: string]: any }): void;
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    input: React.DetailedHTMLProps<
      React.InputHTMLAttributes<HTMLInputElement> & {
        type?: string;
        name?: string;
        min?: string | number;
        max?: string | number;
        step?: string | number;
        value?: string | number | readonly string[];
        onChange?: React.ChangeEventHandler<HTMLInputElement>;
      },
      HTMLInputElement
    >;
    
    select: React.DetailedHTMLProps<
      React.SelectHTMLAttributes<HTMLSelectElement> & {
        children?: React.ReactNode;
        name?: string;
        value?: string | number | readonly string[];
        onChange?: React.ChangeEventHandler<HTMLSelectElement>;
      },
      HTMLSelectElement
    >;
    
    option: React.DetailedHTMLProps<
      React.OptionHTMLAttributes<HTMLOptionElement> & {
        children?: React.ReactNode;
        value?: string | number | readonly string[];
      },
      HTMLOptionElement
    >;
    
    // Add li element type definition
    li: React.DetailedHTMLProps<
      React.LiHTMLAttributes<HTMLLIElement> & {
        children?: React.ReactNode;
        key?: React.Key;
      },
      HTMLLIElement
    >;
  }
}

// Add li element type to React namespace

// Add global React namespace definition to ensure types are applied universally
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    type?: string;
    name?: string;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    value?: string | number | readonly string[];
  }

  interface SelectHTMLAttributes<T> extends HTMLAttributes<T> {
    name?: string;
    value?: string | number | readonly string[];
  }

  interface OptionHTMLAttributes<T> extends HTMLAttributes<T> {
    value?: string | number | readonly string[];
  }
  
  // Add LiHTMLAttributes
  interface LiHTMLAttributes<T> extends HTMLAttributes<T> {
    value?: string | number | readonly string[];
  }
}

// Ensure this file is treated as a module
export {};