import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkServerRateLimit, getClientIpAddress } from "@/lib/server-rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const identifier = `user:${session.user.id}:ip:${getClientIpAddress(request)}`;
  const allowed = await checkServerRateLimit({
    scope: "stripe_checkout",
    identifier,
    maxRequests: 5,
    windowSeconds: 60,
  });

  if (!allowed) {
    return NextResponse.json({ error: "リクエストが多すぎます" }, { status: 429 });
  }

  return NextResponse.json(
    { error: "Stripe Checkout is not implemented yet" },
    { status: 501 }
  );
}
