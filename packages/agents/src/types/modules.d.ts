declare module 'three' {
    export * from '@types/three';
}

declare module 'python-shell' {
    export interface Options {
        mode?: 'text' | 'json' | 'binary';
        pythonPath?: string;
        pythonOptions?: string[];
        scriptPath?: string;
        args?: string[];
    }

    export class PythonShell {
        constructor(script: string, options?: Options);
        on(event: string, listener: (...args: any[]) => void): this;
        once(event: string, listener: (...args: any[]) => void): this;
        send(message: string): void;
        kill(): void;
    }
}

// Path module is already declared in node.d.ts