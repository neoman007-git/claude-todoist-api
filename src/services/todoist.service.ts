import { z } from 'zod';
import { config } from '../utils/config';
import { appLogger } from '../utils/logger';

// CORRECTED SCHEMAS based on actual Todoist API response analysis
const TaskSchema = z.object({
  id: z.string(),
  content: z.string(),
  description: z.string(),
  is_completed: z.boolean(),
  labels: z.array(z.string()),
  order: z.number(),
  priority: z.number(),
  project_id: z.string(),
  section_id: z.string().nullable(),
  parent_id: z.string().nullable(),
  creator_id: z.string(),
  created_at: z.string(),
  assignee_id: z.string().nullable(),
  assigner_id: z.string().nullable(),
  comment_count: z.number(),
  url: z.string(),
  
  // CORRECTED: Due field with proper optional/missing field handling
  due: z.object({
    date: z.string(),                           // Always present
    string: z.string(),                         // Always present  
    lang: z.string(),                           // ADDED: Always present in API
    is_recurring: z.boolean(),                  // Always present
    datetime: z.string().optional(),            // FIXED: Sometimes missing entirely
    timezone: z.string().optional(),            // FIXED: Sometimes missing entirely
  }).nullable(),                                // Entire due can be null
  
  // ADDED: Fields present in API but missing from original schema
  duration: z.unknown().nullable(),             // Always null in your data, but present
  deadline: z.unknown().nullable(),             // Always null in your data, but present
});

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
  
  // ADDED: Field present in API but missing from original schema
  description: z.string(),                      // Always present (empty string if no description)
});

const LabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  order: z.number(),
  is_favorite: z.boolean(),
});

export type Task = z.infer<typeof TaskSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Label = z.infer<typeof LabelSchema>;

export interface CreateTaskOptions {
  content: string;
  description?: string;
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  order?: number;
  labels?: string[];
  priority?: number;
  due_string?: string;
  due_date?: string;
  due_datetime?: string;
  due_lang?: string;
  assignee_id?: string;
}

export interface CreateProjectOptions {
  parent_id?: string;
  color?: string;
  is_favorite?: boolean;
  view_style?: string;
}

export class TodoistService {
  private readonly apiToken: string;
  private readonly baseUrl = 'https://api.todoist.com/rest/v2';

  constructor() {
    // Use the correct config property name from interface
    this.apiToken = config.TODOIST_API_KEY;
    if (!this.apiToken) {
      throw new Error('Todoist API token is required. Check TODOIST_API_KEY in environment.');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      appLogger.error(`Todoist API error: ${response.status} ${response.statusText}`, {
        endpoint,
        error: errorText,
      });
      throw new Error(`Todoist API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async healthCheck(): Promise<{ connected: boolean; projectsCount?: number; tasksCount?: number }> {
    try {
      const [projects, tasks] = await Promise.all([
        this.getProjects(),
        this.getTasks()
      ]);
      
      return {
        connected: true,
        projectsCount: projects.length,
        tasksCount: tasks.length,
      };
    } catch (error) {
      appLogger.error('Todoist health check failed', error);
      return { connected: false };
    }
  }

  async getTasks(filter?: string | { project_id?: string; section_id?: string; label?: string; filter?: string; lang?: string; ids?: string[] }): Promise<Task[]> {
    try {
      let endpoint = '/tasks';
      const params = new URLSearchParams();

      if (typeof filter === 'string') {
        params.append('filter', filter);
      } else if (filter && typeof filter === 'object') {
        if (filter.project_id) params.append('project_id', filter.project_id);
        if (filter.section_id) params.append('section_id', filter.section_id);
        if (filter.label) params.append('label', filter.label);
        if (filter.filter) params.append('filter', filter.filter);
        if (filter.lang) params.append('lang', filter.lang);
        if (filter.ids) params.append('ids', filter.ids.join(','));
      }

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const data = await this.makeRequest(endpoint);
      
      // Validate the response data
      const validatedTasks = data.map((task: any, index: number) => {
        try {
          return TaskSchema.parse(task);
        } catch (error) {
          appLogger.error(`Task validation failed for task ${index}:`, {
            task,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw new Error(`Task validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      return validatedTasks;
    } catch (error) {
      appLogger.error('Failed to get tasks', error);
      throw error;
    }
  }

  async getTask(taskId: string): Promise<Task> {
    try {
      const data = await this.makeRequest(`/tasks/${taskId}`);
      return TaskSchema.parse(data);
    } catch (error) {
      appLogger.error(`Failed to get task ${taskId}`, error);
      throw error;
    }
  }

  async createTask(options: CreateTaskOptions): Promise<Task> {
    try {
      const data = await this.makeRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(options),
      });
      return TaskSchema.parse(data);
    } catch (error) {
      appLogger.error('Failed to create task', { options, error });
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<CreateTaskOptions>): Promise<Task> {
    try {
      const data = await this.makeRequest(`/tasks/${taskId}`, {
        method: 'POST',
        body: JSON.stringify(updates),
      });
      return TaskSchema.parse(data);
    } catch (error) {
      appLogger.error(`Failed to update task ${taskId}`, { updates, error });
      throw error;
    }
  }

  async closeTask(taskId: string): Promise<void> {
    try {
      await this.makeRequest(`/tasks/${taskId}/close`, {
        method: 'POST',
      });
      appLogger.info(`Task ${taskId} closed successfully`);
    } catch (error) {
      appLogger.error(`Failed to close task ${taskId}`, error);
      throw error;
    }
  }

  async reopenTask(taskId: string): Promise<void> {
    try {
      await this.makeRequest(`/tasks/${taskId}/reopen`, {
        method: 'POST',
      });
      appLogger.info(`Task ${taskId} reopened successfully`);
    } catch (error) {
      appLogger.error(`Failed to reopen task ${taskId}`, error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.makeRequest(`/tasks/${taskId}`, {
        method: 'DELETE',
      });
      appLogger.info(`Task ${taskId} deleted successfully`);
    } catch (error) {
      appLogger.error(`Failed to delete task ${taskId}`, error);
      throw error;
    }
  }

  async getProjects(): Promise<Project[]> {
    try {
      const data = await this.makeRequest('/projects');
      return data.map((project: any) => ProjectSchema.parse(project));
    } catch (error) {
      appLogger.error('Failed to get projects', error);
      throw error;
    }
  }

  async getProject(projectId: string): Promise<Project> {
    try {
      const data = await this.makeRequest(`/projects/${projectId}`);
      return ProjectSchema.parse(data);
    } catch (error) {
      appLogger.error(`Failed to get project ${projectId}`, error);
      throw error;
    }
  }

  async createProject(name: string, options: CreateProjectOptions = {}): Promise<Project> {
    try {
      const projectData = { name, ...options };
      const data = await this.makeRequest('/projects', {
        method: 'POST',
        body: JSON.stringify(projectData),
      });
      return ProjectSchema.parse(data);
    } catch (error) {
      appLogger.error('Failed to create project', { name, options, error });
      throw error;
    }
  }

  async updateProject(projectId: string, updates: Partial<CreateProjectOptions>): Promise<Project> {
    try {
      const data = await this.makeRequest(`/projects/${projectId}`, {
        method: 'POST',
        body: JSON.stringify(updates),
      });
      return ProjectSchema.parse(data);
    } catch (error) {
      appLogger.error(`Failed to update project ${projectId}`, { updates, error });
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      await this.makeRequest(`/projects/${projectId}`, {
        method: 'DELETE',
      });
      appLogger.info(`Project ${projectId} deleted successfully`);
    } catch (error) {
      appLogger.error(`Failed to delete project ${projectId}`, error);
      throw error;
    }
  }

  // Labels methods
  async getLabels(): Promise<Label[]> {
    try {
      const data = await this.makeRequest('/labels');
      return data.map((label: any) => LabelSchema.parse(label));
    } catch (error) {
      appLogger.error('Failed to get labels', error);
      throw error;
    }
  }

  async getLabel(labelId: string): Promise<Label> {
    try {
      const data = await this.makeRequest(`/labels/${labelId}`);
      return LabelSchema.parse(data);
    } catch (error) {
      appLogger.error(`Failed to get label ${labelId}`, error);
      throw error;
    }
  }
}

// Export singleton instance for use in routes
export const todoistService = new TodoistService();