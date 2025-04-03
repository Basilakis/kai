declare module 'python-shell' {
  export class PythonShell {
    constructor(scriptPath: string, options?: PythonShellOptions);
    send(message: string): void;
    end(): void;
    on(event: string, callback: (message: string) => void): void;
    once(event: string, callback: (message: string) => void): void;
  }

  export interface PythonShellOptions {
    mode?: string;
    pythonPath?: string;
    pythonOptions?: string[];
    scriptPath?: string;
    args?: string[];
  }
}