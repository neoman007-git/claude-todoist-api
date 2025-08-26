import { Router, Request, Response } from 'express';
import { TodoistService } from '../services/todoist.service';
import { appLogger } from '../utils/logger';
import { config } from '../utils/config';

export function createHealthRoutes(todoistService: TodoistService): Router {
  const router = Router();

  // GET /health - Comprehensive health check
  router.get('/', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      appLogger.info('Health check requested');
      
      // Basic server health
      const serverHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.NODE_ENV,
        version: '1.0.0'
      };

      // Test Todoist API connection
      let todoistHealth;
      try {
        const [projects, tasks] = await Promise.all([
          todoistService.getProjects(),
          todoistService.getTasks({ filter: 'today | overdue' })
        ]);

        todoistHealth = {
          status: 'connected',
          projects_count: projects.length,
          tasks_count: tasks.length,
          response_time_ms: Date.now() - startTime
        };

        appLogger.info('Health check passed', { 
          server: serverHealth, 
          todoist: todoistHealth 
        });

      } catch (todoistError) {
        todoistHealth = {
          status: 'disconnected',
          error: todoistError instanceof Error ? todoistError.message : 'Unknown error',
          response_time_ms: Date.now() - startTime
        };

        appLogger.warn('Todoist health check failed', { error: todoistError });
      }

      // Overall health determination
      const overallStatus = todoistHealth.status === 'connected' ? 'healthy' : 'degraded';
      const statusCode = overallStatus === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        status: overallStatus,
        timestamp: serverHealth.timestamp,
        checks: {
          server: serverHealth,
          todoist: todoistHealth
        },
        response_time_ms: Date.now() - startTime
      });

    } catch (error) {
      appLogger.error('Health check failed', { error });
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: Date.now() - startTime
      });
    }
  });

  // GET /health/simple - Simple health check for load balancers
  router.get('/simple', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // GET /health/ready - Readiness probe for orchestration
  router.get('/ready', async (req: Request, res: Response) => {
    try {
      // Quick Todoist connection test
      await todoistService.getProjects();
      
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}