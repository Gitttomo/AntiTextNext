"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchAvatarUrl(session.user.id);
            }
            setLoading(false);
        };

        initAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchAvatarUrl(session.user.id);
            } else {
                setAvatarUrl(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [fetchAvatarUrl]);

    const signOut = useCallback(async () => {
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
