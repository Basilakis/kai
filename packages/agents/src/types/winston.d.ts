/**
 * Type declarations for Winston logger
 * 
 * This file provides TypeScript declarations for the Winston logging library
 * used in the agent system.
 */

declare module 'winston' {
  export interface LoggerOptions {
    level?: string;
    format?: Formatter;
    defaultMeta?: any;
    transports?: Transport[];
    exitOnError?: boolean;
    silent?: boolean;
  }

  export interface Transport {
    level?: string;
    silent?: boolean;
    format?: Formatter;
    handleExceptions?: boolean;
    filename?: string;
  }

  export class transports {
    static Console: ConsoleTransportConstructor;
    static File: FileTransportConstructor;
  }

  interface ConsoleTransportConstructor {
    new(options?: ConsoleTransportOptions): Transport;
  }

  interface FileTransportConstructor {
    new(options?: FileTransportOptions): Transport;
  }

  export interface ConsoleTransportOptions {
    level?: string;
    format?: Formatter;
    stderrLevels?: string[];
    consoleWarnLevels?: string[];
    handleExceptions?: boolean;
  }

  export interface FileTransportOptions {
    level?: string;
    filename?: string;
    dirname?: string;
    maxsize?: number;
    maxFiles?: number;
    tailable?: boolean;
    zippedArchive?: boolean;
    format?: Formatter;
    handleExceptions?: boolean;
  }

  export interface Formatter {
    transform(info: any): any;
  }

  export class format {
    static combine(...formats: Formatter[]): Formatter;
    static timestamp(options?: TimestampOptions): Formatter;
    static printf(templateFunction: (info: any) => string): Formatter;
    static colorize(options?: ColorizeOptions): Formatter;
    static json(): Formatter;
    static simple(): Formatter;
    static align(): Formatter;
    static cli(): Formatter;
    static label(options: LabelOptions): Formatter;
    static prettyPrint(options?: PrettyPrintOptions): Formatter;
    static splat(): Formatter;
  }

  export interface TimestampOptions {
    format?: string | (() => string);
    alias?: string;
  }

  export interface ColorizeOptions {
    level?: boolean;
    message?: boolean;
    all?: boolean;
    colors?: Record<string, string>;
  }

  export interface LabelOptions {
    label: string;
  }

  export interface PrettyPrintOptions {
    depth?: number;
    colorize?: boolean;
  }

  export interface Logger {
    level: string;
    log(level: string, message: string, ...meta: any[]): Logger;
    error(message: string, ...meta: any[]): Logger;
    warn(message: string, ...meta: any[]): Logger;
    info(message: string, ...meta: any[]): Logger;
    debug(message: string, ...meta: any[]): Logger;
    verbose(message: string, ...meta: any[]): Logger;
    silly(message: string, ...meta: any[]): Logger;
    add(transport: Transport): Logger;
    remove(transport: Transport): Logger;
    clear(): Logger;
    exceptions: ExceptionHandler;
    rejections: RejectionHandler;
  }

  export interface ExceptionHandler {
    handle(transport: Transport): void;
    unhandle(): void;
  }

  export interface RejectionHandler {
    handle(transport: Transport): void;
    unhandle(): void;
  }

  export function createLogger(options: LoggerOptions): Logger;
}