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
    throw new Error('Falha ao renovar token Google. Faça login novamente.');
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
    throw new Error('Nenhum token Google encontrado. Faça login com Google primeiro.');
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
    throw new Error('Token expirado e sem refresh token. Faça login com Google novamente.');
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
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

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
        if (!body.fileId) {
          return NextResponse.json({ error: 'fileId obrigatório' }, { status: 400 });
        }
        const content = await readJsonFile(accessToken, body.fileId);
        return NextResponse.json({ content });
      }

      case 'save': {
        if (!body.fileName || body.data === undefined) {
          return NextResponse.json({ error: 'fileName e data obrigatórios' }, { status: 400 });
        }
        const existingFile = body.fileId || null;
        const savedId = await saveJsonFile(accessToken, folderId, body.fileName, body.data, existingFile);
        return NextResponse.json({ fileId: savedId });
      }

      case 'delete': {
        if (!body.fileId) {
          return NextResponse.json({ error: 'fileId obrigatório' }, { status: 400 });
        }
        await deleteFile(accessToken, body.fileId);
        return NextResponse.json({ ok: true });
      }

      case 'find': {
        if (!body.fileName) {
          return NextResponse.json({ error: 'fileName obrigatório' }, { status: 400 });
        }
        const file = await findFileByName(accessToken, folderId, body.fileName);
        return NextResponse.json({ file });
      }

      default:
        return NextResponse.json({ error: `Ação desconhecida: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Drive API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
