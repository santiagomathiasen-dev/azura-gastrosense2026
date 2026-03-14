import { supabaseFetch } from '@/lib/supabase-fetch';

export abstract class BaseApiService {
    protected abstract get endpoint(): string;

    /**
     * Performs a GET request.
     */
    protected async get<T>(query: string = ''): Promise<T[]> {
        const path = `${this.endpoint}${query ? `?${query}` : ''}`;
        const result = await supabaseFetch(path);
        if (!result) return [];
        return (Array.isArray(result) ? result : [result]).filter(Boolean) as T[];
    }

    /**
     * Performs a single item GET request.
     */
    protected async getOne<T>(query: string): Promise<T | null> {
        const result = await this.get<T>(query);
        return result.length > 0 ? result[0] : null;
    }

    /**
     * Performs a POST request.
     */
    protected async post<T>(data: any): Promise<T> {
        const result = await supabaseFetch(this.endpoint, {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(data),
        });
        return (Array.isArray(result) ? result[0] : result) as T;
    }

    /**
     * Performs a PATCH request.
     */
    protected async patch<T>(id: string, data: any): Promise<T> {
        const result = await supabaseFetch(`${this.endpoint}?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=representation' },
            body: JSON.stringify(data),
        });
        return (Array.isArray(result) ? result[0] : result) as T;
    }

    /**
     * Performs a DELETE request.
     */
    protected async delete(id: string): Promise<void> {
        await supabaseFetch(`${this.endpoint}?id=eq.${id}`, {
            method: 'DELETE',
        });
    }

    /**
     * Performs a custom RPC call.
     */
    protected async rpc<T>(name: string, params: any = {}): Promise<T> {
        return await supabaseFetch(`rpc/${name}`, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
}
