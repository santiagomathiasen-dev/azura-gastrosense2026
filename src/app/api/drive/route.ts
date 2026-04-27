import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateAppFolder,
  listFiles,
  readJsonFile,
  saveJsonFile,
  deleteFile,
  findFileByName,
} from '@/lib/google-drive';
import { errorResponse, ErrorCodes, validateRequiredFields } from '@/lib/api-errors-next';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set({ name, value, ...options })
            );
          } catch (_) { }
        },
      },
    }
  );
}

/** Refresh the Google access token using the stored refresh token. */
async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) {
    throw {
      message: 'Falha ao renovar token Google. Faça login novamente.',
      code: 'EXTERNAL_API_ERROR',
      statusCode: 502,
    };
  }
  const data = await res.json();
  return data.access_token;
}

/** Get a valid Google access token for the current user. */
async function getAccessToken(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_access_token, google_refresh_token')
    .eq('id', userId)
    .single();

  if (!profile?.google_access_token) {
    throw {
      message: 'Nenhum token Google encontrado. Faça login com Google primeiro.',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    };
  }

  // Try the current token first
  const testRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${profile.google_access_token}` },
  });

  if (testRes.ok) {
    return profile.google_access_token;
  }

  // Token expired — refresh it
  if (!profile.google_refresh_token) {
    throw {
      message: 'Token expirado e sem refresh token. Faça login com Google novamente.',
      code: 'INVALID_TOKEN',
      statusCode: 401,
    };
  }

  const newToken = await refreshGoogleToken(profile.google_refresh_token);

  // Save the new token
  await supabase
    .from('profiles')
    .update({ google_access_token: newToken })
    .eq('id', userId);

  return newToken;
}

/**
 * POST /api/drive
 *
 * Body: { action, fileName?, fileId?, data? }
 * Actions: "init", "list", "read", "save", "delete", "find"
 */
export async function POST(request: NextRequest) {
  try {
    // Validate HTTP method
    if (request.method !== 'POST') {
      const errorDef = ErrorCodes.METHOD_NOT_ALLOWED;
      const message = typeof errorDef.message === 'function' ? errorDef.message(request.method) : errorDef.message;
      return errorResponse({ status: errorDef.status, code: errorDef.code, message });
    }

    // Parse body with validation
    let body: any;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        return errorResponse(
          {
            message: 'Corpo da requisição vazio (ação obrigatória)',
            code: 'EMPTY_BODY',
            statusCode: 400,
          },
          400
        );
      }
      body = JSON.parse(text);
    } catch {
      return errorResponse(
        {
          message: 'JSON inválido no corpo da requisição',
          code: 'INVALID_JSON',
          statusCode: 400,
        },
        400
      );
    }

    const { action } = body;
    if (!action || typeof action !== 'string') {
      return errorResponse(
        {
          message: 'Campo obrigatório faltando: action',
          code: 'MISSING_FIELD',
          statusCode: 400,
        },
        400
      );
    }

    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 401);
    }

    const accessToken = await getAccessToken(supabase, user.id);
    const folderId = await getOrCreateAppFolder(accessToken);

    switch (action) {
      case 'init': {
        return NextResponse.json({ folderId });
      }

      case 'list': {
        const files = await listFiles(accessToken, folderId);
        return NextResponse.json({ files });
      }

      case 'read': {
        if (!body.fileId || typeof body.fileId !== 'string') {
          return errorResponse(
            {
              message: 'Campo obrigatório faltando: fileId',
              code: 'MISSING_FIELD',
              statusCode: 400,
            },
            400
          );
        }
        const content = await readJsonFile(accessToken, body.fileId);
        return NextResponse.json({ content });
      }

      case 'save': {
        if (!body.fileName || typeof body.fileName !== 'string') {
          return errorResponse(
            {
              message: 'Campo obrigatório faltando: fileName',
              code: 'MISSING_FIELD',
              statusCode: 400,
            },
            400
          );
        }
        if (body.data === undefined || body.data === null) {
          return errorResponse(
            {
              message: 'Campo obrigatório faltando: data',
              code: 'MISSING_FIELD',
              statusCode: 400,
            },
            400
          );
        }
        const existingFile = body.fileId || null;
        const savedId = await saveJsonFile(accessToken, folderId, body.fileName, body.data, existingFile);
        return NextResponse.json({ fileId: savedId });
      }

      case 'delete': {
        if (!body.fileId || typeof body.fileId !== 'string') {
          return errorResponse(
            {
              message: 'Campo obrigatório faltando: fileId',
              code: 'MISSING_FIELD',
              statusCode: 400,
            },
            400
          );
        }
        await deleteFile(accessToken, body.fileId);
        return NextResponse.json({ ok: true });
      }

      case 'find': {
        if (!body.fileName || typeof body.fileName !== 'string') {
          return errorResponse(
            {
              message: 'Campo obrigatório faltando: fileName',
              code: 'MISSING_FIELD',
              statusCode: 400,
            },
            400
          );
        }
        const file = await findFileByName(accessToken, folderId, body.fileName);
        return NextResponse.json({ file });
      }

      default:
        return errorResponse(
          {
            message: `Ação não reconhecida: ${action}. Ações válidas: init, list, read, save, delete, find`,
            code: 'INVALID_FIELD',
            statusCode: 400,
          },
          400
        );
    }
  } catch (err: any) {
    console.error('Drive API error:', err);
    return errorResponse(err);
  }
}
