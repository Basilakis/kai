/**
 * Type declarations for external modules
 */

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