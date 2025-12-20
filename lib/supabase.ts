import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// シングルトンパターンでSupabaseクライアントを最適化
// createBrowserClientを使用することで、クッキーベースのセッション管理が自動化されます
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export const supabase = (() => {
    if (!supabaseInstance) {
        supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
    }
    return supabaseInstance;
})();
