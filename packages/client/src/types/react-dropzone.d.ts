/**
 * React Dropzone Type Declarations
 * 
 * This file provides TypeScript declarations for the react-dropzone package
 * used in the RecognitionPanel component for file uploads.
 */

declare module 'react-dropzone' {
  import * as React from 'react';

  export interface DropzoneOptions {
    /**
     * Function to handle dropped files
     */
    onDrop?: (acceptedFiles: File[], rejectedFiles: File[], event: React.DragEvent<HTMLElement>) => void;
    
    /**
     * Object containing file types to accept
     */
    accept?: Record<string, string[]>;
    
    /**
     * Function to determine if a file is accepted
     */
    validator?: (file: File) => { code: string; message: string } | null;
    
    /**
     * Maximum number of files allowed
     */
    maxFiles?: number;
    
    /**
     * Minimum size of files in bytes
     */
    minSize?: number;
    
    /**
     * Maximum size of files in bytes
     */
    maxSize?: number;
    
    /**
     * Whether to disable the dropzone
     */
    disabled?: boolean;
    
    /**
     * Whether to show any accepted files in the dropzone
     */
    noDrag?: boolean;
    
    /**
     * Whether to handle multiple files
     */
    multiple?: boolean;
    
    /**
     * Whether to prevent default drag behavior
     */
    preventDropOnDocument?: boolean;
    
    /**
     * Whether to allow directories to be dropped
     */
    noClick?: boolean;
    
    /**
     * Whether to open file dialog when dropzone is clicked
     */
    noKeyboard?: boolean;
  }

  export interface DropzoneState {
    getRootProps: (props?: Object) => Object;
    getInputProps: (props?: Object) => Object;
    isDragActive: boolean;
    isDragAccept: boolean;
    isDragReject: boolean;
    isFileDialogActive: boolean;
    isFocused: boolean;
    acceptedFiles: File[];
    fileRejections: { file: File; errors: Array<{ code: string; message: string }> }[];
    open: () => void;
  }

  /**
   * Hook to create a dropzone for file uploads
   */
  export function useDropzone(options?: DropzoneOptions): DropzoneState;

  /**
   * Component to create a dropzone for file uploads
   */
  export const Dropzone: React.FC<React.PropsWithChildren<DropzoneOptions>>;

  export default Dropzone;
}