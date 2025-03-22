/**
 * Type declarations for Hugging Face libraries
 * 
 * This provides TypeScript types for Hugging Face libraries when they
 * are not directly available from installed packages.
 */

declare module '@huggingface/inference' {
  export class HfInference {
    constructor(token?: string);
    // Add methods as needed
  }
}

declare module '@huggingface/hub' {
  export const HfFolder: {
    getToken(): string | null;
  };

  export function whoAmI(options: { token: string }): Promise<{
    name: string;
    fullname?: string;
    email?: string;
    orgs?: string[];
  } | null>;
}

// Need to ensure Buffer is properly typed for browser environments
declare namespace NodeJS {
  interface Global {
    Buffer: typeof Buffer;
  }
}