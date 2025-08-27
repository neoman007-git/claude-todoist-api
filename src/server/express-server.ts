import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../utils/config';
import { appLogger } from '../utils/logger';
import { todoistService } from '../services/todoist.service';

// Import route handlers
import { createTaskRoutes } from '../routes/tasks';
import { createProjectRoutes } from '../routes/projects';
import { createLabelRoutes } from '../routes/labels';
import { createHealthRoutes } from '../routes/health';

// Type definitions for consistent error handling
interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
  details?: string;
  timestamp: string;
  path: string;
}

/**
 * Create Express application with all middleware and routes
 */
export async function createExpressServer(): Promise<Application> {
  const app: Application = express();

  // Trust proxy for accurate IP addresses when behind load balancer
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration - UPDATED WITH CORRECT CLAUDE DOMAINS
  app.use(cors({
    origin: config.NODE_ENV === 'production' ? [
      'https://claude.ai',
      'https://claude.anthropic.com',
      'https://www.claudeusercontent.com',  // Analysis tool domain
      'https://claudeusercontent.com'       // Alternative without www
    ] : true, // Allow all in development
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      appLogger.info('HTTP Request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    });
    
    next();
  });

  // Root endpoint - API documentation
  app.get('/', (req: Request, res: Response): void => {
    res.json({
      name: config.MCP_SERVER_NAME,
      version: config.MCP_SERVER_VERSION,
      description: 'REST API server enabling Claude AI to manage Todoist tasks, projects, and labels',
      environment: config.NODE_ENV,
      endpoints: {
        health: {
          'GET /health': 'Comprehensive health check with Todoist connectivity',
          'GET /health/simple': 'Simple health check for load balancers',
          'GET /health/ready': 'Readiness probe for orchestrators'
        },
        tasks: {
          'GET /api/tasks': 'List tasks with optional filtering',
          'POST /api/tasks': 'Create a new task',
          'PATCH /api/tasks/:id': 'Update an existing task',
          'POST /api/tasks/:id/complete': 'Mark task as completed',
          'POST /api/tasks/:id/reopen': 'Reopen a completed task',
          'DELETE /api/tasks/:id': 'Delete a task'
        },
        projects: {
          'GET /api/projects': 'List all projects',
          'POST /api/projects': 'Create a new project'
        },
        labels: {
          'GET /api/labels': 'List all labels'
        }
      },
      documentation: 'https://github.com/neoman007-git/claude-todoist-api'
    });
  });

  // API routes - pass todoistService instance to each route creator
  app.use('/health', createHealthRoutes(todoistService));
  app.use('/api/tasks', createTaskRoutes(todoistService));
  app.use('/api/projects', createProjectRoutes(todoistService));
  app.use('/api/labels', createLabelRoutes(todoistService));

  // 404 handler
  app.use((req: Request, res: Response): void => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
      path: req.path
    } satisfies ErrorResponse);
  });

  // Global error handler
  app.use((error: ApiError, req: Request, res: Response, next: NextFunction): void => {
    // Log the error
    appLogger.error('Express error handler', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      statusCode: error.statusCode
    });

    // Determine status code
    const statusCode = error.statusCode || 500;
    
    // Don't expose internal errors in production
    const message = config.NODE_ENV === 'production' && statusCode >= 500
      ? 'Internal Server Error'
      : error.message;

    const errorResponse: ErrorResponse = {
      error: message,
      timestamp: new Date().toISOString(),
      path: req.path
    };

    // Add details in development
    if (config.NODE_ENV === 'development') {
      errorResponse.details = error.stack;
    }

    res.status(statusCode).json(errorResponse);
  });

  // Initialize services and verify connectivity
  try {
    appLogger.info('Initializing Todoist service...');
    const healthStatus = await todoistService.healthCheck();
    
    if (!healthStatus) {
      appLogger.warn('Todoist service health check failed during startup');
      // Continue anyway - health endpoints will show the issue
    } else {
      appLogger.info('Todoist service initialized successfully');
    }
  } catch (error) {
    appLogger.error('Failed to initialize Todoist service', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Continue anyway - health endpoints will show the issue
  }

  return app;
}

// Graceful shutdown handler
export function setupGracefulShutdown(server: any): void {
  const shutdown = (signal: string): void => {
    appLogger.info(`Received ${signal}, shutting down gracefully`);
    
    server.close(() => {
      appLogger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      appLogger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}