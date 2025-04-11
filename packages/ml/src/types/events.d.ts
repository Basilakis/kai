/**
 * Type declarations for the Node.js events module
 * Focused on EventEmitter which is used in the RAG bridge
 */

declare module 'events' {
  export class EventEmitter {
    constructor();
    
    addListener(event: string | symbol, listener: (...args: any[]) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;
    
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    
    listeners(event: string | symbol): Function[];
    rawListeners(event: string | symbol): Function[];
    
    emit(event: string | symbol, ...args: any[]): boolean;
    
    listenerCount(event: string | symbol): number;
    
    prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
    
    eventNames(): Array<string | symbol>;
  }
  
  export default EventEmitter;
}