import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { config } from '../utils/config.js';
import { createModuleLogger } from '../utils/logger.js';
import { todoistService, TodoistApiError, TodoistValidationError } from '../services/todoist.service.js';
import type { CreateTaskInput, UpdateTaskInput } from '../services/todoist.service.js';

const logger = createModuleLogger('mcp-server');

/**
 * Create and configure the MCP Server using the newer McpServer class
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: config.MCP_SERVER_NAME,
    version: config.MCP_SERVER_VERSION,
  });

  logger.info('Setting up MCP server tools...');

  // Register task management tools
  server.registerTool(
    'get_tasks',
    {
      title: 'Get Tasks',
      description: 'Retrieve tasks from Todoist. Can filter by project, label, or custom filter.',
      inputSchema: {
        project_id: z.string().optional(),
        section_id: z.string().optional(), 
        label: z.string().optional(),
        filter: z.string().optional(),
      },
    },
    async ({ project_id, section_id, label, filter }) => {
      logger.mcpEvent('get_tasks_called', { project_id, section_id, label, filter });
      
      try {
        const tasks = await todoistService.getTasks({
          project_id,
          section_id,
          label,
          filter,
        });

        logger.info(`Retrieved ${tasks.length} tasks from Todoist`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: tasks,
              count: tasks.length,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.errorWithContext(error as Error, 'get_tasks tool execution');
        
        if (error instanceof TodoistApiError) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Todoist API error: ${error.message}`,
                status: error.status,
              }, null, 2),
            }],
          };
        }
        
        throw error;
      }
    }
  );

  server.registerTool(
    'create_task',
    {
      title: 'Create Task',
      description: 'Create a new task in Todoist',
      inputSchema: {
        content: z.string().min(1).describe('The task content/title'),
        description: z.string().optional(),
        project_id: z.string().optional(),
        priority: z.number().min(1).max(4).optional(),
        due_string: z.string().optional(),
        labels: z.array(z.string()).optional(),
      },
    },
    async ({ content, description, project_id, priority, due_string, labels }) => {
      logger.mcpEvent('create_task_called', { content, project_id, priority });
      
      try {
        const taskData: CreateTaskInput = {
          content,
          description,
          project_id,
          priority,
          due_string,
          labels,
        };

        const task = await todoistService.createTask(taskData);

        logger.info(`Created task: ${task.content} (ID: ${task.id})`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Task "${task.content}" created successfully`,
              data: task,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.errorWithContext(error as Error, 'create_task tool execution');
        
        if (error instanceof TodoistApiError) {
          return {
            content: [{
              type: 'text', 
              text: JSON.stringify({
                success: false,
                error: `Failed to create task: ${error.message}`,
                status: error.status,
              }, null, 2),
            }],
          };
        }
        
        throw error;
      }
    }
  );

  server.registerTool(
    'update_task',
    {
      title: 'Update Task',
      description: 'Update an existing task in Todoist',
      inputSchema: {
        task_id: z.string().min(1).describe('The ID of the task to update'),
        content: z.string().optional(),
        description: z.string().optional(),
        priority: z.number().min(1).max(4).optional(),
        due_string: z.string().optional(),
        labels: z.array(z.string()).optional(),
      },
    },
    async ({ task_id, content, description, priority, due_string, labels }) => {
      logger.mcpEvent('update_task_called', { task_id, content, priority });
      
      try {
        const updateData: UpdateTaskInput = {
          content,
          description,
          priority,
          due_string,
          labels,
        };

        const task = await todoistService.updateTask(task_id, updateData);

        logger.info(`Updated task: ${task.content} (ID: ${task.id})`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Task "${task.content}" updated successfully`,
              data: task,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.errorWithContext(error as Error, 'update_task tool execution');
        
        if (error instanceof TodoistApiError) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Failed to update task: ${error.message}`,
                status: error.status,
              }, null, 2),
            }],
          };
        }
        
        throw error;
      }
    }
  );

  server.registerTool(
    'complete_task',
    {
      title: 'Complete Task',
      description: 'Mark a task as completed',
      inputSchema: {
        task_id: z.string().min(1).describe('The ID of the task to complete'),
      },
    },
    async ({ task_id }) => {
      logger.mcpEvent('complete_task_called', { task_id });
      
      try {
        await todoistService.closeTask(task_id);

        logger.info(`Completed task: ${task_id}`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Task ${task_id} marked as completed`,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.errorWithContext(error as Error, 'complete_task tool execution');
        
        if (error instanceof TodoistApiError) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Failed to complete task: ${error.message}`,
                status: error.status,
              }, null, 2),
            }],
          };
        }
        
        throw error;
      }
    }
  );

  server.registerTool(
    'reopen_task',
    {
      title: 'Reopen Task',
      description: 'Reopen a completed task',
      inputSchema: {
        task_id: z.string().min(1).describe('The ID of the task to reopen'),
      },
    },
    async ({ task_id }) => {
      logger.mcpEvent('reopen_task_called', { task_id });
      
      try {
        await todoistService.reopenTask(task_id);

        logger.info(`Reopened task: ${task_id}`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Task ${task_id} reopened`,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.errorWithContext(error as Error, 'reopen_task tool execution');
        
        if (error instanceof TodoistApiError) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Failed to reopen task: ${error.message}`,
                status: error.status,
              }, null, 2),
            }],
          };
        }
        
        throw error;
      }
    }
  );

  server.registerTool(
    'delete_task',
    {
      title: 'Delete Task',
      description: 'Delete a task from Todoist',
      inputSchema: {
        task_id: z.string().min(1).describe('The ID of the task to delete'),
      },
    },
    async ({ task_id }) => {
      logger.mcpEvent('delete_task_called', { task_id });
      
      try {
        await todoistService.deleteTask(task_id);

        logger.info(`Deleted task: ${task_id}`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Task ${task_id} deleted`,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.errorWithContext(error as Error, 'delete_task tool execution');
        
        if (error instanceof TodoistApiError) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Failed to delete task: ${error.message}`,
                status: error.status,
              }, null, 2),
            }],
          };
        }
        
        throw error;
      }
    }
  );

  server.registerTool(
    'get_projects',
    {
      title: 'Get Projects',
      description: 'Retrieve all projects from Todoist',
      inputSchema: {},
    },
    async () => {
      logger.mcpEvent('get_projects_called');
      
      try {
        const projects = await todoistService.getProjects();

        logger.info(`Retrieved ${projects.length} projects from Todoist`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: projects,
              count: projects.length,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.errorWithContext(error as Error, 'get_projects tool execution');
        
        if (error instanceof TodoistApiError) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Failed to get projects: ${error.message}`,
                status: error.status,
              }, null, 2),
            }],
          };
        }
        
        throw error;
      }
    }
  );

  server.registerTool(
    'create_project',
    {
      title: 'Create Project',
      description: 'Create a new project in Todoist',
      inputSchema: {
        name: z.string().min(1).describe('The project name'),
        color: z.string().optional(),
        parent_id: z.string().optional(),
        is_favorite: z.boolean().optional(),
      },
    },
    async ({ name, color, parent_id, is_favorite }) => {
      logger.mcpEvent('create_project_called', { name, color, parent_id });
      
      try {
        const project = await todoistService.createProject(name, {
          color,
          parent_id,
          is_favorite,
        });

        logger.info(`Created project: ${project.name} (ID: ${project.id})`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Project "${project.name}" created successfully`,
              data: project,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.errorWithContext(error as Error, 'create_project tool execution');
        
        if (error instanceof TodoistApiError) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Failed to create project: ${error.message}`,
                status: error.status,
              }, null, 2),
            }],
          };
        }
        
        throw error;
      }
    }
  );

  server.registerTool(
    'get_labels',
    {
      title: 'Get Labels',
      description: 'Retrieve all labels from Todoist',
      inputSchema: {},
    },
    async () => {
      logger.mcpEvent('get_labels_called');
      
      try {
        const labels = await todoistService.getLabels();

        logger.info(`Retrieved ${labels.length} labels from Todoist`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: labels,
              count: labels.length,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.errorWithContext(error as Error, 'get_labels tool execution');
        
        if (error instanceof TodoistApiError) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Failed to get labels: ${error.message}`,
                status: error.status,
              }, null, 2),
            }],
          };
        }
        
        throw error;
      }
    }
  );

  server.registerTool(
    'health_check',
    {
      title: 'Health Check',
      description: 'Check if the Todoist service is healthy and accessible',
      inputSchema: {},
    },
    async () => {
      logger.mcpEvent('health_check_called');
      
      try {
        const isHealthy = await todoistService.healthCheck();

        logger.info(`Health check result: ${isHealthy}`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              healthy: isHealthy,
              message: isHealthy ? 'Todoist service is healthy' : 'Todoist service is not responding',
              timestamp: new Date().toISOString(),
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.errorWithContext(error as Error, 'health_check tool execution');
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              healthy: false,
              message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: new Date().toISOString(),
            }, null, 2),
          }],
        };
      }
    }
  );

  logger.info('MCP server tools registered successfully');
  
  return server;
}