import { supabaseFetch } from '@/lib/supabase-fetch';
import { AICacheService } from '@/modules/ai/services/AICacheService';

export class AIApi {
    /**
     * Processes text using a voice-to-text conversion/analysis function.
     */
    static async processVoiceText(text: string, systemPrompt: string): Promise<any> {
        // Attempt to get from cache first
        const cached = AICacheService.getCachedResponse<any>(systemPrompt, text);
        if (cached) {
            console.log('AICache: Hit for voice processing');
            return cached;
        }

        console.log('AICache: Miss for voice processing, calling AI...');
        const result = await supabaseFetch('functions/v1/process-voice-text', {
            method: 'POST',
            body: JSON.stringify({ text, systemPrompt }),
        });

        // Cache the result if successful
        if (result && !result.error) {
            AICacheService.cacheResponse(systemPrompt, text, result);
        }

        return result;
    }
}
