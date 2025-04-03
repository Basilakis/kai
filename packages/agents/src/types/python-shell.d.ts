declare module 'python-shell' {
  export interface Options {
    mode?: 'text' | 'json' | 'binary';
    formatter?: (param: string) => any;
    parser?: (param: string) => any;
    stderrParser?: (param: string) => any;
    pythonPath?: string;
    pythonOptions?: string[];
    scriptPath?: string;
    args?: string[];
    env?: NodeJS.ProcessEnv;
  }

  export interface Message {
    [key: string]: any;
  }

  export class PythonShell {
    static defaultOptions: Options;
    static run(scriptPath: string, options?: Options): Promise<Message[]>;
    static runString(code: string, options?: Options): Promise<Message[]>;
    static checkSyntax(code: string): Promise<void>;
    static getVersion(pythonPath?: string): Promise<string>;
    static getPythonPath(): string;

    constructor(scriptPath: string, options?: Options);
    send(message: any): void;
    end(callback?: (err?: Error, exitCode?: number) => void): void;
    terminate(signal?: string): void;
    kill(signal?: string): void;
    on(event: string, callback: (...args: any[]) => void): void;
    stdout: NodeJS.ReadableStream;
    stderr: NodeJS.ReadableStream;
    terminated: boolean;
    exitCode: number | null;
    exitSignal: string | null;
  }

  export default PythonShell;
}