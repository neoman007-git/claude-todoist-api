// Global type definitions to ensure Node.js types are available

/// <reference types="node" />

// Ensure process is available globally
declare global {
  var process: NodeJS.Process;
}

// Express handler types for consistent typing across routes
export interface TypedRequest<T = {}> extends Express.Request {
  body: T;
}

export interface TypedResponse<T = {}> extends Express.Response {
  json(data: T): this;
}

// Error response type
export interface ErrorResponse {
  error: string;
  details?: string;
  timestamp: string;
  path: string;
}

// Success response wrapper
export interface SuccessResponse<T = {}> {
  success: true;
  data: T;
  timestamp: string;
}

export {};