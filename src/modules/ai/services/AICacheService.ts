export class AICacheService {
    private static CACHE_KEY_PREFIX = 'ga_ai_cache_';
    private static DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Generates a cache key based on the prompt and text.
     */
    private static generateKey(prompt: string, text: string): string {
        // Simple hash implementation for the key
        const str = `${prompt}|${text}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return `${this.CACHE_KEY_PREFIX}${hash}`;
    }

    /**
     * Retrieves a cached response if valid.
     */
    static getCachedResponse<T>(prompt: string, text: string): T | null {
        const key = this.generateKey(prompt, text);
        const cached = localStorage.getItem(key);

        if (!cached) return null;

        try {
            const { data, expiry } = JSON.parse(cached);
            if (Date.now() > expiry) {
                localStorage.removeItem(key);
                return null;
            }
            return data as T;
        } catch (e) {
            localStorage.removeItem(key);
            return null;
        }
    }

    /**
     * Caches a response.
     */
    static cacheResponse(prompt: string, text: string, data: any, ttl = this.DEFAULT_TTL): void {
        const key = this.generateKey(prompt, text);
        const entry = {
            data,
            expiry: Date.now() + ttl,
            timestamp: new Date().toISOString()
        };

        try {
            localStorage.setItem(key, JSON.stringify(entry));
        } catch (e) {
            // If quota exceeded, clear old caches
            this.clearExpired();
        }
    }

    /**
     * Clears expired cache entries.
     */
    static clearExpired(): void {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.CACHE_KEY_PREFIX)) {
                try {
                    const { expiry } = JSON.parse(localStorage.getItem(key)!);
                    if (Date.now() > expiry) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    localStorage.removeItem(key!);
                }
            }
        }
    }
}
