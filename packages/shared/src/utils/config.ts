/**
 * Configuration utility for managing environment variables
 * and application settings across packages
 */

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

export interface AppEnv {
  NODE_ENV: 'development' | 'production' | 'test';
}

export type EnvConfig = SupabaseEnv & AppEnv;

class ConfigManager {
  private static instance: ConfigManager;
  private env: Partial<EnvConfig> = {};

  private constructor() {
    // Initialize with environment values
    this.env = {
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_KEY: process.env.SUPABASE_KEY || '',
      NODE_ENV: (process.env.NODE_ENV as AppEnv['NODE_ENV']) || 'development'
    };
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get environment variable value
   */
  public get<K extends keyof EnvConfig>(key: K): EnvConfig[K] | undefined {
    return this.env[key];
  }

  /**
   * Set environment variable value
   */
  public set<K extends keyof EnvConfig>(key: K, value: EnvConfig[K]): void {
    this.env[key] = value;
  }

  /**
   * Get all environment variables
   */
  public getAll(): Partial<EnvConfig> {
    return { ...this.env };
  }

  /**
   * Update multiple environment variables
   */
  public update(config: Partial<EnvConfig>): void {
    this.env = {
      ...this.env,
      ...config
    };
  }

  /**
   * Reset configuration
   */
  public reset(): void {
    this.env = {};
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();

// Export default for convenience
export default config;