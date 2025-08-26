/**
 * Transport layer utilities for MCP server communication
 * 
 * This module provides utilities for handling different transport mechanisms
 * that the MCP server can use to communicate with Claude or other clients.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('transport');

/**
 * Transport types supported by the MCP server
 */
export enum TransportType {
  STDIO = 'stdio',
  // Future transport types can be added here:
  // HTTP = 'http',
  // WEBSOCKET = 'websocket',
}

/**
 * Transport configuration interface
 */
export interface TransportConfig {
  type: TransportType;
  options?: Record<string, any>;
}

/**
 * Create a transport instance based on configuration
 */
export function createTransport(config: TransportConfig) {
  logger.debug('Creating transport', { type: config.type, options: config.options });

  switch (config.type) {
    case TransportType.STDIO:
      return createStdioTransport(config.options);
      
    default:
      throw new Error(`Unsupported transport type: ${config.type}`);
  }
}

/**
 * Create a STDIO transport for communication via stdin/stdout
 * This is the standard transport for MCP servers
 */
function createStdioTransport(options?: Record<string, any>) {
  logger.info('Creating STDIO transport');
  
  const transport = new StdioServerTransport();

  // Add event listeners for monitoring
  transport.onclose = () => {
    logger.info('STDIO transport closed');
  };

  transport.onerror = (error) => {
    logger.errorWithContext(error, 'STDIO transport error');
  };

  return transport;
}

/**
 * Transport health check utility
 * Verifies that the transport is working correctly
 */
export function checkTransportHealth(transport: any): boolean {
  try {
    // Basic health check - ensure transport exists and has required methods
    if (!transport) {
      logger.error('Transport is null or undefined');
      return false;
    }

    // Check if transport has the required methods
    const requiredMethods = ['close'];
    for (const method of requiredMethods) {
      if (typeof transport[method] !== 'function') {
        logger.error(`Transport missing required method: ${method}`);
        return false;
      }
    }

    logger.debug('Transport health check passed');
    return true;
  } catch (error) {
    logger.errorWithContext(error as Error, 'Transport health check');
    return false;
  }
}

/**
 * Gracefully close a transport connection
 */
export async function closeTransport(transport: any): Promise<void> {
  try {
    logger.info('Closing transport connection');
    
    if (transport && typeof transport.close === 'function') {
      await transport.close();
      logger.info('Transport closed successfully');
    } else {
      logger.warn('Transport does not support graceful closing');
    }
  } catch (error) {
    logger.errorWithContext(error as Error, 'Error closing transport');
    throw error;
  }
}

/**
 * Transport monitoring utilities
 */
export class TransportMonitor {
  private transport: any;
  private startTime: number;
  private messageCount: number = 0;
  private errorCount: number = 0;

  constructor(transport: any) {
    this.transport = transport;
    this.startTime = Date.now();
    this.setupMonitoring();
  }

  private setupMonitoring() {
    // Monitor transport events if available
    if (this.transport.onmessage) {
      const originalOnMessage = this.transport.onmessage;
      this.transport.onmessage = (message: any) => {
        this.messageCount++;
        logger.debug('Transport message received', { 
          count: this.messageCount,
          type: message?.type 
        });
        return originalOnMessage?.call(this.transport, message);
      };
    }

    if (this.transport.onerror) {
      const originalOnError = this.transport.onerror;
      this.transport.onerror = (error: any) => {
        this.errorCount++;
        logger.error('Transport error', { 
          error_count: this.errorCount,
          error: error?.message 
        });
        return originalOnError?.call(this.transport, error);
      };
    }
  }

  /**
   * Get transport statistics
   */
  getStats() {
    const uptime = Date.now() - this.startTime;
    return {
      uptime_ms: uptime,
      uptime_seconds: Math.floor(uptime / 1000),
      message_count: this.messageCount,
      error_count: this.errorCount,
      messages_per_second: this.messageCount / (uptime / 1000),
    };
  }

  /**
   * Log current transport statistics
   */
  logStats() {
    const stats = this.getStats();
    logger.info('Transport statistics', stats);
    return stats;
  }
}

/**
 * Default transport configuration for different environments
 */
export const defaultTransportConfigs = {
  development: {
    type: TransportType.STDIO,
    options: {
      // Development-specific options can go here
      debug: true,
    },
  },
  production: {
    type: TransportType.STDIO,
    options: {
      // Production-specific options
      debug: false,
    },
  },
  test: {
    type: TransportType.STDIO,
    options: {
      // Test-specific options
      debug: false,
    },
  },
} as const;