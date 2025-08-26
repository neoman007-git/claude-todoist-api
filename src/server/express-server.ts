import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../utils/config';
import { appLogger } from '../utils/logger';
import { TodoistService } from '../services/todoist.service';

// Import route handlers
import { createTaskRoutes } from '../routes/tasks';
import { createProjectRoutes } from '../routes/projects';
import { createLabelRoutes } from '../routes/labels';
import { createHealthRoutes } from '../routes/health';

export class ExpressServer {
  private app: express.Application;
  private todoistService: TodoistService;

  constructor() {
    this.app = express();
    this.todoistService = new TodoistService(config.TODOIST_API_KEY);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration - Allow Claude API and local development
    this.app.use(cors({
      origin: [
        'https://claude.ai',
        'https://api.anthropic.com',
        'http://localhost:3000',
        'http://localhost:8000'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      appLogger.info('HTTP Request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api/tasks', createTaskRoutes(this.todoistService));
    this.app.use('/api/projects', createProjectRoutes(this.todoistService));
    this.app.use('/api/labels', createLabelRoutes(this.todoistService));
    this.app.use('/health', createHealthRoutes(this.todoistService));

    // Root endpoint with API documentation
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Claude Todoist API',
        version: '1.0.0',
        description: 'REST API for Claude AI to manage Todoist tasks and projects',
        endpoints: {
          health: '/health',
          tasks: {
            list: 'GET /api/tasks',
            create: 'POST /api/tasks',
            update: 'PATCH /api/tasks/:id',
            complete: 'POST /api/tasks/:id/complete',
            reopen: 'POST /api/tasks/:id/reopen',
            delete: 'DELETE /api/tasks/:id'
          },
          projects: {
            list: 'GET /api/projects',
            create: 'POST /api/projects'
          },
          labels: 'GET /api/labels'
        },
        documentation: 'https://github.com/neoman007-git/claude-todoist-api'
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        availableEndpoints: [
          'GET /',
          'GET /health',
          'GET /api/tasks',
          'POST /api/tasks',
          'GET /api/projects',
          'POST /api/projects'
        ]
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      appLogger.error('Express Error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });

      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal Server Error';

      res.status(status).json({
        error: status >= 500 ? 'Internal Server Error' : message,
        ...(config.NODE_ENV === 'development' && { 
          details: err.message,
          stack: err.stack 
        })
      });
    });
  }

  public async start(): Promise<void> {
    try {
      // Perform health checks before starting
      appLogger.info('🏥 Performing startup health checks...');
      
      // Test Todoist connection
      const projects = await this.todoistService.getProjects();
      const tasks = await this.todoistService.getTasks();
      
      appLogger.info('✅ Todoist API connection verified', {
        projects_count: projects.length,
        tasks_count: tasks.length
      });

      // Start HTTP server
      const port = config.PORT || 3000;
      
      this.app.listen(port, () => {
        appLogger.info('🚀 Claude Todoist API Server started', {
          port,
          environment: config.NODE_ENV,
          endpoints: {
            root: `http://localhost:${port}/`,
            health: `http://localhost:${port}/health`,
            tasks: `http://localhost:${port}/api/tasks`,
            projects: `http://localhost:${port}/api/projects`
          }
        });

        appLogger.info('🧰 Available API endpoints:', {
          tasks: [
            'GET /api/tasks - List tasks',
            'POST /api/tasks - Create task', 
            'PATCH /api/tasks/:id - Update task',
            'POST /api/tasks/:id/complete - Complete task',
            'POST /api/tasks/:id/reopen - Reopen task',
            'DELETE /api/tasks/:id - Delete task'
          ],
          projects: [
            'GET /api/projects - List projects',
            'POST /api/projects - Create project'
          ],
          other: [
            'GET /api/labels - List labels',
            'GET /health - Health check',
            'GET / - API documentation'
          ]
        });
      });

    } catch (error) {
      appLogger.error('❌ Failed to start server', { error });
      process.exit(1);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }
}