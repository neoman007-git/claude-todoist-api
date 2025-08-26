import 'dotenv/config';
import { ExpressServer } from './server/express-server';
import { appLogger } from './utils/logger';
import { config } from './utils/config';

// Graceful shutdown handling
process.on('SIGTERM', () => {
  appLogger.info('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  appLogger.info('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  appLogger.error('💥 Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  appLogger.error('💥 Unhandled Rejection', { reason, promise });
  process.exit(1);
});

async function startServer() {
  try {
    appLogger.info('🚀 Starting Claude Todoist API Server', {
      node_version: process.version,
      environment: config.NODE_ENV,
      port: config.PORT || 3000
    });

    const server = new ExpressServer();
    await server.start();

  } catch (error) {
    appLogger.error('❌ Failed to start server', { 
      error: error instanceof Error ? error.message : error 
    });
    process.exit(1);
  }
}

// Start the server
startServer();