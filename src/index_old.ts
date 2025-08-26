#!/usr/bin/env node

/**
 * Todoist MCP Server - Main Entry Point (using McpServer)
 * 
 * This server provides Claude AI with tools to interact with Todoist
 * for task management through the Model Context Protocol (MCP).
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './server/mcp-server.js';
import { config, isDevelopment } from './utils/config.js';
import { createModuleLogger } from './utils/logger.js';
import { todoistService } from './services/todoist.service.js';

const mainLogger = createModuleLogger('main');

/**
 * Graceful shutdown handler
 * Ensures proper cleanup when the server is terminated
 */
async function shutdown(signal: string) {
  mainLogger.info(`Received ${signal}, initiating graceful shutdown...`);
  
  try {
    // Add any cleanup logic here
    // For now, we don't have persistent connections to close
    
    mainLogger.info('Server shutdown complete');
    process.exit(0);
  } catch (error) {
    mainLogger.errorWithContext(error as Error, 'Shutdown process');
    process.exit(1);
  }
}

/**
 * Initialize the server and perform startup checks
 */
async function initializeServer() {
  mainLogger.info('🚀 Starting Todoist MCP Server', {
    name: config.MCP_SERVER_NAME,
    version: config.MCP_SERVER_VERSION,
    environment: config.NODE_ENV,
    port: config.PORT,
  });

  // Perform health checks
  mainLogger.info('🔍 Performing startup health checks...');

  try {
    // Check Todoist API connectivity
    const isHealthy = await todoistService.healthCheck();
    if (!isHealthy) {
      throw new Error('Todoist API health check failed');
    }

    // Get basic account info to verify API key is working
    const accountInfo = await todoistService.getAccountInfo();
    mainLogger.info('✅ Todoist API connection verified', {
      projects_count: accountInfo.projects_count,
      tasks_count: accountInfo.tasks_count,
    });

    // Create and configure the MCP server
    const server = createMcpServer();

    // Set up stdio transport for MCP communication
    const transport = new StdioServerTransport();
    
    mainLogger.info('🔗 Connecting MCP server to stdio transport...');
    await server.connect(transport);

    mainLogger.info('✅ Todoist MCP Server is ready and listening for requests');
    
    // In development, show helpful information
    if (isDevelopment()) {
      mainLogger.info('🛠️  Development mode active', {
        log_level: config.LOG_LEVEL,
        mcp_server_name: config.MCP_SERVER_NAME,
        todoist_api_key_length: config.TODOIST_API_KEY.length,
      });

      // Show available tools
      mainLogger.info('🧰 Available tools for Claude:', {
        tools: [
          'get_tasks - Retrieve tasks with optional filtering',
          'create_task - Create new tasks',
          'update_task - Update existing tasks', 
          'complete_task - Mark tasks as completed',
          'reopen_task - Reopen completed tasks',
          'delete_task - Delete tasks',
          'get_projects - Retrieve all projects',
          'create_project - Create new projects',
          'get_labels - Retrieve all labels',
          'health_check - Check service health',
        ]
      });
    }

  } catch (error) {
    mainLogger.errorWithContext(
      error as Error,
      'Server initialization',
      { 
        config_check: 'Check your .env file',
        api_key_check: 'Verify your Todoist API key is valid',
        network_check: 'Ensure you have internet connectivity',
      }
    );
    
    // Exit with error code
    process.exit(1);
  }
}

/**
 * Enhanced error handler for uncaught exceptions
 * Provides detailed logging before shutdown
 */
function setupErrorHandlers() {
  process.on('uncaughtException', (error) => {
    mainLogger.errorWithContext(error, 'Uncaught exception');
    console.error('\n💥 Uncaught Exception - Server will shut down');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    mainLogger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise_info: String(promise),
    });
    console.error('\n⚠️  Unhandled Promise Rejection detected');
  });

  // Graceful shutdown on signals
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle pipe errors (common in stdio transport)
  process.on('SIGPIPE', () => {
    mainLogger.info('Client disconnected (SIGPIPE)');
    process.exit(0);
  });
}

/**
 * Startup diagnostics for troubleshooting
 */
function logStartupDiagnostics() {
  const diagnostics = {
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    memory_usage: process.memoryUsage(),
    uptime: process.uptime(),
    environment: {
      NODE_ENV: config.NODE_ENV,
      MCP_SERVER_NAME: config.MCP_SERVER_NAME,
      LOG_LEVEL: config.LOG_LEVEL,
      has_todoist_key: !!config.TODOIST_API_KEY,
      todoist_key_preview: config.TODOIST_API_KEY ? 
        `${config.TODOIST_API_KEY.slice(0, 8)}...${config.TODOIST_API_KEY.slice(-4)}` : 
        'Not set',
    }
  };

  if (isDevelopment()) {
    mainLogger.debug('🔧 Startup diagnostics', diagnostics);
  } else {
    // In production, log only essential info
    mainLogger.info('📊 Server started', {
      node_version: diagnostics.node_version,
      environment: config.NODE_ENV,
      server_name: config.MCP_SERVER_NAME,
    });
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Set up error handling first
    setupErrorHandlers();

    // Log startup information
    logStartupDiagnostics();

    // Initialize and start the server
    await initializeServer();

    // Server is now running and will handle requests via stdio
    // The process will continue running until terminated
    
  } catch (error) {
    mainLogger.errorWithContext(error as Error, 'Main execution');
    
    console.error('\n❌ Failed to start Todoist MCP Server');
    console.error('Please check the error messages above and your configuration.');
    
    if (isDevelopment()) {
      console.error('\n🛟 Troubleshooting tips:');
      console.error('1. Verify your .env file contains a valid TODOIST_API_KEY');
      console.error('2. Check your internet connection to api.todoist.com');
      console.error('3. Ensure all dependencies are installed: npm install');
      console.error('4. Try running: npm run type-check');
    }
    
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('❌ Fatal error during startup:', error);
  process.exit(1);
});