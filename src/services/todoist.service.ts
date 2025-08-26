import { z } from 'zod';
import { config } from '../utils/config';
import { appLogger } from '../utils/logger';

/**
 * Zod schemas for Todoist API responses
 * These provide runtime type checking and validation
 */

// Task schema - represents a Todoist task
const TaskSchema = z.object({
  id: z.string(),
  content: z.string(),
  description: z.string().optional(),
  is_completed: z.boolean(),
  labels: z.array(z.string()),
  order: z.number(),
  priority: z.number().min(1).max(4), // 1 = lowest, 4 = highest
  project_id: z.string(),
  section_id: z.string().nullable(),
  parent_id: z.string().nullable(),
  url: z.string(),
  comment_count: z.number(),
  assignee_id: z.string().nullable(),
  assigner_id: z.string().nullable(),
  creator_id: z.string(),
  created_at: z.string(),
  due: z.object({
    date: z.string(),
    is_recurring: z.boolean(),
    datetime: z.string().nullable(),
    string: z.string(),
    timezone: z.string().nullable(),
  }).nullable(),
});

// Project schema - represents a Todoist project
const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  comment_count: z.number(),
  order: z.number(),
  color: z.string(),
  is_shared: z.boolean(),
  is_favorite: z.boolean(),
  is_inbox_project: z.boolean(),
  is_team_inbox: z.boolean(),
  view_style: z.string(),
  url: z.string(),
  parent_id: z.string().nullable(),
});

// Label schema - represents a Todoist label
const LabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  order: z.number(),
  is_favorite: z.boolean(),
});

// Export types for use in other files
export type Task = z.infer<typeof TaskSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Label = z.infer<typeof LabelSchema>;

/**
 * Input schemas for creating/updating tasks
 */
const CreateTaskSchema = z.object({
  content: z.string().min(1, 'Task content cannot be empty'),
  description: z.string().optional(),
  project_id: z.string().optional(),
  section_id: z.string().optional(),
  parent_id: z.string().optional(),
  order: z.number().optional(),
  labels: z.array(z.string()).optional(),
  priority: z.number().min(1).max(4).optional(),
  due_string: z.string().optional(), // e.g., "tomorrow at 9am", "every monday"
  due_date: z.string().optional(), // YYYY-MM-DD format
  due_datetime: z.string().optional(), // RFC 3339 format
  due_lang: z.string().optional(), // Language code for due_string
  assignee_id: z.string().optional(),
});

const UpdateTaskSchema = CreateTaskSchema.partial();

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

/**
 * Custom error classes for better error handling
 */
export class TodoistApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public response?: any
  ) {
    super(message);
    this.name = 'TodoistApiError';
  }
}

/**
 * TodoistService - Direct REST API client for Todoist
 * This service handles all interactions with the Todoist REST API
 */
export class TodoistService {
  private readonly baseUrl = 'https://api.todoist.com/rest/v2';
  private readonly headers: Record<string, string>;

  constructor() {
    this.headers = {
      'Authorization': `Bearer ${config.TODOIST_API_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make a request to the Todoist API
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    appLogger.debug(`Making request to: ${url}`, {
      method: options.method || 'GET',
      endpoint
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        appLogger.error(`API request failed: ${response.status} ${response.statusText}`, {
          endpoint,
          status: response.status,
          error: errorText
        });
        
        throw new TodoistApiError(
          `API request failed: ${response.statusText}`,
          response.status,
          response.status.toString(),
          errorText
        );
      }

      const data = await response.json();
      appLogger.debug(`API request successful`, { endpoint, responseSize: JSON.stringify(data).length });
      
      return data;
    } catch (error) {
      if (error instanceof TodoistApiError) {
        throw error;
      }
      
      appLogger.error(`Network error during API request`, {
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new TodoistApiError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        'NETWORK_ERROR',
        error
      );
    }
  }

  /**
   * Health check method for API status monitoring
   */
  async healthCheck(): Promise<{ connected: boolean; projects: number; tasks: number }> {
    try {
      appLogger.info('Testing Todoist API connectivity...');
      
      // Get basic info to test connection
      const [projects, tasks] = await Promise.all([
        this.getProjects(),
        this.getTasks()
      ]);

      const result = {
        connected: true,
        projects: projects.length,
        tasks: tasks.length
      };

      appLogger.info('Todoist API connectivity test successful', result);
      return result;
    } catch (error) {
      appLogger.error('Todoist API connectivity test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        connected: false,
        projects: 0,
        tasks: 0
      };
    }
  }

  /**
   * Get all tasks - supports both string filter and object options
   */
  async getTasks(options?: string | {
    project_id?: string;
    section_id?: string;
    label?: string;
    filter?: string;
    lang?: string;
    ids?: string[];
  }): Promise<Task[]> {
    let endpoint = '/tasks';
    
    if (typeof options === 'string') {
      // Simple filter string
      endpoint = `/tasks?filter=${encodeURIComponent(options)}`;
    } else if (options && typeof options === 'object') {
      // Build query parameters from object
      const params = new URLSearchParams();
      
      if (options.project_id) params.append('project_id', options.project_id);
      if (options.section_id) params.append('section_id', options.section_id);
      if (options.label) params.append('label', options.label);
      if (options.filter) params.append('filter', options.filter);
      if (options.lang) params.append('lang', options.lang);
      if (options.ids && options.ids.length > 0) {
        params.append('ids', options.ids.join(','));
      }
      
      const queryString = params.toString();
      if (queryString) {
        endpoint = `/tasks?${queryString}`;
      }
    }
    
    const tasks = await this.makeRequest<any[]>(endpoint);
    return tasks.map(task => TaskSchema.parse(task));
  }

  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<Task> {
    const task = await this.makeRequest<any>(`/tasks/${taskId}`);
    return TaskSchema.parse(task);
  }

  /**
   * Create a new task
   */
  async createTask(taskData: CreateTaskInput): Promise<Task> {
    const validatedData = CreateTaskSchema.parse(taskData);
    const task = await this.makeRequest<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(validatedData),
    });
    
    appLogger.info('Task created successfully', { 
      taskId: task.id, 
      content: task.content 
    });
    
    return TaskSchema.parse(task);
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task> {
    const validatedUpdates = UpdateTaskSchema.parse(updates);
    const task = await this.makeRequest<any>(`/tasks/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(validatedUpdates),
    });
    
    appLogger.info('Task updated successfully', { 
      taskId, 
      updates: Object.keys(validatedUpdates) 
    });
    
    return TaskSchema.parse(task);
  }

  /**
   * Complete a task (alias for closeTask)
   */
  async completeTask(taskId: string): Promise<void> {
    await this.closeTask(taskId);
  }

  /**
   * Close/complete a task
   */
  async closeTask(taskId: string): Promise<void> {
    await this.makeRequest(`/tasks/${taskId}/close`, {
      method: 'POST',
    });
    
    appLogger.info('Task closed/completed successfully', { taskId });
  }

  /**
   * Reopen a completed task
   */
  async reopenTask(taskId: string): Promise<void> {
    await this.makeRequest(`/tasks/${taskId}/reopen`, {
      method: 'POST',
    });
    
    appLogger.info('Task reopened successfully', { taskId });
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.makeRequest(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
    
    appLogger.info('Task deleted successfully', { taskId });
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    const projects = await this.makeRequest<any[]>('/projects');
    return projects.map(project => ProjectSchema.parse(project));
  }

  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string): Promise<Project> {
    const project = await this.makeRequest<any>(`/projects/${projectId}`);
    return ProjectSchema.parse(project);
  }

  /**
   * Create a new project - supports options object
   */
  async createProject(name: string, options?: {
    parent_id?: string;
    color?: string;
    is_favorite?: boolean;
  }): Promise<Project> {
    const projectData: any = { name };
    
    if (options) {
      if (options.parent_id) projectData.parent_id = options.parent_id;
      if (options.color) projectData.color = options.color;
      if (options.is_favorite !== undefined) projectData.is_favorite = options.is_favorite;
    }
    
    const project = await this.makeRequest<any>('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
    
    appLogger.info('Project created successfully', { 
      projectId: project.id, 
      name: project.name 
    });
    
    return ProjectSchema.parse(project);
  }

  /**
   * Get all labels
   */
  async getLabels(): Promise<Label[]> {
    const labels = await this.makeRequest<any[]>('/labels');
    return labels.map(label => LabelSchema.parse(label));
  }
}

// Export a singleton instance
export const todoistService = new TodoistService();