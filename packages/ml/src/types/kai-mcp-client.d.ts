// Minimal type declarations for the hypothetical "@kai/mcp-client" module

declare module '@kai/mcp-client' {
  export interface RecognitionOptions {
    confidenceThreshold?: number;
    [key: string]: any;
  }

  export interface RecognitionResult {
    labels: string[];
    scores: number[];
    [key: string]: any;
  }

  export class MCPClient {
    constructor(baseUrl: string);

    checkHealth(): Promise<void>;
    recognizeMaterial(imagePath: string, options?: RecognitionOptions): Promise<RecognitionResult>;
    sendAgentMessage(message: any): Promise<void>;
    getAgentMessages(maxWait: number): Promise<{ messages: any[]; count: number }>;
  }
}