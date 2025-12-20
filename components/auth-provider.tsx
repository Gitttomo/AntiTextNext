/**
 * 認証プロバイダーコンポーネント
 * 
 * アプリ全体の認証状態を管理するReact Contextプロバイダーです。
 * 
 * 機能:
 * - ログイン状態の監視とセッション管理
 * - ユーザー情報の提供
 * - サインアウト処理
 * 
 * useAuth()フックを使用してアプリ全体から認証状態にアクセスできます。
 */

"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

// 認証コンテキストの型定義
type AuthContextType = {
    user: User | null;       // ログインユーザー情報
    loading: boolean;        // 読み込み状態
    signOut: () => Promise<void>;  // サインアウト関数
};

// 認証コンテキストの作成（デフォルト値を設定）
const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signOut: async () => { },
});

// 認証状態にアクセスするためのカスタムフック
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
