import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import ProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookies().get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    try {
                        cookies().set({ name, value, ...options });
                    } catch (error) {
                        // Handle potential error in Server Components
                    }
                },
                remove(name: string, options: any) {
                    try {
                        cookies().set({ name, value: "", ...options });
                    } catch (error) {
                        // Handle potential error in Server Components
                    }
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();

    // If no session on server, pass null and let client handle redirect.
    if (!session) {
        return <ProfileClient initialProfile={null} serverSession={false} />;
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("nickname, department, avatar_url, degree, grade, major")
        .eq("user_id", session.user.id)
        .single();

    return (
        <ProfileClient 
            initialProfile={profile as any} 
            serverSession={true}
        />
    );
}
