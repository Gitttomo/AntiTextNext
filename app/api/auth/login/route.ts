import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isCurrentUserAdmin, normalizeEmail } from "@/lib/admin";

export const runtime = "nodejs";

const GENERIC_LOGIN_ERROR = "ログイン情報が正しくありません";

const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
};

const sanitizeRedirectTo = (value?: string | null) => {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
};

const createRouteSupabaseClient = () => {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
};

const recordLoginAttempt = async (
  supabase: ReturnType<typeof createRouteSupabaseClient>,
  email: string,
  ipAddress: string,
  userAgent: string,
  success: boolean
) => {
  await (supabase as any).rpc("record_login_attempt", {
    target_email: email,
    target_ip_address: ipAddress,
    target_user_agent: userAgent,
    was_success: success,
  });
};

export async function POST(request: NextRequest) {
  const supabase = createRouteSupabaseClient();
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  let email = "";
  let password = "";
  let redirectTo = "/";

  try {
    const body = await request.json();
    email = normalizeEmail(String(body.email || ""));
    password = String(body.password || "");
    redirectTo = sanitizeRedirectTo(body.redirectTo);
  } catch {
    return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 400 });
  }

  const { data: isLimited, error: limitError } = await (supabase as any).rpc(
    "is_login_rate_limited",
    {
      target_email: email,
      target_ip_address: ipAddress,
    }
  );

  if (limitError) {
    console.error("Failed to check login rate limit:", limitError);
  }

  if (isLimited) {
    return NextResponse.json(
      { error: "ログイン試行が多すぎます。しばらく時間をおいて再度お試しください。" },
      { status: 429 }
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    await recordLoginAttempt(supabase, email, ipAddress, userAgent, false);
    return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    await recordLoginAttempt(supabase, email, ipAddress, userAgent, false);
    return NextResponse.json({ error: GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  await recordLoginAttempt(supabase, email, ipAddress, userAgent, true);

  const { data: profile } = await (supabase.from("profiles") as any)
    .select("user_id, is_deactivated")
    .eq("user_id", data.user.id)
    .single();

  let nextPath = redirectTo;
  if (!profile) {
    nextPath = "/auth/setup-profile";
  } else if (profile.is_deactivated) {
    nextPath = "/auth/reactivate";
  }

  const isAdmin = await isCurrentUserAdmin(supabase as any);
  if (isAdmin) {
    await (supabase as any).rpc("admin_log_action", {
      action_type: "admin_login",
      target_type: "user",
      target_id: data.user.id,
      reason: "admin login",
      metadata: {
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });
  }

  return NextResponse.json({ success: true, redirectTo: nextPath });
}
