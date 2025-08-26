import winston from 'winston';
import { config, isDevelopment } from './config.js';

/**
 * Custom log format for better readability
 * Similar to Python's logging formatters
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    // In development, use a more readable format
    if (isDevelopment()) {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      const stackStr = stack ? `\n${stack}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}${stackStr}`;
    }
    
    // In production, use structured JSON logging
    const logObject: Record<string, any> = {
      timestamp,
      level,
      message,
    };
    
    if (stack) {
      logObject.stack = stack;
    }
    
    // Add other metadata
    Object.assign(logObject, meta);
    
    return JSON.stringify(logObject);
  })
);

/**
 * Create Winston logger instance with appropriate transports
 * Transports determine where logs are sent (console, files, etc.)
 */
const winstonLogger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: customFormat,
  defaultMeta: {
    service: config.MCP_SERVER_NAME,
    version: config.MCP_SERVER_VERSION,
  },
  transports: [
    // Console transport for development and production
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// Add file transports in production for persistence
if (!isDevelopment()) {
  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  );
  
  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  );
}

/**
 * Enhanced logger with additional utility methods
 * Provides context-aware logging for different parts of the application
 */
class AppLogger {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Create a child logger with additional context
   * Similar to Python's logging.getLogger(__name__)
   */
  child(meta: Record<string, any>) {
    return new AppLogger(this.logger.child(meta));
  }

  // Standard logging methods
  error(message: string, meta?: Record<string, any>) {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.logger.debug(message, meta);
  }

  /**
   * Log MCP-specific events with structured data
   */
  mcpEvent(event: string, data?: Record<string, any>) {
    this.info(`MCP Event: ${event}`, { 
      event_type: 'mcp',
      event_name: event,
      ...data 
    });
  }

  /**
   * Log Todoist API interactions
   */
  todoistApi(method: string, endpoint: string, status?: number, meta?: Record<string, any>) {
    this.info(`Todoist API: ${method} ${endpoint}`, {
      event_type: 'todoist_api',
      method,
      endpoint,
      status,
      ...meta
    });
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, meta?: Record<string, any>) {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      event_type: 'performance',
      operation,
      duration_ms: duration,
      ...meta
    });
  }

  /**
   * Log errors with stack traces and context
   */
  errorWithContext(error: Error, context: string, meta?: Record<string, any>) {
    this.error(`Error in ${context}: ${error.message}`, {
      error_name: error.name,
      error_message: error.message,
      stack: error.stack,
      context,
      ...meta
    });
  }
}

// Export the main logger instance
export const appLogger = new AppLogger(winstonLogger);

/**
 * Create module-specific loggers
 * Usage: const moduleLogger = createModuleLogger('todoist-service');
 */
export const createModuleLogger = (module: string) => {
  return appLogger.child({ module });
};

/**
 * Request correlation middleware helper
 * For tracking requests across different parts of the application
 */
export const createRequestLogger = (requestId: string) => {
  return appLogger.child({ request_id: requestId });
};

export default appLogger;