import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration schema using Zod for runtime validation
 * Similar to Pydantic models in Python - validates and transforms data at runtime
 */
const ConfigSchema = z.object({
  // Environment settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(3000),
  
  // Todoist API settings
  TODOIST_API_KEY: z.string().min(10, 'Todoist API key must be at least 10 characters'),
  
  // MCP Server settings
  MCP_SERVER_NAME: z.string().default('claude-todoist-mcp'),
  MCP_SERVER_VERSION: z.string().default('1.0.0'),
  
  // Logging settings
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Optional: Rate limiting settings for future use
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
});

/**
 * Parse and validate configuration from environment variables
 * This approach ensures type safety and catches configuration errors early
 */
function loadConfig() {
  try {
    // Parse environment variables against our schema
    const config = ConfigSchema.parse(process.env);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Provide helpful error messages for missing/invalid config
      console.error('❌ Configuration validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
    } else {
      console.error('❌ Failed to load configuration:', error);
    }
    process.exit(1);
  }
}

// Load and validate configuration once at startup
export const config = loadConfig();

// Export type for use in other files (TypeScript feature)
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Utility function to check if we're in development mode
 * Useful for enabling development-specific features
 */
export const isDevelopment = () => config.NODE_ENV === 'development';

/**
 * Utility function to check if we're in production mode
 * Useful for enabling production optimizations
 */
export const isProduction = () => config.NODE_ENV === 'production';

/**
 * Utility function to check if we're in test mode
 * Useful for test-specific configurations
 */
export const isTest = () => config.NODE_ENV === 'test';