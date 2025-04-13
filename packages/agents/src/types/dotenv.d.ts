/**
 * Type declarations for dotenv module
 */

declare module 'dotenv' {
  /**
   * Loads environment variables from a .env file into process.env
   */
  export function config(options?: {
    /**
     * Path to .env file
     * @default '.env'
     */
    path?: string;
    /**
     * Encoding of .env file
     * @default 'utf8'
     */
    encoding?: string;
    /**
     * Debug mode
     * @default false
     */
    debug?: boolean;
    /**
     * Override existing env variables
     * @default false
     */
    override?: boolean;
  }): {
    error?: Error;
    parsed?: { [key: string]: string };
  };

  /**
   * Parses a string or buffer in the .env file format into an object
   */
  export function parse(
    src: string | Buffer,
    options?: {
      /**
       * Debug mode
       * @default false
       */
      debug?: boolean;
    }
  ): { [key: string]: string };
}
