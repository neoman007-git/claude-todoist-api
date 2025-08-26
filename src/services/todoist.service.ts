import { z } from 'zod';
import { config } from '../utils/config.js';
import { createModuleLogger } from '../utils/logger.js';

const logger = createModuleLogger('todoist-service');

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
    datetime: z.string().nullable().optional(), // Can be missing or null
    string: z.string(),
    timezone: z.string().nullable().optional(), // Can be missing or null
    lang: z.string().optional(), // This field can also be missing
  }).nullable(),
  duration: z.any().nullable().optional(), // Duration can be present in some responses
  deadline: z.any().nullable().optional(), // Deadline can be present in some responses
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

export class TodoistValidationError extends Error {
  constructor(message: string, public errors: z.ZodError) {
    super(message);
    this.name = 'TodoistValidationError';
  }
}

/**
 * Todoist API Service
 * Handles all interactions with the Todoist REST API
 */
export class TodoistService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.todoist.com/rest/v2';
  private readonly headers: HeadersInit;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.TODOIST_API_KEY;
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Generic API request method with error handling and logging
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    schema?: z.ZodSchema<T>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();

    try {
      logger.debug(`Making request to ${options.method || 'GET'} ${endpoint}`);

      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      const duration = Date.now() - startTime;
      const status = response.status;

      // Log the API call
      logger.todoistApi(
        options.method || 'GET',
        endpoint,
        status,
        { duration_ms: duration }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new TodoistApiError(
          `Todoist API error: ${response.statusText}`,
          status,
          errorData.error_code,
          errorData
        );
      }

      const data = await response.json();

      // Validate response if schema provided
      if (schema) {
        try {
          return schema.parse(data);
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.error('Response validation failed', {
              endpoint,
              errors: error.errors.slice(0, 5), // Log only first 5 errors to avoid spam
              total_errors: error.errors.length,
              sample_response: Array.isArray(data) ? data.slice(0, 2) : data
            });
            
            // Log a warning but don't fail - return the raw data
            logger.warn(`Schema validation failed for ${endpoint}, using raw response`);
            return data as T;
          }
          throw error;
        }
      }

      return data as T;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.errorWithContext(
        error as Error,
        `Todoist API request to ${endpoint}`,
        { duration_ms: duration, endpoint, method: options.method || 'GET' }
      );
      throw error;
    }
  }

  /**
   * Task Management Methods
   */

  async getTasks(params?: {
    project_id?: string;
    section_id?: string;
    label?: string;
    filter?: string;
    lang?: string;
    ids?: string[];
  }): Promise<Task[]> {
    const searchParams = new URLSearchParams();
    
    if (params?.project_id) searchParams.set('project_id', params.project_id);
    if (params?.section_id) searchParams.set('section_id', params.section_id);
    if (params?.label) searchParams.set('label', params.label);
    if (params?.filter) searchParams.set('filter', params.filter);
    if (params?.lang) searchParams.set('lang', params.lang);
    if (params?.ids) searchParams.set('ids', params.ids.join(','));

    const query = searchParams.toString();
    const endpoint = `/tasks${query ? `?${query}` : ''}`;

    return this.makeRequest(endpoint, {}, z.array(TaskSchema));
  }

  async getTask(taskId: string): Promise<Task> {
    return this.makeRequest(`/tasks/${taskId}`, {}, TaskSchema);
  }

  async createTask(task: CreateTaskInput): Promise<Task> {
    // Validate input
    const validatedTask = CreateTaskSchema.parse(task);

    return this.makeRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify(validatedTask),
    }, TaskSchema);
  }

  async updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task> {
    // Validate input
    const validatedUpdates = UpdateTaskSchema.parse(updates);

    return this.makeRequest(`/tasks/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(validatedUpdates),
    }, TaskSchema);
  }

  async closeTask(taskId: string): Promise<boolean> {
    await this.makeRequest(`/tasks/${taskId}/close`, { method: 'POST' });
    return true;
  }

  async reopenTask(taskId: string): Promise<boolean> {
    await this.makeRequest(`/tasks/${taskId}/reopen`, { method: 'POST' });
    return true;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    await this.makeRequest(`/tasks/${taskId}`, { method: 'DELETE' });
    return true;
  }

  /**
   * Project Management Methods
   */

  async getProjects(): Promise<Project[]> {
    return this.makeRequest('/projects', {}, z.array(ProjectSchema));
  }

  async getProject(projectId: string): Promise<Project> {
    return this.makeRequest(`/projects/${projectId}`, {}, ProjectSchema);
  }

  async createProject(name: string, options?: {
    parent_id?: string;
    color?: string;
    is_favorite?: boolean;
  }): Promise<Project> {
    return this.makeRequest('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, ...options }),
    }, ProjectSchema);
  }

  async updateProject(projectId: string, updates: {
    name?: string;
    color?: string;
    is_favorite?: boolean;
  }): Promise<Project> {
    return this.makeRequest(`/projects/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(updates),
    }, ProjectSchema);
  }

  async deleteProject(projectId: string): Promise<boolean> {
    await this.makeRequest(`/projects/${projectId}`, { method: 'DELETE' });
    return true;
  }

  /**
   * Label Management Methods
   */

  async getLabels(): Promise<Label[]> {
    return this.makeRequest('/labels', {}, z.array(LabelSchema));
  }

  async getLabel(labelId: string): Promise<Label> {
    return this.makeRequest(`/labels/${labelId}`, {}, LabelSchema);
  }

  async createLabel(name: string, options?: {
    order?: number;
    color?: string;
    is_favorite?: boolean;
  }): Promise<Label> {
    return this.makeRequest('/labels', {
      method: 'POST',
      body: JSON.stringify({ name, ...options }),
    }, LabelSchema);
  }

  /**
   * Utility Methods
   */

  async healthCheck(): Promise<boolean> {
    try {
      await this.getProjects();
      logger.info('Todoist service health check passed');
      return true;
    } catch (error) {
      logger.errorWithContext(error as Error, 'Todoist service health check');
      return false;
    }
  }

  async getAccountInfo(): Promise<{ is_premium: boolean; projects_count: number; tasks_count: number }> {
    try {
      const [projects, tasks] = await Promise.all([
        this.getProjects(),
        this.getTasks()
      ]);

      return {
        is_premium: true, // We'd need to call a different endpoint for this
        projects_count: projects.length,
        tasks_count: tasks.length,
      };
    } catch (error) {
      logger.errorWithContext(error as Error, 'Getting account info');
      throw error;
    }
  }
}

// Export a default instance
export const todoistService = new TodoistService();