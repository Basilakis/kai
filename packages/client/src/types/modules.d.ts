/**
 * Type declarations for external modules
 */

// html2canvas declaration
declare module 'html2canvas' {
  interface Html2CanvasOptions {
    /** Scale to use for rendering */
    scale?: number;
    /** Whether to use CORS for images or not */
    useCORS?: boolean;
    /** Whether to log messages to console */
    logging?: boolean;
    /** Background color to use */
    backgroundColor?: string;
    /** Width to render at */
    width?: number;
    /** Height to render at */
    height?: number;
    /** X position to render at */
    x?: number;
    /** Y position to render at */
    y?: number;
    /** Window to use for rendering */
    windowWidth?: number;
    /** Proxy URL for loading cross-origin images */
    proxy?: string;
    /** Timeout for loading images */
    imageTimeout?: number;
  }

  /**
   * Convert an HTML element to a canvas element
   * @param element - The HTML element to convert
   * @param options - Configuration options
   * @returns A Promise that resolves to a canvas element
   */
  function html2canvas(element: HTMLElement, options?: Html2CanvasOptions): Promise<HTMLCanvasElement>;
  
  export default html2canvas;
}

// jspdf declaration
declare module 'jspdf' {
  interface JsPDFOptions {
    /** Page orientation: 'portrait' or 'landscape' */
    orientation?: 'portrait' | 'landscape';
    /** Measurement unit: 'mm', 'cm', 'in', 'px', 'pt' */
    unit?: 'mm' | 'cm' | 'in' | 'px' | 'pt';
    /** Page format: 'a4', 'letter', etc. or [width, height] */
    format?: string | [number, number];
    /** Force compression of PDF into smaller size */
    compress?: boolean;
    /** PDF standard version */
    putOnlyUsedFonts?: boolean;
    /** User password */
    userPassword?: string;
    /** Owner password */
    ownerPassword?: string;
  }

  /**
   * jsPDF document class
   */
  class jsPDF {
    constructor(options?: JsPDFOptions);

    /**
     * Set document font size
     * @param size - Font size in points
     */
    setFontSize(size: number): jsPDF;

    /**
     * Add text to the document
     * @param text - Text to add
     * @param x - X coordinate
     * @param y - Y coordinate
     */
    text(text: string | string[], x: number, y: number, options?: any): jsPDF;

    /**
     * Add a new page to the document
     * @returns jsPDF instance for chaining
     */
    addPage(): jsPDF;
    
    /**
     * Split text into multiple lines
     * @param text - Text to split
     * @param maxWidth - Maximum width of the text
     * @returns Array of text lines
     */
    splitTextToSize(text: string, maxWidth: number): string[];
    
    /**
     * Add an image to the document
     * @param imageData - Image data (base64, imageElement, canvas)
     * @param format - Image format (JPEG, PNG, etc.)
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param width - Width of the image
     * @param height - Height of the image
     */
    addImage(imageData: any, format: string, x: number, y: number, width: number, height: number): jsPDF;
    
    /**
     * Set the current page
     * @param pageNumber - Page number (1-based)
     * @returns jsPDF instance for chaining
     */
    setPage(pageNumber: number): jsPDF;
    
    /**
     * Get the number of pages
     * @returns Number of pages
     */
    getNumberOfPages(): number;
    
    /**
     * Output the document
     * @param type - Output type (datauristring, datauri, blob)
     * @returns Document as requested type
     */
    output(type: string): any;
  }

  export { jsPDF };
}

// React module declarations
declare module 'react' {
  export import React = __React;
  export interface FC<P = {}> {
    (props: P): React.ReactElement | null;
    displayName?: string;
  }
  export type ChangeEvent<T = Element> = {
    target: T;
    currentTarget: T;
  };
  
  // Improved useState typing
  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useState<T = undefined>(): [T | undefined, (newState: T | ((prevState: T | undefined) => T)) => void];
  
  export const useEffect: any;
}

// Material UI declarations
declare module '@mui/material' {
  export const Box: any;
  export const Button: any;
  export const Card: any;
  export const CardContent: any;
  export const CardHeader: any;
  export const CircularProgress: any;
  export const Divider: any;
  export const FormControl: any;
  export const FormHelperText: any;
  export const Grid: any;
  export const InputLabel: any;
  export const MenuItem: any;
  export const Select: any;
  export const TextField: any;
  export const Typography: any;
  export const Alert: any;
  export const Collapse: any;
  export type SelectChangeEvent = {
    target: { value: unknown };
  };
}

// Material UI Icons declarations
declare module '@mui/icons-material' {
  export const Check: any;
  export const Error: any;
}

// JSX namespace
declare namespace JSX {
  interface IntrinsicElements {
    span: any;
    div: any;
  }
}

// Additional type declarations for namespace __React
declare namespace __React {
  export type ReactElement = any;
}

// Node.js process declarations
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test';
    REACT_APP_API_URL?: string;
    REACT_APP_VERSION?: string;
    [key: string]: string | undefined;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};

// Axios type declarations
declare module 'axios' {
  export interface AxiosRequestConfig {
    baseURL?: string;
    headers?: Record<string, string>;
    params?: any;
    data?: any;
    timeout?: number;
  }

  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    config: AxiosRequestConfig;
  }

  export interface AxiosError<T = any> extends Error {
    config: AxiosRequestConfig;
    code?: string;
    request?: any;
    response?: AxiosResponse<T>;
    isAxiosError: boolean;
  }

  export interface AxiosInstance {
    (config: AxiosRequestConfig): Promise<AxiosResponse>;
    (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
    defaults: AxiosRequestConfig;
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  }

  export function create(config?: AxiosRequestConfig): AxiosInstance;
  
  // Use this syntax instead of 'default' keyword
  const instance: AxiosInstance;
  export default instance;
}