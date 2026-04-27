/**
 * Deno Edge Functions Error Handler
 * Wraps error handling for Supabase Edge Functions
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-auth',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export interface EdgeErrorResponse {
  error: string;
  code: string;
  timestamp: string;
}

// Error codes for edge functions
export const EdgeErrorCodes = {
  // 400 - Bad Request
  EMPTY_BODY: { status: 400, code: 'EMPTY_BODY', message: 'Corpo da requisição vazio' },
  INVALID_JSON: { status: 400, code: 'INVALID_JSON', message: 'JSON inválido no corpo' },
  MISSING_FIELD: { status: 400, code: 'MISSING_FIELD', message: (field: string) => `Campo obrigatório: ${field}` },
  INVALID_FIELD: { status: 400, code: 'INVALID_FIELD', message: (field: string) => `Campo inválido: ${field}` },

  // 401 - Unauthorized
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED', message: 'Não autorizado' },
  INVALID_TOKEN: { status: 401, code: 'INVALID_TOKEN', message: 'Token inválido' },

  // 403 - Forbidden
  FORBIDDEN: { status: 403, code: 'FORBIDDEN', message: 'Acesso negado' },

  // 404 - Not Found
  NOT_FOUND: { status: 404, code: 'NOT_FOUND', message: (resource: string) => `${resource} não encontrado` },

  // 405 - Method Not Allowed
  METHOD_NOT_ALLOWED: { status: 405, code: 'METHOD_NOT_ALLOWED', message: (method: string) => `Método ${method} não permitido` },

  // 422 - Unprocessable Entity
  VALIDATION_ERROR: { status: 422, code: 'VALIDATION_ERROR', message: 'Erro de validação' },
  INVALID_FORMAT: { status: 422, code: 'INVALID_FORMAT', message: (format: string) => `Formato inválido: ${format}` },

  // 429 - Too Many Requests
  RATE_LIMITED: { status: 429, code: 'RATE_LIMITED', message: 'Muitas requisições' },

  // 500 - Internal Server Error
  INTERNAL_ERROR: { status: 500, code: 'INTERNAL_ERROR', message: 'Erro interno' },
  DATABASE_ERROR: { status: 500, code: 'DATABASE_ERROR', message: 'Erro de banco de dados' },
  EXTERNAL_API_ERROR: { status: 502, code: 'EXTERNAL_API_ERROR', message: (service: string) => `Erro ao contatar ${service}` },
  CONFIGURATION_ERROR: { status: 502, code: 'CONFIGURATION_ERROR', message: (config: string) => `Configuração ausente: ${config}` },
};

export function sanitizeDenyError(error: any): string {
  const msg = error?.message || String(error);
  if (msg.includes('SUPABASE') || msg.includes('DATABASE')) {
    return 'Erro ao acessar banco de dados';
  }
  if (msg.includes('API_KEY') || msg.includes('SECRET')) {
    return 'Erro de configuração';
  }
  return msg;
}

export function validateRequiredFieldsDeno(body: any, requiredFields: string[]): string | null {
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return field;
    }
  }
  return null;
}

export function getEdgeErrorResponse(errorDef: any, detail?: string | object) {
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

/**
 * Parse JSON body for Edge Functions
 */
export async function parseJsonBodyDeno(req: Request): Promise<{ data?: any; error?: any }> {
  try {
    const text = await req.text();

    if (!text || text.trim() === '') {
      const err = getEdgeErrorResponse(EdgeErrorCodes.EMPTY_BODY);
      return { error: err };
    }

    try {
      const data = JSON.parse(text);
      return { data };
    } catch {
      const err = getEdgeErrorResponse(EdgeErrorCodes.INVALID_JSON);
      return { error: err };
    }
  } catch (error) {
    const err = getEdgeErrorResponse(EdgeErrorCodes.INVALID_JSON);
    return { error: err };
  }
}

/**
 * Create standardized error response for Deno
 */
export function denoErrorResponse(error: any, status = 500, includeStack = false) {
  const timestamp = new Date().toISOString();
  const statusCode = error?.status || status;
  
  let responseBody: any = {
    error: error?.error || sanitizeDenyError(error),
    code: error?.code || 'UNKNOWN_ERROR',
    timestamp,
  };

  if (includeStack && error?.stack) {
    responseBody.stack = error.stack;
  }

  return new Response(JSON.stringify(responseBody), {
    status: statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create standardized success response for Deno
 */
export function denoSuccessResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle OPTIONS request
 */
export function handleOptions() {
  return new Response('ok', { headers: corsHeaders });
}

/**
 * Wrapper for edge function handlers with error handling
 */
export function withEdgeErrorHandling(
  handler: (req: Request) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method === 'OPTIONS') {
        return handleOptions();
      }

      return await handler(req);
    } catch (error: any) {
      console.error('Edge Function Error:', error);
      return denoErrorResponse(
        {
          error: sanitizeDenyError(error),
          code: error?.code || 'INTERNAL_ERROR',
          status: error?.status || 500,
        },
        error?.status || 500
      );
    }
  };
}

/**
 * Validate that request body is not empty for POST
 */
export async function validatePostBodyDeno(req: Request): Promise<{ valid: boolean; error?: Response }> {
  if (req.method !== 'POST') {
    const err = getEdgeErrorResponse(EdgeErrorCodes.METHOD_NOT_ALLOWED, req.method);
    return {
      valid: false,
      error: denoErrorResponse(err, err.status),
    };
  }

  const text = await req.text();
  if (!text || text.trim() === '') {
    const err = getEdgeErrorResponse(EdgeErrorCodes.EMPTY_BODY);
    return {
      valid: false,
      error: denoErrorResponse(err, 400),
    };
  }

  return { valid: true };
}
