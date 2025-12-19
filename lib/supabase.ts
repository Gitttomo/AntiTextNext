import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// シングルトンパターンでSupabaseクライアントを最適化
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export const supabase = (() => {
    if (!supabaseInstance) {
        supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
            global: {
                headers: {
                    'x-client-info': 'textnext-web',
                },
            },
            // リアルタイム接続を遅延初期化
            realtime: {
                params: {
                    eventsPerSecond: 10,
                },
            },
        });
    }
    return supabaseInstance;
})();
