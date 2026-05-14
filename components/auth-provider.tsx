"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

type AuthContextType = {
    user: User | null;
    loading: boolean;
    avatarUrl: string | null;
    signOut: () => Promise<void>;
    refreshAvatar: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    avatarUrl: null,
    signOut: async () => { },
    refreshAvatar: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    const fetchAvatarUrl = useCallback(async (userId: string) => {
        try {
            const { data } = await supabase
                .from("profiles")
                .select("avatar_url")
                .eq("user_id", userId)
                .single();
            
            if (data) {
                setAvatarUrl((data as any).avatar_url || null);
            }
        } catch (err) {
            console.error("Error fetching avatar:", err);
        }
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            
            if (currentUser) {
                fetchAvatarUrl(currentUser.id);
                
                // アカウント制限のチェック
                const excludedPaths = ['/suspended', '/auth/'];
                const isExcluded = excludedPaths.some(p => pathname.startsWith(p));
                
                if (!isExcluded) {
                    const { data: restriction } = await supabase
                        .from('user_restrictions')
                        .select('restriction_type, ends_at, lifted_at')
                        .eq('user_id', currentUser.id)
                        .in('restriction_type', ['temporary_suspend', 'permanent_ban'])
                        .is('lifted_at', null)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (restriction) {
                        const res = restriction as any;
                        // 一時停止の場合は期限をチェック
                        if (res.restriction_type === 'temporary_suspend' && res.ends_at) {
                            if (new Date(res.ends_at) > new Date()) {
                                router.replace('/suspended');
                                return;
                            }
                        } else if (res.restriction_type === 'permanent_ban') {
                            router.replace('/suspended');
                            return;
                        }
                    }

                    // 利用制限がない場合はプロフィールの設定状況をチェック
                    const { data: profile, error: profileError } = await (supabase
                        .from("profiles") as any)
                        .select("user_id")
                        .eq("user_id", currentUser.id)
                        .single();

                    if (!profile && !profileError) {
                        router.replace('/auth/setup-profile');
                    }
                }
            } else {
                setAvatarUrl(null);
            }
            setLoading(false);
        };

        initAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (currentUser) {
                fetchAvatarUrl(currentUser.id);
                // AuthState変更時も制限チェック
                const excludedPaths = ['/suspended', '/auth/'];
                const isExcluded = excludedPaths.some(p => pathname.startsWith(p));
                
                if (!isExcluded) {
                    const { data: restriction } = await supabase
                        .from('user_restrictions')
                        .select('restriction_type, ends_at, lifted_at')
                        .eq('user_id', currentUser.id)
                        .in('restriction_type', ['temporary_suspend', 'permanent_ban'])
                        .is('lifted_at', null)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    if (restriction) {
                        const res = restriction as any;
                        if (res.restriction_type === 'temporary_suspend' && res.ends_at) {
                            if (new Date(res.ends_at) > new Date()) {
                                router.replace('/suspended');
                                return;
                            }
                        } else if (res.restriction_type === 'permanent_ban') {
                            router.replace('/suspended');
                            return;
                        }
                    }

                    // 利用制限がない場合はプロフィールの設定状況をチェック
                    const { data: profile, error: profileError } = await (supabase
                        .from("profiles") as any)
                        .select("user_id")
                        .eq("user_id", currentUser.id)
                        .single();

                    if (!profile && !profileError) {
                        router.replace('/auth/setup-profile');
                    }
                }
            } else {
                setAvatarUrl(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [fetchAvatarUrl, pathname, router]);

    const signOut = useCallback(async () => {
        setUser(null);
        await supabase.auth.signOut();
        setAvatarUrl(null);
    }, []);

    const refreshAvatar = useCallback(async () => {
        if (user) {
            await fetchAvatarUrl(user.id);
        }
    }, [user, fetchAvatarUrl]);

    const value = useMemo(() => ({
        user,
        loading,
        avatarUrl,
        signOut,
        refreshAvatar
    }), [user, loading, avatarUrl, signOut, refreshAvatar]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
