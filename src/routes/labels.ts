import { Router, Request, Response } from 'express';
import { TodoistService } from '../services/todoist.service';
import { appLogger } from '../utils/logger';

export function createLabelRoutes(todoistService: TodoistService): Router {
  const router = Router();

  // GET /api/labels - List all labels
  router.get('/', async (req: Request, res: Response) => {
    try {
      appLogger.info('Fetching labels');
      
      const labels = await todoistService.getLabels();
      
      appLogger.info('Labels fetched successfully', { count: labels.length });
      
      res.json({
        success: true,
        data: labels,
        count: labels.length
      });
    } catch (error) {
      appLogger.error('Failed to fetch labels', { error });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch labels'
      });
    }
  });

  return router;
}