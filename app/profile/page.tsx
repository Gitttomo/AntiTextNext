
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import ProfileClient from "./client";

// 動的レンダリングを強制（ユーザーごとのデータのため）
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const supabase = createSupabaseServerClient();
    
    // Server-side auth check
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        redirect("/auth/login");
    }

    // Fetch profile data on server
    const { data: profile } = await supabase
        .from("profiles")
        .select("nickname, department")
        .eq("user_id", user.id)
        .single();

    const nickname = (profile as any)?.nickname || "";
    const department = (profile as any)?.department || "";

    return (
        <ProfileClient 
            initialNickname={nickname}
            initialDepartment={department}
        />
    );
}
