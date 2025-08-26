import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TodoistService } from '../services/todoist.service';
import { appLogger } from '../utils/logger';

// Validation schemas
const CreateTaskSchema = z.object({
  content: z.string().min(1, "Task content is required"),
  description: z.string().optional(),
  project_id: z.string().optional(),
  section_id: z.string().optional(),
  parent_id: z.string().optional(),
  order: z.number().optional(),
  labels: z.array(z.string()).optional(),
  priority: z.number().min(1).max(4).optional(),
  due_string: z.string().optional(),
  due_date: z.string().optional(),
  due_datetime: z.string().optional(),
  due_lang: z.string().optional(),
  assignee_id: z.string().optional()
});

const UpdateTaskSchema = z.object({
  content: z.string().optional(),
  description: z.string().optional(),
  labels: z.array(z.string()).optional(),
  priority: z.number().min(1).max(4).optional(),
  due_string: z.string().optional(),
  due_date: z.string().optional(),
  due_datetime: z.string().optional(),
  due_lang: z.string().optional(),
  assignee_id: z.string().optional()
});

const GetTasksQuerySchema = z.object({
  project_id: z.string().optional(),
  section_id: z.string().optional(),
  label: z.string().optional(),
  filter: z.string().optional(),
  lang: z.string().optional(),
  ids: z.string().transform(str => str.split(',').map(id => id.trim())).optional()
});

export function createTaskRoutes(todoistService: TodoistService): Router {
  const router = Router();

  // GET /api/tasks - List tasks with optional filtering
  router.get('/', async (req: Request, res: Response) => {
    try {
      const query = GetTasksQuerySchema.parse(req.query);
      
      appLogger.info('Fetching tasks', { query });
      
      const tasks = await todoistService.getTasks({
        project_id: query.project_id,
        section_id: query.section_id,
        label: query.label,
        filter: query.filter,
        lang: query.lang,
        ids: query.ids
      });

      appLogger.info('Tasks fetched successfully', { count: tasks.length });
      
      res.json({
        success: true,
        data: tasks,
        count: tasks.length
      });
    } catch (error) {
      appLogger.error('Failed to fetch tasks', { error });
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tasks'
      });
    }
  });

  // POST /api/tasks - Create new task
  router.post('/', async (req: Request, res: Response) => {
    try {
      const taskData = CreateTaskSchema.parse(req.body);
      
      appLogger.info('Creating task', { content: taskData.content });
      
      const task = await todoistService.createTask(taskData);
      
      appLogger.info('Task created successfully', { 
        id: task.id, 
        content: task.content 
      });
      
      res.status(201).json({
        success: true,
        data: task
      });
    } catch (error) {
      appLogger.error('Failed to create task', { error });
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid task data',
          details: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create task'
      });
    }
  });

  // PATCH /api/tasks/:id - Update existing task
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id;
      const updateData = UpdateTaskSchema.parse(req.body);
      
      appLogger.info('Updating task', { id: taskId, updates: Object.keys(updateData) });
      
      const task = await todoistService.updateTask(taskId, updateData);
      
      appLogger.info('Task updated successfully', { 
        id: task.id, 
        content: task.content 
      });
      
      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      appLogger.error('Failed to update task', { error, taskId: req.params.id });
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid update data',
          details: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update task'
      });
    }
  });

  // POST /api/tasks/:id/complete - Mark task as completed
  router.post('/:id/complete', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id;
      
      appLogger.info('Completing task', { id: taskId });
      
      const result = await todoistService.closeTask(taskId);
      
      appLogger.info('Task completed successfully', { id: taskId });
      
      res.json({
        success: true,
        message: 'Task completed successfully',
        completed: result  // Change from "data: result" to "completed: result"
      });
    } catch (error) {
      appLogger.error('Failed to complete task', { error, taskId: req.params.id });
      
      res.status(500).json({
        success: false,
        error: 'Failed to complete task'
      });
    }
  });

  // POST /api/tasks/:id/reopen - Reopen completed task
  router.post('/:id/reopen', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id;
      
      appLogger.info('Reopening task', { id: taskId });
      
      const result = await todoistService.reopenTask(taskId);
      
      appLogger.info('Task reopened successfully', { id: taskId });
      
      res.json({
        success: true,
        message: 'Task reopened successfully',
        data: result
      });
    } catch (error) {
      appLogger.error('Failed to reopen task', { error, taskId: req.params.id });
      
      res.status(500).json({
        success: false,
        error: 'Failed to reopen task'
      });
    }
  });

  // DELETE /api/tasks/:id - Delete task
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id;
      
      appLogger.info('Deleting task', { id: taskId });
      
      const result = await todoistService.deleteTask(taskId);
      
      appLogger.info('Task deleted successfully', { id: taskId });
      
      res.json({
        success: true,
        message: 'Task deleted successfully',
        data: result
      });
    } catch (error) {
      appLogger.error('Failed to delete task', { error, taskId: req.params.id });
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete task'
      });
    }
  });

  return router;
}