
/**
 * Utilitário para realizar chamadas diretas à API do Supabase ignorando o SDK quando necessário.
 * Resolve problemas de travamento (hang) em PWAs e instabilidades de cache.
 */
export async function supabaseFetch(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        console.error("Supabase Fetch: Missing env variables for Supabase");
        throw new Error("Supabase URL or Key missing");
    }

    // Garante que a URL base não tenha barra no final para evitar URLS//rest...
    const baseUrl = supabaseUrl.replace(/\/$/, "");

    let url: string;
    if (path.startsWith('http')) {
        url = path;
    } else if (path.startsWith('functions/v1/')) {
        url = `${baseUrl}/${path}`;
    } else if (path.startsWith('rpc/')) {
        url = `${baseUrl}/rest/v1/${path}`;
    } else {
        url = `${baseUrl}/rest/v1/${path.replace(/^\//, '')}`;
    }

    const headers = new Headers(options.headers);
    headers.set('apikey', supabaseKey);

    // Set default Content-Type for requests with body if not already set
    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    if (!headers.has('Authorization')) {
        try {
            const { supabase } = await import('@/integrations/supabase/client');

            // Timeout de 5s para auth — evita travar o fetch inteiro
            // The inner async IIFE is referenced separately so we can attach a
        // no-op .catch() to it. This prevents an "unhandled promise rejection"
        // when the 5 s timeout wins the race and the getSession() call later
        // rejects (e.g. AbortError from React StrictMode double-mount cleanup).
        const sessionPromise = (async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.access_token) return session.access_token;

                    // Session vazia — tenta refresh
                    const { data: refreshData } = await supabase.auth.refreshSession();
                    return refreshData?.session?.access_token ?? null;
                })();
        // Swallow any rejection that occurs after the race already resolved.
        sessionPromise.catch(() => {});

        const authToken = await Promise.race([
                sessionPromise,
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
            ]);

            if (authToken) {
                headers.set('Authorization', `Bearer ${authToken}`);
            } else {
                const method = (options.method || 'GET').toUpperCase();
                if (method !== 'GET') {
                    throw new Error('Sessão expirada. Faça login novamente.');
                }
                // GET sem auth usa apenas apikey (anon access via RLS)
            }
        } catch (e: any) {
            if (e?.message?.includes('Sessão expirada')) throw e;
            console.warn("Supabase Fetch: Could not extract auth token", e);
        }
    }

    // Abort controller: use caller's signal if provided, else create one with timeout
    const { timeoutMs = 60_000, signal: callerSignal, ...fetchOptions } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

    // If caller passed a signal, abort ours when theirs fires
    const onCallerAbort = () => controller.abort();
    callerSignal?.addEventListener('abort', onCallerAbort);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            headers,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Supabase Fetch Error [${response.status}] [${url}]:`, errorText);

            // Criar erro enriquecido
            const error = new Error(errorText || `Erro na conexão: ${response.status}`);
            (error as any).status = response.status;
            (error as any).url = url;
            throw error;
        }

        // Caso de 204 No Content ou corpo vazio
        const text = await response.text();
        if (!text || text.trim() === "") return null;

        try {
            return JSON.parse(text);
        } catch (e) {
            // Se não for JSON, retorna o texto puro (casos raros)
            return text;
        }
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw new Error(`Conexão expirou após ${timeoutMs / 1000}s. Verifique sua internet e tente novamente.`);
        }
        // Re-throw auth errors with clear message
        if (error?.status === 401 || error?.status === 403) {
            throw new Error('Sem permissão. Verifique se está logado corretamente.');
        }
        console.error("Supabase Fetch error:", error);
        throw error;
    } finally {
        clearTimeout(timer);
        callerSignal?.removeEventListener('abort', onCallerAbort);
    }
}
