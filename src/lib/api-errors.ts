/**
 * Standardized API Error Handler
 * Provides consistent error responses across all API endpoints
 */

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: string;
  timestamp: string;
}

export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Common API Errors
export const ErrorCodes = {
  // 400 - Bad Request
  EMPTY_BODY: { status: 400, code: 'EMPTY_BODY', message: 'Corpo da requisição vazio' },
  INVALID_JSON: { status: 400, code: 'INVALID_JSON', message: 'JSON inválido no corpo da requisição' },
  MISSING_FIELD: { status: 400, code: 'MISSING_FIELD', message: (field: string) => `Campo obrigatório faltando: ${field}` },
  INVALID_FIELD: { status: 400, code: 'INVALID_FIELD', message: (field: string) => `Campo inválido: ${field}` },
  FILE_TOO_LARGE: { status: 413, code: 'FILE_TOO_LARGE', message: (limit: string) => `Arquivo muito grande. Máximo: ${limit}` },
  INVALID_CONTENT_TYPE: { status: 400, code: 'INVALID_CONTENT_TYPE', message: (types: string) => `Tipo de arquivo não permitido. Aceitos: ${types}` },

  // 401 - Unauthorized
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED', message: 'Sessão expirada ou não autorizado' },
  INVALID_TOKEN: { status: 401, code: 'INVALID_TOKEN', message: 'Token inválido ou expirado' },
  MISSING_AUTH: { status: 401, code: 'MISSING_AUTH', message: 'Autenticação obrigatória' },

  // 403 - Forbidden
  FORBIDDEN: { status: 403, code: 'FORBIDDEN', message: 'Acesso negado' },

  // 404 - Not Found
  NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: (resource: string) => `${resource} não encontrado` },

  // 405 - Method Not Allowed
  METHOD_NOT_ALLOWED: { status: 405, code: 'METHOD_NOT_ALLOWED', message: (method: string) => `Método ${method} não permitido` },

  // 422 - Unprocessable Entity
  VALIDATION_ERROR: { status: 422, code: 'VALIDATION_ERROR', message: 'Erro na validação de dados' },
  INVALID_FORMAT: { status: 422, code: 'INVALID_FORMAT', message: (format: string) => `Formato inválido: ${format}` },

  // 429 - Too Many Requests
  RATE_LIMITED: { status: 429, code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente mais tarde.' },

  // 500 - Internal Server Error
  INTERNAL_ERROR: { status: 500, code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
  DATABASE_ERROR: { status: 500, code: 'DATABASE_ERROR', message: 'Erro ao acessar banco de dados' },
  EXTERNAL_API_ERROR: { status: 502, code: 'EXTERNAL_API_ERROR', message: (service: string) => `Erro ao contatar ${service}` },
  CONFIGURATION_ERROR: { status: 502, code: 'CONFIGURATION_ERROR', message: (config: string) => `Configuração ausente: ${config}` },
};

export function validateRequiredFields(body: any, requiredFields: string[]): string | null {
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return field;
    }
  }
  return null;
}

export function sanitizeErrorMessage(error: any): string {
  // Don't expose sensitive internal details
  if (error?.message?.includes('SUPABASE') || error?.message?.includes('DATABASE')) {
    return 'Erro ao acessar banco de dados';
  }
  if (error?.message?.includes('API_KEY') || error?.message?.includes('SECRET')) {
    return 'Erro de configuração do servidor';
  }
  return error?.message || 'Erro desconhecido';
}

export function createErrorResponse(
  error: ApiError | Error | string,
  fallbackStatus = 500
): ApiErrorResponse & { status: number } {
  const timestamp = new Date().toISOString();

  if (error instanceof ApiError) {
    return {
      error: error.message,
      code: error.code,
      status: error.statusCode,
      timestamp,
    };
  }

  if (error instanceof Error) {
    return {
      error: sanitizeErrorMessage(error),
      code: 'UNKNOWN_ERROR',
      status: fallbackStatus,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp,
    };
  }

  return {
    error: String(error),
    code: 'UNKNOWN_ERROR',
    status: fallbackStatus,
    timestamp,
  };
}

export function getErrorResponse(errorDef: any, detail?: string | object) {
  const message = typeof errorDef.message === 'function' 
    ? errorDef.message(detail) 
    : errorDef.message;

  return {
    error: message,
    code: errorDef.code,
    status: errorDef.status,
    ...(detail && typeof detail === 'object' && { details: detail }),
  };
}
