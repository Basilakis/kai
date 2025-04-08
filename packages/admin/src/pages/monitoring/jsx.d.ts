// JSX namespace declarations for the monitoring component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
      h1: any;
      h2: any;
      h3: any;
      h4: any;
      h5: any;
      p: any;
      span: any;
      button: any;
      table: any;
      thead: any;
      tbody: any;
      tr: any;
      th: any;
      td: any;
      input: any;
      select: any;
      option: any;
      label: any;
      nav: any;
      svg: any;
      path: any;
      circle: any;
      [elemName: string]: any;
    }
  }
}

// This export makes this file a module
export {};