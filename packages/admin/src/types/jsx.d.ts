/// <reference types="react" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      br: {
        key?: string | number;
      };
      [elemName: string]: any;
    }
  }
}

export {};