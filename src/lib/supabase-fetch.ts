
/**
 * Utilitário para realizar chamadas diretas à API do Supabase ignorando o SDK quando necessário.
 * Resolve problemas de travamento (hang) em PWAs e instabilidades de cache.
 */
export async function supabaseFetch(path: string, options: RequestInit = {}) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

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
            // Extrai o project ref de forma robusta (ex: lqktevnjfywrujdhetlo)
            const hostname = new URL(baseUrl).hostname;
            const projectRef = hostname.split('.')[0];
            const storageKey = `sb-${projectRef}-auth-token`;

            const authStorage = localStorage.getItem(storageKey);
            if (authStorage) {
                const session = JSON.parse(authStorage);
                if (session?.access_token) {
                    headers.set('Authorization', `Bearer ${session.access_token}`);
                }
            }
        } catch (e) {
            console.warn("Supabase Fetch: Could not extract auth token from localStorage", e);
        }
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Supabase Fetch Error [${response.status}] [${url}]:`, errorText);
            throw new Error(`Erro na conexão: ${response.status}`);
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
    } catch (error) {
        console.error("Supabase Fetch: Network or Parse error", error);
        throw error;
    }
}
