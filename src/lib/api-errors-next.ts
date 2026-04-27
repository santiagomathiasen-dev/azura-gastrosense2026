/**
 * Next.js API Error Handler
 * Wraps error handling for Next.js route handlers
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  ErrorCodes,
  createErrorResponse,
  getErrorResponse,
  validateRequiredFields,
  sanitizeErrorMessage,
} from './api-errors';

export { ApiError, ErrorCodes, validateRequiredFields, getErrorResponse };

/**
 * Parse JSON body with error handling
 */
export async function parseJsonBody(req: NextRequest): Promise<{ data?: any; error?: any }> {
  try {
    // Validate content-type
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        error: getErrorResponse(ErrorCodes.INVALID_CONTENT_TYPE, 'application/json'),
      };
    }

    const text = await req.text();
    
    // Check for empty body
    if (!text || text.trim() === '') {
      return {
        error: getErrorResponse(ErrorCodes.EMPTY_BODY),
      };
    }

    try {
      const data = JSON.parse(text);
      return { data };
    } catch {
      return {
        error: getErrorResponse(ErrorCodes.INVALID_JSON),
      };
    }
  } catch (error) {
    return {
      error: getErrorResponse(ErrorCodes.INVALID_JSON),
    };
  }
}

/**
 * Parse FormData with error handling
 */
export async function parseFormData(req: NextRequest): Promise<{ data?: FormData; error?: any }> {
  try {
    const text = await req.text();
    if (!text || text.trim() === '') {
      return {
        error: getErrorResponse(ErrorCodes.EMPTY_BODY),
      };
    }

    // Re-create FormData from body
    const formData = new FormData();
    const parts = text.split('--');
    
    // For simplicity, we'll use the built-in parser
    // but catch if it fails
    return { data: await req.formData() };
  } catch (error) {
    return {
      error: {
        error: 'Falha ao processar formulário: ' + sanitizeErrorMessage(error),
        code: 'FORM_PARSE_ERROR',
        status: 400,
      },
    };
  }
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number, maxSizeBytes: number): { valid: boolean; error?: any } {
  if (fileSize > maxSizeBytes) {
    const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: getErrorResponse(ErrorCodes.FILE_TOO_LARGE, `${maxMB}MB`),
    };
  }
  return { valid: true };
}

/**
 * Create standardized success response
 */
export function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Create standardized error response
 */
export function errorResponse(error: ApiError | Error | any, fallbackStatus = 500) {
  const response = createErrorResponse(error, fallbackStatus);
  const { status, ...body } = response;
  return NextResponse.json(body, { status });
}

/**
 * Wrapper function for API route handlers
 * Provides automatic error handling and validation
 */
export function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      // Validate HTTP method if needed
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        // Validate body is not empty only for methods that should have body
        const text = await req.text();
        if (!text || text.trim() === '') {
          return errorResponse(
            {
              message: 'Corpo da requisição vazio',
              code: 'EMPTY_BODY',
              statusCode: 400,
            },
            400
          );
        }
        // Re-create request with text for handler to use
        req = new NextRequest(req, { method: req.method, body: text });
      }

      return await handler(req);
    } catch (error: any) {
      console.error('API Error:', error);
      return errorResponse(error);
    }
  };
}

/**
 * Validate POST endpoint
 */
export function validatePostEndpoint(req: NextRequest): { valid: boolean; error?: any } {
  if (req.method !== 'POST') {
    const errorDef = ErrorCodes.METHOD_NOT_ALLOWED;
    const message = typeof errorDef.message === 'function' ? errorDef.message(req.method) : errorDef.message;
    return {
      valid: false,
      error: { status: errorDef.status, code: errorDef.code, message },
    };
  }
  return { valid: true };
}
