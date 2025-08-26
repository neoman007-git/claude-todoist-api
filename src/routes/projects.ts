import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TodoistService } from '../services/todoist.service';
import { appLogger } from '../utils/logger';

// Validation schemas
const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  parent_id: z.string().optional(),
  color: z.string().optional(),
  is_favorite: z.boolean().optional()
});

export function createProjectRoutes(todoistService: TodoistService): Router {
  const router = Router();

  // GET /api/projects - List all projects
  router.get('/', async (req: Request, res: Response) => {
    try {
      appLogger.info('Fetching projects');
      
      const projects = await todoistService.getProjects();
      
      appLogger.info('Projects fetched successfully', { count: projects.length });
      
      res.json({
        success: true,
        data: projects,
        count: projects.length
      });
    } catch (error) {
      appLogger.error('Failed to fetch projects', { error });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch projects'
      });
    }
  });

  // POST /api/projects - Create new project
  router.post('/', async (req: Request, res: Response) => {
    try {
      const projectData = CreateProjectSchema.parse(req.body);
      
      appLogger.info('Creating project', { name: projectData.name });
      
      // Extract name and pass rest as options to match service signature
      const { name, ...options } = projectData;
      const project = await todoistService.createProject(name, options);
      
      appLogger.info('Project created successfully', { 
        id: project.id, 
        name: project.name 
      });
      
      res.status(201).json({
        success: true,
        data: project
      });
    } catch (error) {
      appLogger.error('Failed to create project', { error });
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project data',
          details: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create project'
      });
    }
  });

  return router;
}