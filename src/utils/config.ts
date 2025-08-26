import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

/**
 * Configuration interface ensuring all required values exist
 */
export interface Config {
  readonly NODE_ENV: string;
  readonly PORT: number;
  readonly LOG_LEVEL: string;
  readonly TODOIST_API_KEY: string;
  readonly MCP_SERVER_NAME: string;
  readonly MCP_SERVER_VERSION: string;
}

/**
 * Get environment variable with validation
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get numeric environment variable with validation
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  return parsed;
}

/**
 * Create and validate configuration object
 * This ensures config is never undefined and all required values exist
 */
function createConfig(): Config {
  // Validate required environment variables exist
  const todoistApiKey = getEnvVar('TODOIST_API_KEY');
  
  if (!todoistApiKey) {
    throw new Error(
      'TODOIST_API_KEY environment variable is required. ' +
      'Please set it in your .env file or environment variables.'
    );
  }

  return {
    NODE_ENV: getEnvVar('NODE_ENV', 'development'),
    PORT: getEnvNumber('PORT', 3000),
    LOG_LEVEL: getEnvVar('LOG_LEVEL', 'info'),
    TODOIST_API_KEY: todoistApiKey,
    MCP_SERVER_NAME: getEnvVar('MCP_SERVER_NAME', 'claude-todoist-api'),
    MCP_SERVER_VERSION: getEnvVar('MCP_SERVER_VERSION', '1.0.0'),
  } as const;
}

// Create configuration object - this will throw if invalid
export const config: Config = createConfig();

// Export utility functions
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTesting = config.NODE_ENV === 'test';