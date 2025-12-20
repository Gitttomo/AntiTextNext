/**
 * Supabaseクライアント設定ファイル
 * 
 * このファイルはSupabaseデータベースへの接続を管理します。
 * 環境変数からSupabaseのURLとAPIキーを取得してクライアントを初期化します。
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// 環境変数からSupabaseの設定を取得（未設定時はプレースホルダを使用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// Supabaseクライアントをエクスポート（Database型で型安全性を確保）
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
