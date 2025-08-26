import winston from 'winston';
import { config } from './config';

/**
 * Log levels in order of priority (winston format)
 */
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaString = '';
    if (Object.keys(meta).length > 0) {
      metaString = ' ' + JSON.stringify(meta, null, 2);
    }
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

/**
 * JSON format for production
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create Winston logger instance
 */
const createLogger = (): winston.Logger => {
  const transports: winston.transport[] = [];

  // Console transport (always enabled)
  transports.push(
    new winston.transports.Console({
      level: config.LOG_LEVEL,
      format: config.NODE_ENV === 'production' ? jsonFormat : consoleFormat,
      handleExceptions: true,
      handleRejections: true,
    })
  );

  // File transport for production
  if (config.NODE_ENV === 'production') {
    transports.push(
      new winston.transports.File({
        filename: 'error.log',
        level: 'error',
        format: jsonFormat,
        handleExceptions: true,
        handleRejections: true,
      })
    );

    transports.push(
      new winston.transports.File({
        filename: 'combined.log',
        level: config.LOG_LEVEL,
        format: jsonFormat,
      })
    );
  }

  return winston.createLogger({
    levels: logLevels,
    level: config.LOG_LEVEL,
    format: jsonFormat,
    transports,
    exitOnError: false,
  });
};

// Create and export the logger instance
export const appLogger = createLogger();

// Export logger for backward compatibility and convenience
export const logger = appLogger;
export default appLogger;