#!/usr/bin/env node
/**
 * Claude Todoist API Server
 * Entry point for the Express REST API server
 */

// ❌ REMOVED: import './types/global'; // This line caused the runtime error
import { config } from './utils/config';
import { appLogger } from './utils/logger';
import { createExpressServer } from './server/express-server';

// Global error handlers with proper types
process.on('uncaughtException', (error: Error) => {
  appLogger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  appLogger.error('Unhandled Rejection:', { reason, promise });
  process.exit(1);
});

/**
 * Start the server with proper error handling
 */
async function startServer(): Promise<void> {
  try {
    appLogger.info('Starting Claude Todoist API Server', {
      environment: config.NODE_ENV,
      port: config.PORT,
      logLevel: config.LOG_LEVEL,
      serverName: config.MCP_SERVER_NAME,
      version: config.MCP_SERVER_VERSION
    });

    // Create and start the Express server
    const app = await createExpressServer();
    
    // Start listening
    const server = app.listen(config.PORT, () => {
      appLogger.info(`Server running on port ${config.PORT}`, {
        url: `http://localhost:${config.PORT}`,
        environment: config.NODE_ENV
      });
    });

    // Graceful shutdown handlers
    const shutdown = (signal: string) => {
      appLogger.info(`Received ${signal}, shutting down gracefully`);
      server.close(() => {
        appLogger.info('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    appLogger.error('Failed to start server', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Start the server
startServer().catch((error: Error) => {
  appLogger.error('Startup error', { error: error.message, stack: error.stack });
  process.exit(1);
});